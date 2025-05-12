import { create } from "ipfs-http-client";
import axios from "axios";

const ipfs = create({
  host: "127.0.0.1",
  port: "5001",
  protocol: "http",
});

export async function downloadFile(cid) {
  console.log("downloading file from ipfs:", cid);
  const chunks = [];
  for await (const chunk of ipfs.cat(cid)) {
    console.log("chunk:", chunk);
    chunks.push(chunk);
  }
  console.log("chunks:", chunks);
  return Buffer.concat(chunks);
}

export async function downloadJsonFile(cid) {
  const chunks = [];
  for await (const chunk of ipfs.cat(cid)) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString();
}

export async function downloadFileFromPinata(cid) {
  // IPFS.io gateway URL
  const url = `https://ipfs.io/ipfs/${cid}`;
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
    },
  });
  return Buffer.from(response.data);
}

export async function downloadJsonFileFromPinata(cid) {
  // IPFS.io gateway URL
  const url = `https://ipfs.io/ipfs/${cid}`;
  const response = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
    },
  });
  return typeof response.data === "string"
    ? response.data
    : JSON.stringify(response.data);
}
