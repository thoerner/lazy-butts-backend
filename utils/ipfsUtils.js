import { create } from "ipfs-http-client";

const ipfs = create({
  host: '127.0.0.1',
  port: '5001',
  protocol: 'http'
});

export async function downloadFile(cid) {
  const chunks = [];
  for await (const chunk of ipfs.cat(cid)) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function downloadJsonFile(cid) {
  const chunks = [];
  for await (const chunk of ipfs.cat(cid)) {
      chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString();
}