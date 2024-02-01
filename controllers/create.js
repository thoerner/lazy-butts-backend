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
import { downloadFile } from "../utils/ipfsUtils.js";
import s3, {
  GetObjectCommand,
  GetObjectAclCommand,
} from "../services/s3Service.js";
import { getTokenMetadata } from "../utils/cubMetadata.js";
import { getNFTMetadata } from "../utils/nftMetadata.js";
import { LAZY_LIONS_ADDRESS } from "../utils/consts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "output");
const downloadDir = path.join(outputDir, "download");
const transparentDir = path.join(outputDir, "transparentTop");
const layersDir = path.join(projectRoot, "layers");
const rexDir = path.join(layersDir, "RexRoar");

const ENV = process.env.ENV;
const REMOVEBG_API_KEY = process.env.REMOVEBG_API_KEY;

async function resizeImage(imageBuffer, width, height) {
  return await sharp(imageBuffer).resize(width, height).png().toBuffer();
}

// get metadata from https://metadata.lazylionsnft.com/api/lazylions/{tokenId}
async function getLazyLionsMetadata(tokenId) {
  const url = `https://metadata.lazylionsnft.com/api/lazylions/${tokenId}`;
  const response = await axios.get(url);
  return response.data;
}

// Helper function to convert a stream to JSON
function streamToJson(stream) {
  return new Promise((resolve, reject) => {
    let rawData = "";
    stream.on("data", (chunk) => (rawData += chunk));
    stream.on("error", reject);
    stream.on("end", () => {
      try {
        const jsonData = JSON.parse(rawData);
        resolve(jsonData);
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function getMetadataFromS3(key) {
  // Define S3 bucket name
  const bucketName = "lazybutts";

  const params = {
    Bucket: bucketName,
    Key: key,
  };

  const command = new GetObjectCommand(params);

  try {
    const data = await s3.send(command);
    return streamToJson(data.Body);
  } catch (error) {
    console.log("An error occurred:", error);
    throw error;
  }
}

async function getPublicMetadataFromS3(key) {
  // Define S3 bucket name
  const bucketName = "lazybutts";

  if (ENV === "dev") {
    return await getMetadataFromS3(key);
  }

  // Set up parameters for checking the ACL (Access Control List)
  const aclParams = {
    Bucket: bucketName,
    Key: key,
  };

  // Create a command to get the ACL for the object
  const aclCommand = new GetObjectAclCommand(aclParams);

  try {
    // Send command to get the ACL for the object
    const aclData = await s3.send(aclCommand);
    // Check if the object is publicly readable
    const Grantee = aclData.Grants.find(
      (grant) =>
        grant.Grantee.URI === "http://acs.amazonaws.com/groups/global/AllUsers"
    );
    if (!(Grantee && Grantee.Permission === "READ")) {
      throw new Error("You are not authorized to view this metadata");
    }

    // Set up parameters to get the object
    const params = {
      Bucket: bucketName,
      Key: key,
    };

    // Create a command to get the object
    const command = new GetObjectCommand(params);

    // Send command to get the object
    const data = await s3.send(command);

    // Read and parse the object body to JSON directly from the stream
    return streamToJson(data.Body);
  } catch (error) {
    console.log("Caught an error:", error.message);
    throw error;
  }
}

const createTransparentTop = async (tokenId) => {
  // get metadata
  const metadata = await getLazyLionsMetadata(tokenId);
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

export const createValentine = async (req, res) => {
  const { tokenId } = req.params;

  console.log(`Creating Valentine image for token #${tokenId}`);

  let metadata;

  try {
    metadata = await getPublicMetadataFromS3(`public/metadata/${tokenId}.json`);
  } catch (error) {
    console.error("An error occurred:", error);
    return res
      .status(400)
      .json({ error: "Metadata for this token is unavailable" });
  }

  let backgroundColor = metadata.attributes.find(
    (attribute) => attribute.trait_type === "Butt Background"
  ).value;

  let pathToTransparentImage;

  let valentinesDir = path.join(layersDir, "Valentines");

  try {
    const transparentImage = await getTransparentImageFromS3(tokenId);
    if (!transparentImage.success) {
      return res.status(400).json({ error: transparentImage.message });
    }

    pathToTransparentImage = transparentImage.path; // 5000x10000

    const pathToBackgroundImage = path.join(
      valentinesDir,
      "backgrounds",
      `${backgroundColor}.png`
    ); // 2000x2000

    const pathToForegroundImage = path.join(valentinesDir, "foreground.png"); // 2000x2000

    const transparentImageBuffer = await fsPromises.readFile(
      pathToTransparentImage
    );

    const targetWidth = 2000;
    const targetHeight = 2000;

    const resizedWidth = Math.floor(targetWidth * 1);
    const resizedHeight = Math.floor(targetHeight * 1);

    const transparentImageResizedBuffer = await sharp(transparentImageBuffer)
      .resize(resizedWidth, resizedHeight, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .extend({
        top: Math.floor((targetHeight - resizedHeight) / 2),
        bottom: Math.floor((targetHeight - resizedHeight) / 2),
        left: Math.floor((targetWidth - resizedWidth) / 2), // Centered horizontally
        right: Math.floor((targetWidth - resizedWidth) / 2), // Centered horizontally
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    const countOfMessages = await fsPromises.readdir(
      path.join(valentinesDir, "messages")
    );

    console.log("countOfMessages:", countOfMessages.length);

    const randomMessageId = Math.floor(Math.random() * countOfMessages.length);

    const messageLayer = await fsPromises.readFile(
      path.join(valentinesDir, "messages", `${randomMessageId}.png`)
    );

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
        { input: messageLayer, blend: "over" },
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

    // Delete temporary files

    fsPromises
      .unlink(pathToTransparentImage)
      .then(() => {
        console.log(`Deleted ${pathToTransparentImage}`);
      })
      .catch((err) =>
        console.error(`Error deleting ${pathToTransparentImage}: ${err}`)
      );
  } catch (error) {
    console.error("An error occurred:", error);
    return res.status(400).json({ error: error });
  }
};

export const createValentineCub = async (req, res) => {
  const { tokenId } = req.params;

  console.log(`Creating Valentine Cub image for token #${tokenId}`);

  let metadata;

  try {
    metadata = await getTokenMetadata(tokenId);
  } catch (error) {
    console.error("An error occurred:", error);
    return res
      .status(400)
      .json({ error: "Metadata for this token is unavailable" });
  }

  console.log("metadata:", metadata);

  let valentinesDir = path.join(layersDir, "Valentines");

  let backgroundColor = metadata.metadata.attributes.find(
    (attribute) => attribute.trait_type === "Background"
  ).value;

  let age = metadata.metadata.attributes.find(
    (attribute) => attribute.trait_type === "Age"
  ).value;

  let imageCid = metadata.metadata.image.split("ipfs://")[1];

  const size = 1100;

  // download image
  const imageBuffer = await downloadFile(imageCid);
  const resizedImageBuffer = await resizeImage(imageBuffer, size, size);

  const pathToBackgroundColor = path.join(
    layersDir,
    "Butt Background",
    `${backgroundColor}.png`
  );

  const backgroundColorBuffer = await fsPromises.readFile(
    pathToBackgroundColor
  );
  const resizedBackgroundColorBuffer = await resizeImage(
    backgroundColorBuffer,
    2000,
    2000
  );

  const pathToBackgroundImage = path.join(
    valentinesDir,
    "backgrounds",
    `${backgroundColor}.png`
  ); // 2000x2000

  const pathToForegroundImage = path.join(valentinesDir, "cub-foreground.png"); // 2000x2000

  // layer image on top of background, then foreground on top of that
  const backgroundImageBuffer = await fsPromises.readFile(
    pathToBackgroundImage
  );

  const foregroundImageBuffer = await fsPromises.readFile(
    pathToForegroundImage
  );

  const countOfMessages = await fsPromises.readdir(
    path.join(valentinesDir, "messages")
  );

  console.log("countOfMessages:", countOfMessages.length);

  const randomMessageId = Math.floor(Math.random() * countOfMessages.length);

  const messageLayer = await fsPromises.readFile(
    path.join(valentinesDir, "messages", `${randomMessageId}.png`)
  );

  const combinedImageBuffer = await sharp(backgroundImageBuffer)
    .composite([
      {
        input: resizedBackgroundColorBuffer,
        blend: "over",
      },
      {
        input: resizedImageBuffer,
        blend: "over",
        top: (2000 - size) / 2 + (age === "Young" ? -100 : -50),
        left: (2000 - size) / 2,
      },
      { input: foregroundImageBuffer, blend: "over" },
      { input: messageLayer, blend: "over" },
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
};

export const createGm = async (req, res) => {
  const { tokenId } = req.params;

  console.log(`Creating GM image for token #${tokenId}`);

  let metadata;

  try {
    metadata = await getNFTMetadata(tokenId, LAZY_LIONS_ADDRESS);
  } catch (error) {
    console.error("An error occurred:", error);
    return res
      .status(400)
      .json({ error: "Metadata for this token is unavailable" });
  }

  const parsedMetadata = JSON.parse(metadata.metadata);

  let bodyAttribute = parsedMetadata.attributes.find(
    (attribute) => attribute.trait_type === "Body"
  );

  if (!bodyAttribute) {
    return res.status(404).send("Body attribute not found");
  }

  let body = bodyAttribute.value;

  let imageCid = parsedMetadata.image.split("ipfs://")[1];

  const size = 2000;

  // download image
  const imageBuffer = await downloadFile(imageCid);
  const baseLayerBuffer = await resizeImage(imageBuffer, size, size);

  const pathToGmImage = path.join(layersDir, "GM", `${body}.png`);

  const gmImageLayer = fs.readFileSync(pathToGmImage);
  const resizedGmImageLayer = await resizeImage(gmImageLayer, size, size);

  const combinedImageBuffer = await sharp(baseLayerBuffer)
    .composite([{ input: resizedGmImageLayer, blend: "over" }])
    .png()
    .toBuffer();

  // Set headers to display image in the browser or Postman
  res.writeHead(200, {
    "Content-Type": "image/png",
    "Content-Length": combinedImageBuffer.length,
  });

  // Send the image buffer and end the response
  res.end(combinedImageBuffer);
};

export const createRexRoar = async (req, res) => {
  const { tokenId } = req.params;

  let pathToTransparentImage;

  try {
    const transparentImage = await getTransparentImageFromS3(tokenId);
    if (!transparentImage.success) {
      return res.status(400).json({ error: transparentImage.message });
    }

    pathToTransparentImage = transparentImage.path; // 5000x10000
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
