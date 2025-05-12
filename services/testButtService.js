import provider from "./ethService.js";
import {
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from "./dbService.js";
import { PutObjectAclCommand } from "./s3Service.js";
import axios from "axios";
import { Contract, ZeroAddress } from "ethers";
import LazyButtsAbi from "../contracts/LazyButts.json" with { type: "json" };

// Mock versions of your AWS services for testing
const db = {
  send: (command) => {
    console.log(`Mock DB command: ${command.constructor.name}`, command);
    return Promise.resolve(); // Simulate successful operation
  },
};

const s3 = {
  send: (command) => {
    console.log(`Mock S3 command: ${command.constructor.name}`, command);
    return Promise.resolve(); // Simulate successful operation
  },
};

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

// Custom replacer function for JSON.stringify to handle BigInt
function replacer(key, value) {
  if (typeof value === 'bigint') {
    return value.toString();
  } else {
    return value;
  }
}

// Adjusted processEvent for testing
const processEvent = async (event) => {
  // ... [rest of the code]

  try {
    console.log(`Mock processing event: ${JSON.stringify(event, replacer)}`);
    // Add mock logic here if needed to simulate processing
  } catch (err) {
    console.error(`Mock error processing event: ${JSON.stringify(event, replacer)}`);
    console.error(`Error detail: ${err}`);
    // throw err; // Depending on your testing, you might want to comment this out
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

// Adjusted refreshEventListeners for testing
async function refreshEventListeners() {
  try {
    console.log("Starting to refresh event listeners...");

    // Actually remove listeners
    contract.removeAllListeners("Transfer");
    contract.removeAllListeners("Mint");
    console.log("Removed all event listeners.");

    // Check the listener count, should be 0 if all were removed
    const listenerCount = await contract.listenerCount();
    console.log(`Current listener count: ${listenerCount}`);
    if (listenerCount > 0) {
      console.error("Listeners were not removed properly!");
    }

    // Re-setup the listeners
    setupEventListeners();
    console.log("Re-setup event listeners.");

    // Verify that listeners are added
    const newListenerCount = await contract.listenerCount();
    console.log(`New listener count: ${newListenerCount}`);
    if (newListenerCount <= 0) {
      console.error("Listeners were not added properly!");
    }
  } catch (error) {
    console.error("Error during refreshing event listeners:", error);
  }
}


// Shorten the refresh interval for testing
function scheduleRefresh() {
  const TEST_INTERVAL = 30000; // 30 seconds for testing

  setTimeout(() => {
    console.log("Scheduling a refresh of event listeners...");
    refreshEventListeners();
    scheduleRefresh();
  }, TEST_INTERVAL);
}

// Initially start the scheduling
setupEventListeners();
scheduleRefresh();

runEventQueue();
// Change the interval for running the event queue
setInterval(() => {
  console.log("Running the event queue...");
  runEventQueue();
}, 3000); // 3 seconds for testing

console.log(`Listening for events on contract ${BUTTS_CONTRACT_ADDRESS}...`);