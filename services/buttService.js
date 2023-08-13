import provider from "./ethService.js"
import db, { GetItemCommand, PutItemCommand, UpdateItemCommand } from "./dbService.js"
import s3, { PutObjectAclCommand } from "./s3Service.js"
import { Contract, ZeroAddress } from "ethers"
import LazyButtsAbi from "../contracts/LazyButts.json" assert { type: "json" }

const BUTTS_CONTRACT_ADDRESS = process.env.ENV === 'dev' ? process.env.BUTTS_CONTRACT_ADDRESS_TEST : process.env.BUTTS_CONTRACT_ADDRESS

const contract = new Contract(BUTTS_CONTRACT_ADDRESS, LazyButtsAbi, provider)

const transferEvent = (from, to, tokenId) => {
    db.send(new GetItemCommand({
        TableName: "users",
        Key: {
            "address": {
                S: to
            }
        }
    }))
        .then((data) => {
            console.log(data)
            if (data.Item === undefined) {
                const putParams = {
                    TableName: "users",
                    Item: {
                        "address": {
                            S: to
                        },
                        "butts": {
                            L: [
                                {
                                    N: tokenId.toString()
                                }
                            ]
                        }
                    }
                }
                db.send(new PutItemCommand(putParams))
                    .then((data) => {
                        // console.log(data)
                    }
                    )
                    .catch((error) => {
                        console.log(error)
                    }
                    )
            } else {

                const params = {
                    TableName: "users",
                    Key: {
                        "address": {
                            S: to
                        }
                    },
                    UpdateExpression: "SET #butts = list_append(#butts, :newButt)",
                    ExpressionAttributeNames: {
                        "#butts": "butts"
                    },
                    ExpressionAttributeValues: {
                        ":newButt": {
                            L: [
                                {
                                    N: tokenId.toString()
                                }
                            ]
                        }
                    }
                }
                db.send(new UpdateItemCommand(params))
                    .then((data) => {
                        // console.log(data)
                    }
                    )
                    .catch((error) => {
                        console.log(error)
                    }
                    )
            }
        })

    if (from === ZeroAddress) {
        return
    }

    db.send(new GetItemCommand({
        TableName: "users",
        Key: {
            "address": {
                S: from
            }
        }
    }))
        .then((data) => {
            const butts = data.Item.butts.L; // Assuming that butts is a list of numbers.
            const index = butts.findIndex(butt => Number(butt.N) === tokenId);

            if (index > -1) {
                const params2 = {
                    TableName: "users",
                    Key: {
                        "address": {
                            S: from
                        }
                    },
                    UpdateExpression: `REMOVE #butts[${index}]`,
                    ExpressionAttributeNames: {
                        "#butts": "butts"
                    }
                };
                db.send(new UpdateItemCommand(params2))
                    .then((data) => {
                        // console.log(data);
                    })
                    .catch((error) => {
                        console.log(error);
                    });
            }
        })
        .catch((error) => {
            console.log(error);
        });

}

function makeS3ObjectPublic(bucket, key) {
    const params = {
        Bucket: bucket,
        Key: key,
        ACL: "public-read"
    }
    s3.send(new PutObjectAclCommand(params))
        .then((data) => {
            // console.log(data)
        })
        .catch((error) => {
            console.log(error)
        })
}

// set S3 image ACLs to public-read
const mintEvent = (to, tokenId) => {
    console.log(`Minted token ${tokenId} to ${to}`)
    const bucket = process.env.BUCKET_NAME
    const mediumButtKey = `public/images/medium-lazy-butts/${tokenId}.png`
    const smallButtKey = `public/images/small-lazy-butts/${tokenId}.png`
    const metadataKey = `public/metadata/${tokenId}.json`
    makeS3ObjectPublic(bucket, mediumButtKey)
    makeS3ObjectPublic(bucket, smallButtKey)
    makeS3ObjectPublic(bucket, metadataKey)
    console.log(`Set ACLs for token ${tokenId}`)
}

contract.on("Transfer", (from, to, tokenId) => {
    transferEvent(from, to, tokenId)
})

contract.on("Mint", (to, tokenId) => {
    mintEvent(to, tokenId)
})