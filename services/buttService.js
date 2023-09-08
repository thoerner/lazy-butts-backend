import provider from "./ethService.js"
import db, { GetItemCommand, PutItemCommand, UpdateItemCommand } from "./dbService.js"
import s3, { PutObjectAclCommand } from "./s3Service.js"
import { Contract, ZeroAddress } from "ethers"
import LazyButtsAbi from "../contracts/LazyButts.json" assert { type: "json" }

const BUTTS_CONTRACT_ADDRESS = process.env.ENV === 'dev' ? process.env.BUTTS_CONTRACT_ADDRESS_TEST : process.env.BUTTS_CONTRACT_ADDRESS

const contract = new Contract(BUTTS_CONTRACT_ADDRESS, LazyButtsAbi, provider)

class EventQueue {
    constructor() {
        this.queue = [];
    }

    enqueue(event) {
        const isDuplicate = this.queue.some(
            queuedEvent => queuedEvent.type === event.type &&
                queuedEvent.from === event.from &&
                queuedEvent.to === event.to &&
                queuedEvent.tokenId === event.tokenId
        );

        if (!isDuplicate) {
            this.queue.push(event);
        }
    }

    dequeue() {
        return this.queue.shift();
    }

    get length() {
        return this.queue.length;
    }
}

const eventQueue = new EventQueue();

const processEvent = async (event) => {
    const { type, from, to, tokenId } = event;

    try {
        if (type === 'transfer') {
            const getItemCommand = new GetItemCommand({
                TableName: "users",
                Key: {
                    "address": { S: to }
                }
            });
            const userData = await db.send(getItemCommand);

            if (userData.Item === undefined) {
                const putParams = {
                    TableName: "users",
                    Item: {
                        "address": { S: to },
                        "butts": { L: [{ N: tokenId.toString() }] }
                    }
                };
                await db.send(new PutItemCommand(putParams));
            } else {
                const updateParams = {
                    TableName: "users",
                    Key: { "address": { S: to } },
                    UpdateExpression: "SET #butts = list_append(#butts, :newButt)",
                    ExpressionAttributeNames: { "#butts": "butts" },
                    ExpressionAttributeValues: { ":newButt": { L: [{ N: tokenId.toString() }] } }
                };
                await db.send(new UpdateItemCommand(updateParams));
            }

            if (from !== ZeroAddress) {
                const fromUserData = await db.send(new GetItemCommand({
                    TableName: "users",
                    Key: { "address": { S: from } }
                }));
                const butts = fromUserData.Item.butts.L;
                const index = butts.findIndex(butt => Number(butt.N) === tokenId);

                if (index > -1) {
                    const params2 = {
                        TableName: "users",
                        Key: { "address": { S: from } },
                        UpdateExpression: `REMOVE #butts[${index}]`,
                        ExpressionAttributeNames: { "#butts": "butts" }
                    };
                    await db.send(new UpdateItemCommand(params2));
                }
            }
        } else if (type === 'mint') {
            console.log(`Minted token ${tokenId} to ${to}`)
            const bucket = process.env.BUCKET_NAME
            const mediumButtKey = `public/images/medium-lazy-butts/${tokenId}.png`
            const smallButtKey = `public/images/small-lazy-butts/${tokenId}.png`
            const metadataKey = `public/metadata/${tokenId}.json`
            await makeS3ObjectPublic(bucket, mediumButtKey)
            await makeS3ObjectPublic(bucket, smallButtKey)
            await makeS3ObjectPublic(bucket, metadataKey)
            console.log(`Set ACLs for token ${tokenId}`)

            // update set of mintedTokens in config table
            const params = {
                TableName: "config",
                Key: {
                    "setting": {
                        S: "tokenConfig"
                    }
                },
                UpdateExpression: "ADD #mintedTokens :newToken",
                ExpressionAttributeNames: {
                    "#mintedTokens": "mintedTokens"
                },
                ExpressionAttributeValues: {
                    ":newToken": {
                        NS: [tokenId.toString()]
                    }
                }
            }

            const command = new UpdateItemCommand(params)

            const data = await db.send(command)
            console.log(`Updated mintedTokens in config table: ${JSON.stringify(data)}`)
        }
    } catch (err) {
        console.error(`Error processing event: ${JSON.stringify(event)}`);
        throw err;
    }
}

function isNonRecoverableError(err) {
    // Replace with your own logic
    // For example, let's consider an error to be non-recoverable if it contains the string 'Duplicate'
    return err.message.includes('Duplicate');
}

const transferEvent = (from, to, tokenId) => {
        eventQueue.enqueue({ type: 'transfer', from, to, tokenId });
    }

    const runEventQueue = async () => {
        while (eventQueue.length > 0) {
            const event = eventQueue.dequeue();
            let retries = 3; // number of retries
            let operationSuccess = false; // flag to indicate successful operation

            while (retries > 0 && !operationSuccess) {
                try {
                    await processEvent(event);
                    console.log(`Successfully processed event: ${JSON.stringify(event)}`);
                    operationSuccess = true; // set flag to true
                } catch (err) {
                    // Check the type of error, if it's a non-recoverable error break out of the loop
                    if (isNonRecoverableError(err)) {
                        console.error(`Non-recoverable error: ${err}`);
                        break;
                    }
                    retries--;
                    console.error(`Retrying event. Attempts remaining: ${retries}`);
                }
            }
        }
    };


    async function makeS3ObjectPublic(bucket, key) {
        const params = {
            Bucket: bucket,
            Key: key,
            ACL: "public-read"
        }

        const command = new PutObjectAclCommand(params)

        const data = await s3.send(command)
        console.log(data)
    }

    const mintEvent = async (to, tokenId) => {
        eventQueue.enqueue({ type: 'mint', to, tokenId });
    }

    contract.on("Transfer", (from, to, tokenId) => {
        transferEvent(from, to, tokenId)
    })

    contract.on("Mint", (to, tokenId) => {
        mintEvent(to, tokenId)
    })

    setInterval(runEventQueue, 3000);

    console.log(`Listening for events on contract ${BUTTS_CONTRACT_ADDRESS}...`)