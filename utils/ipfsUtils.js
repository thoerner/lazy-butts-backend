import { create } from "ipfs-http-client";

const ipfs = create("http://localhost:5001");

export async function downloadFile(cid) {
  const chunks = [];
  for await (const chunk of ipfs.cat(cid)) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
