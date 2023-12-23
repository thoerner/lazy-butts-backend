import { create } from "ipfs-http-client";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import fsPromises from "fs/promises";
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";
import makeButtNoBG from "../utils/makeButtNoBackground.js";
import combineImages from "../utils/combineTransparent.js";
import makeSeasonalImage from "../utils/createSeasonalImage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "output");
const downloadDir = path.join(outputDir, "download");
const transparentDir = path.join(outputDir, "transparentTop");

const REMOVEBG_API_KEY = process.env.REMOVEBG_API_KEY;

const ipfs = create("http://localhost:5001");

async function downloadFile(cid) {
  const chunks = [];
  for await (const chunk of ipfs.cat(cid)) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function resizeImage(imageBuffer, width, height) {
  return await sharp(imageBuffer).resize(width, height).png().toBuffer();
}

// get metadata from https://metadata.lazylionsnft.com/api/lazylions/{tokenId}
async function getMetadata(tokenId) {
  const url = `https://metadata.lazylionsnft.com/api/lazylions/${tokenId}`;
  const response = await axios.get(url);
  return response.data;
}

const createTransparentTop = async (tokenId) => {
  // get metadata
  const metadata = await getMetadata(tokenId);
  const cid = metadata.image.split("ipfs://")[1];

  // download image
  const imageBuffer = await downloadFile(cid);
  const resizedImageBuffer = await resizeImage(imageBuffer, 500, 500);
  const downloadPath = path.join(downloadDir, `${tokenId}.png`);
  await fsPromises.writeFile(downloadPath, resizedImageBuffer);
  console.log(`Image for token #${tokenId} saved to ${downloadPath}`);

  // remove background
  const formData = new FormData();
  formData.append("size", "auto");
  formData.append(
    "image_file",
    fs.createReadStream(downloadPath),
    path.basename(downloadPath)
  );

  axios({
    method: "post",
    url: "https://api.remove.bg/v1.0/removebg",
    data: formData,
    responseType: "arraybuffer",
    headers: {
      ...formData.getHeaders(),
      "X-Api-Key": REMOVEBG_API_KEY,
    },
    encoding: null,
  })
    .then((response) => {
      if (response.status === 200) {
        const outputPath = path.join(transparentDir, `${tokenId}.png`);
        fsPromises.writeFile(outputPath, response.data);
        console.log(
          `Transparent image for token #${tokenId} saved to ${outputPath}`
        );

        // clean up
        fsPromises.unlink(downloadPath, (err) => {
          if (err) {
            console.error(err);
            return;
          }
        });
      }
    })
    .catch((error) => {
      console.error(`Error removing background for token #${tokenId}:`, error);
    });
};

export const createTransparent = async (req, res) => {
  const { tokenId } = req.params;

  // create transparent image
  console.log(`Creating transparent image for token #${tokenId}`);
  await createTransparentTop(tokenId);

  console.log(`Creating butt image for token #${tokenId}`);
  await makeButtNoBG(tokenId);

  console.log(`Combining images for token #${tokenId}`);
  await combineImages(tokenId);

  console.log("Waiting 10 seconds before creating seasonal image...");
  setTimeout(async () => {
    console.log(`Creating seasonal image for token #${tokenId}`);
    await makeSeasonalImage(tokenId, "Christmas");
  }, 10000);

  // return
  res.send(`Transparent image for token #${tokenId} created`);
};
