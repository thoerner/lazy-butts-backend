import provider from "./ethService.js";
import db, {
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from "./dbService.js";
import { Contract, ZeroAddress } from "ethers";
import LazyButtsAbi from "../contracts/LazyButts.json" assert { type: "json" };
import logger from "./logger.js";

const BUTTS_CONTRACT_ADDRESS =
  process.env.ENV === "dev"
    ? process.env.BUTTS_CONTRACT_ADDRESS_TEST
    : process.env.BUTTS_CONTRACT_ADDRESS;

const contract = new Contract(BUTTS_CONTRACT_ADDRESS, LazyButtsAbi, provider);

const getTableName = (baseName) => {
  return process.env.ENV === 'dev' ? `${baseName}-test` : baseName;
};

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
      logger.info(`Transferred token ${tokenId} from ${from} to ${to}`);
      const getItemCommand = new GetItemCommand({
        TableName: getTableName("users"),
        Key: {
          address: { S: to },
        },
      });
      const userData = await db.send(getItemCommand);

      if (userData.Item === undefined) {
        const putParams = {
          TableName: getTableName("users"),
          Item: {
            address: { S: to },
            butts: { L: [{ N: tokenId.toString() }] },
          },
        };
        await db.send(new PutItemCommand(putParams));
      } else {
        const updateParams = {
          TableName: getTableName("users"),
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
            TableName: getTableName("users"),
            Key: { address: { S: from } },
          })
        );
        const butts = fromUserData.Item.butts.L;
        const index = butts.findIndex((butt) => Number(butt.N) === tokenId);

        if (index > -1) {
          const params2 = {
            TableName: getTableName("users"),
            Key: { address: { S: from } },
            UpdateExpression: `REMOVE #butts[${index}]`,
            ExpressionAttributeNames: { "#butts": "butts" },
          };
          await db.send(new UpdateItemCommand(params2));
        }
      }
      logger.info(`Updated user data for ${to}`);
    } else if (type === "mint") {
      logger.info(`Minted token ${tokenId} to ${to}`);

      // update set of mintedTokens in config table
      const params = {
        TableName: getTableName("config"),
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
      await db.send(command);
      logger.info(`Updated mintedTokens in config table`);
    }
  } catch (err) {
    logger.error(`Error processing event: ${JSON.stringify(event)}`);
    logger.error(`Error detail: ${err}`);
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
        logger.info(`Successfully processed event`);
        operationSuccess = true; // set flag to true
      } catch (err) {
        // Check the type of error, if it's a non-recoverable error break out of the loop
        if (isNonRecoverableError(err)) {
          logger.error(`Non-recoverable error: ${err}`);
          break;
        }
        retries--;
        logger.error(`Error: ${err}`); // log error
        logger.error(`Retrying event. Attempts remaining: ${retries}`);
      }
    }
  }
};

const mintEvent = async (to, tokenId) => {
  eventQueue.enqueue({ type: "mint", to, tokenId });
};

let transferListener;
let mintListener;

function setupEventListeners() {
  transferListener = (from, to, tokenId) => {
    transferEvent(from, to, tokenId);
  };

  mintListener = (to, tokenId) => {
    mintEvent(to, tokenId);
  };

  contract.on("Transfer", transferListener);
  contract.on("Mint", mintListener);

  logger.info(
    `Set up event listeners for contract ${BUTTS_CONTRACT_ADDRESS}...`
  );
}

async function refreshEventListeners() {
  try {
    logger.info("Starting to refresh event listeners...");

    // Remove listeners using the stored references
    contract.removeListener("Transfer", transferListener);
    contract.removeListener("Mint", mintListener);
    logger.info("Removed event listeners.");

    // Check the listener count for each event
    const transferListenerCount = await contract.listenerCount("Transfer");
    const mintListenerCount = await contract.listenerCount("Mint");
    logger.info(`Transfer listener count: ${transferListenerCount}`);
    logger.info(`Mint listener count: ${mintListenerCount}`);
    if (transferListenerCount > 0 || mintListenerCount > 0) {
      logger.error("Listeners were not removed properly!");
    }

    // Re-setup the listeners
    setupEventListeners();
    logger.info("Re-setup event listeners.");

    // Verify that listeners are added
    const newTransferListenerCount = await contract.listenerCount("Transfer");
    const newMintListenerCount = await contract.listenerCount("Mint");
    logger.info(`New Transfer listener count: ${newTransferListenerCount}`);
    logger.info(`New Mint listener count: ${newMintListenerCount}`);
    if (newTransferListenerCount <= 0 || newMintListenerCount <= 0) {
      logger.error("Listeners were not added properly!");
    }
  } catch (error) {
    logger.error("Error during refreshing event listeners:", error);
  }
}

function scheduleRefresh() {
  const REFRESH_INTERVAL = 3600000; // 1 hour

  setTimeout(() => {
    logger.info("Scheduling a refresh of event listeners...");
    refreshEventListeners();
    scheduleRefresh();
  }, REFRESH_INTERVAL);
}

// Initially start the scheduling
setupEventListeners();
scheduleRefresh();

runEventQueue();
setInterval(runEventQueue, 3000);

logger.info(`Listening for events on contract ${BUTTS_CONTRACT_ADDRESS}...`);
