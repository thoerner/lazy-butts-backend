import provider from "./ethService.js";
import db, {
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from "./dbService.js";
import s3, { PutObjectAclCommand } from "./s3Service.js";
import axios from "axios";
import { Contract, ZeroAddress } from "ethers";
import LazyButtsAbi from "../contracts/LazyButts.json" assert { type: "json" };

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

const BUTTS_CONTRACT_ADDRESS =
  process.env.ENV === "dev"
    ? process.env.BUTTS_CONTRACT_ADDRESS_TEST
    : process.env.BUTTS_CONTRACT_ADDRESS;

const contract = new Contract(BUTTS_CONTRACT_ADDRESS, LazyButtsAbi, provider);

class EventQueue {
  constructor() {
    this.queue = [];
  }

  enqueue(event) {
    const isDuplicate = this.queue.some(
      (queuedEvent) =>
        queuedEvent.type === event.type &&
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
    if (type === "transfer") {
      console.log(`Transferred token ${tokenId} from ${from} to ${to}`);
      const getItemCommand = new GetItemCommand({
        TableName: "users",
        Key: {
          address: { S: to },
        },
      });
      const userData = await db.send(getItemCommand);

      if (userData.Item === undefined) {
        const putParams = {
          TableName: "users",
          Item: {
            address: { S: to },
            butts: { L: [{ N: tokenId.toString() }] },
          },
        };
        await db.send(new PutItemCommand(putParams));
      } else {
        const updateParams = {
          TableName: "users",
          Key: { address: { S: to } },
          UpdateExpression: "SET #butts = list_append(#butts, :newButt)",
          ExpressionAttributeNames: { "#butts": "butts" },
          ExpressionAttributeValues: {
            ":newButt": { L: [{ N: tokenId.toString() }] },
          },
        };
        await db.send(new UpdateItemCommand(updateParams));
      }

      if (from !== ZeroAddress) {
        const fromUserData = await db.send(
          new GetItemCommand({
            TableName: "users",
            Key: { address: { S: from } },
          })
        );
        const butts = fromUserData.Item.butts.L;
        const index = butts.findIndex((butt) => Number(butt.N) === tokenId);

        if (index > -1) {
          const params2 = {
            TableName: "users",
            Key: { address: { S: from } },
            UpdateExpression: `REMOVE #butts[${index}]`,
            ExpressionAttributeNames: { "#butts": "butts" },
          };
          await db.send(new UpdateItemCommand(params2));
        }
      }
      console.log(`Updated user data for ${to}`);
    } else if (type === "mint") {
      console.log(`Minted token ${tokenId} to ${to}`);
      const bucket = process.env.BUCKET_NAME;
      const mediumButtKey = `public/images/medium-lazy-butts/${tokenId}.png`;
      const smallButtKey = `public/images/small-lazy-butts/${tokenId}.png`;
      const metadataKey = `public/metadata/${tokenId}.json`;
      try {
        await makeS3ObjectPublic(bucket, mediumButtKey);
      } catch (err) {
        console.error(`Error making S3 object public: ${err}`);
      }
      try {
        await makeS3ObjectPublic(bucket, smallButtKey);
      } catch (err) {
        console.error(`Error making S3 object public: ${err}`);
      }
      try {
        await makeS3ObjectPublic(bucket, metadataKey);
      } catch (err) {
        console.error(`Error making S3 object public: ${err}`);
      }
      console.log(`Set ACLs for token ${tokenId}`);

      // update set of mintedTokens in config table
      const params = {
        TableName: "config",
        Key: {
          setting: {
            S: "tokenConfig",
          },
        },
        UpdateExpression: "ADD #mintedTokens :newToken",
        ExpressionAttributeNames: {
          "#mintedTokens": "mintedTokens",
        },
        ExpressionAttributeValues: {
          ":newToken": {
            NS: [tokenId.toString()],
          },
        },
      };

      const command = new UpdateItemCommand(params);
      const data = await db.send(command);
      console.log(`Updated mintedTokens in config table`);

      // create images
      try {
        const response = await axios({
          method: "post",
          url: `https://api.the3dkings.io/api/create/transparent/${tokenId}`,
          headers: {
            "Content-Type": "application/json",
          },
        });
      } catch (err) {
        console.error(`Error creating images: ${err}`);
      }
    }
  } catch (err) {
    console.error(`Error processing event: ${JSON.stringify(event)}`);
    console.error(`Error detail: ${err}`);
    throw err;
  }
};

function isNonRecoverableError(err) {
  // Replace with your own logic
  // For example, let's consider an error to be non-recoverable if it contains the string 'Duplicate'
  return err.message.includes("Duplicate");
}

const transferEvent = (from, to, tokenId) => {
  eventQueue.enqueue({ type: "transfer", from, to, tokenId });
};

const runEventQueue = async () => {
  while (eventQueue.length > 0) {
    const event = eventQueue.dequeue();
    let retries = 3; // number of retries
    let operationSuccess = false; // flag to indicate successful operation

    while (retries > 0 && !operationSuccess) {
      try {
        await processEvent(event);
        console.log(`Successfully processed event`);
        operationSuccess = true; // set flag to true
      } catch (err) {
        // Check the type of error, if it's a non-recoverable error break out of the loop
        if (isNonRecoverableError(err)) {
          console.error(`Non-recoverable error: ${err}`);
          break;
        }
        retries--;
        console.error(`Error: ${err}`); // log error
        console.error(`Retrying event. Attempts remaining: ${retries}`);
      }
    }
  }
};

async function makeS3ObjectPublic(bucket, key) {
  let retries = 0;
  let retryDelay = INITIAL_RETRY_DELAY;
  console.log(`Making S3 Object Public: Bucket - ${bucket}, Key - ${key}`); // Log to identify the bucket and key

  while (retries < MAX_RETRIES) {
    try {
      const params = {
        Bucket: bucket,
        Key: key,
        ACL: "public-read",
      };
      const command = new PutObjectAclCommand(params);
      const data = await s3.send(command);

      console.log("Successfully made the object public");
      return; // Successfully done
    } catch (error) {
      console.error(
        `Attempt ${
          retries + 1
        } for bucket "${bucket}" and key "${key}" failed:`,
        error
      );
      retries++;

      if (retries >= MAX_RETRIES) {
        console.error(
          `Max retries reached for bucket "${bucket}" and key "${key}", operation failed.`
        );
        throw new Error(
          `Max retries reached for bucket "${bucket}" and key "${key}", operation failed.`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      retryDelay *= 2; // Exponential backoff
    }
  }
}

const mintEvent = async (to, tokenId) => {
  eventQueue.enqueue({ type: "mint", to, tokenId });
};

function setupEventListeners() {
  contract.on("Transfer", (from, to, tokenId) => {
    transferEvent(from, to, tokenId);
  });

  contract.on("Mint", (to, tokenId) => {
    mintEvent(to, tokenId);
  });

  console.log(
    `Set up event listeners for contract ${BUTTS_CONTRACT_ADDRESS}...`
  );
}

async function refreshEventListeners() {
  return new Promise((resolve, reject) => {
    contract.removeAllListeners("Transfer");
    contract.removeAllListeners("Mint");

    resolve();
  })
    .then(() => {
      setupEventListeners();
      console.log("Refreshed event listeners");
    })
    .catch((err) => {
      console.error("Error refreshing event listeners:", err);
    });
}

contract.on("Transfer", (from, to, tokenId) => {
  transferEvent(from, to, tokenId);
});

contract.on("Mint", (to, tokenId) => {
  mintEvent(to, tokenId);
});

function getNext3AMETMillis() {
  const now = new Date();
  const next3AM = new Date(now);

  // Set the time to 3AM
  next3AM.setHours(3, 0, 0, 0);

  // If it's already past 3AM, set the date to the next day
  if (now > next3AM) {
    next3AM.setDate(next3AM.getDate() + 1);
  }

  // Convert Eastern Time to UTC, considering Daylight Saving Time
  const isDST = (function () {
    const jan = new Date(now.getFullYear(), 0, 1).getTimezoneOffset();
    const jul = new Date(now.getFullYear(), 6, 1).getTimezoneOffset();
    return Math.max(jan, jul) !== now.getTimezoneOffset();
  })();

  if (isDST) {
    next3AM.setHours(next3AM.getHours() + 4); // EDT is UTC-4
  } else {
    next3AM.setHours(next3AM.getHours() + 5); // EST is UTC-5
  }

  return next3AM - now;
}

function scheduleRefresh() {
  const millisTillNext3AM = getNext3AMETMillis();

  setTimeout(() => {
    refreshEventListeners();

    // Schedule the next refresh
    scheduleRefresh();
  }, millisTillNext3AM);
}

// Initially start the scheduling
refreshEventListeners();
scheduleRefresh();

setInterval(runEventQueue, 3000);

console.log(`Listening for events on contract ${BUTTS_CONTRACT_ADDRESS}...`);
