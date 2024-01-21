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
import s3, { GetObjectCommand } from "../services/s3Service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "output");
const downloadDir = path.join(outputDir, "download");
const transparentDir = path.join(outputDir, "transparentTop");
const layersDir = path.join(projectRoot, "layers");
const rexDir = path.join(layersDir, "RexRoar");

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

// utility function to get transparent image from S3
async function getTransparentImageFromS3(tokenId) {
  const params = {
    Bucket: "lazybutts",
    Key: `public/images/full-transparent/${tokenId}.png`,
  };
  const command = new GetObjectCommand(params);
  try {
    const data = await s3.send(command);
    const outputPath = path.join(downloadDir, `${tokenId}.png`);
    await fsPromises.writeFile(outputPath, data.Body);
    console.log(
      `Transparent image for token #${tokenId} saved to ${outputPath}`
    );
    return {
      success: true,
      message: `Transparent image for token #${tokenId} saved to ${outputPath}`,
      path: outputPath,
    };
  } catch (error) {
    console.log("An error occurred:", error);
    return {
      success: false,
      message: error,
    };
  }
}

export const createRexRoar = async (req, res) => {
  const { tokenId } = req.params;

  let pathToTransparentImage;

  try {
    const transparentImage = await getTransparentImageFromS3(tokenId);
    if (!transparentImage.success) {
      return res.status(400).json({ error: transparentImage.message });
    }

    pathToTransparentImage = transparentImage.path; // 5000x1000
    const pathToBackgroundImage = path.join(rexDir, "background.png"); // 3800x2400
    const pathToForegroundImage = path.join(rexDir, "foreground.png"); // 3800x2400

    const transparentImageBuffer = await fsPromises.readFile(
      pathToTransparentImage
    );
    const targetWidth = 3800;
    const targetHeight = 2400;
    const offset = 2900;
    const scaleFactor = 0.75;

    const resizedWidth = Math.floor(offset * scaleFactor);
    const resizedHeight = Math.floor(offset * scaleFactor);

    const transparentImageResizedBuffer = await sharp(transparentImageBuffer)
      .resize(resizedWidth, resizedHeight, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .extend({
        top: Math.floor((targetHeight - resizedHeight) / 2),
        bottom: Math.floor((targetHeight - resizedHeight) / 2),
        left: 0,
        right: targetWidth - offset,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    // Read the background and foreground images into buffers
    const backgroundImageBuffer = await fsPromises.readFile(
      pathToBackgroundImage
    );
    const foregroundImageBuffer = await fsPromises.readFile(
      pathToForegroundImage
    );

    // Combine images with sharp directly using buffers
    const combinedImageBuffer = await sharp(backgroundImageBuffer)
      .composite([
        { input: transparentImageResizedBuffer, blend: "over" },
        { input: foregroundImageBuffer, blend: "over" },
      ])
      .png()
      .toBuffer();

    // Set headers to display image in the browser or Postman
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Content-Length": combinedImageBuffer.length,
    });

    // Send the image buffer and end the response
    res.end(combinedImageBuffer);
  } catch (error) {
    console.error("An error occurred:", error);
    return res.status(400).json({ error: error });
  } finally {
    // Delete temporary files
    if (pathToTransparentImage) {
      fsPromises
        .unlink(pathToTransparentImage)
        .then(() => console.log(`Deleted ${pathToTransparentImage}`))
        .catch((err) =>
          console.error(`Error deleting ${pathToTransparentImage}: ${err}`)
        );
    }
  }
};
