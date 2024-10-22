import fs from "fs";
import fsPromises from "fs/promises";
import sharp from "sharp";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { promisify } from "util";
import { fileURLToPath } from "url";
import { downloadFile } from "../utils/ipfsUtils.js";
import s3, { GetObjectCommand } from "../services/s3Service.js";
import { getTokenMetadata } from "../utils/cubMetadata.js";
import { getNFTMetadata } from "../utils/nftMetadata.js";
import { LAZY_LIONS_ADDRESS } from "../utils/consts.js";
import { getMetadataFunction } from "./metadata.js";
import { generateImage } from "../scripts/createCustomLion.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "output");
const downloadDir = path.join(outputDir, "download");
const layersDir = path.join(projectRoot, "layers");
const rexDir = path.join(layersDir, "RexRoar");
const nftLayersDir = path.join(layersDir, "NFT");

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');

async function resizeImage(imageBuffer, width, height) {
  return await sharp(imageBuffer).resize(width, height).png().toBuffer();
}

// Add a new function to generate a custom image based on traits
export const createCustomImage = async (req, res) => {
  const traits = req.body; // Assuming traits are sent as a JSON payload

  // log the traits to the console for debugging
  console.log("Traits received:", traits);

  try {
    // Generate the image buffer using the imported function
    const imageBuffer = await generateImage(traits);

    // save to disk for debugging
    const outputPath = path.join(downloadDir, "custom.png");
    await fsPromises.writeFile(outputPath, imageBuffer);
    console.log(`Custom image saved to ${outputPath}`);

    // Set headers to display image in the browser or via API tools like Postman
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Content-Length": imageBuffer.length,
    });

    // Send the image buffer and end the response
    res.end(imageBuffer);
  } catch (error) {
    console.error("An error occurred during image generation:", error);
    res.status(500).json({ error: error.message });
  }
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
    metadata = await getMetadataFunction(tokenId);
  } catch (error) {
    console.error("An error occurred:", error);
    return res.status(400).json({ error: error });
  }

  if (metadata.error) {
    return res.status(400).json({ error: metadata.error });
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

export const createZiaImage = async (req, res) => {
  const { tokenId, soda } = req.params;

  console.log(`Creating Zia ${soda} image for token #${tokenId}`);

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

  const pathToPawImage = path.join(layersDir, "Paws", `${body}.png`);
  const pawImageLayer = fs.readFileSync(pathToPawImage);
  const resizedPawImageLayer = await resizeImage(pawImageLayer, size, size);

  const pathToZiaImage = path.join(layersDir, "Zia", `${soda}.png`);
  const ziaImageLayer = fs.readFileSync(pathToZiaImage);
  const resizedZiaImageLayer = await resizeImage(ziaImageLayer, size, size);

  const combinedImageBuffer = await sharp(baseLayerBuffer)
    .composite([
      { input: resizedZiaImageLayer, blend: "over"},
      { input: resizedPawImageLayer, blend: "over" }
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
  const resizedGmImageLayer = await resizeImage(gmImageLayer, size, size)

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

export const createCubGm = async (req, res) => {
  const { tokenId } = req.params;

  console.log(`Creating Cub GM image for token #${tokenId}`);

  let metadata;

  try {
    let response = await getTokenMetadata(tokenId);
    if (!response || !response.metadata) {
      throw new Error("Metadata not found for token ID " + tokenId);
    }
    metadata = response.metadata;
  } catch (error) {
    console.error("An error occurred:", error.message);
    return res.status(404).json({
      errorCode: "METADATA_NOT_FOUND",
      error: "Metadata for this token is unavailable",
    });
  }

  const parsedMetadata = metadata;

  if (!parsedMetadata || !parsedMetadata.attributes) {
    return res.status(404).json({
      errorCode: "ATTRIBUTES_NOT_FOUND",
      error: "Attributes for the cub are not available",
    });
  }

  let ageAttribute = parsedMetadata.attributes.find(
    (attribute) => attribute.trait_type === "Age"
  );

  let bodyAttribute = parsedMetadata.attributes.find(
    (attribute) => attribute.trait_type === "Body"
  );

  if (!ageAttribute) {
    return res.status(404).json({
      errorCode: "AGE_ATTRIBUTE_NOT_FOUND",
      error: "Age attribute not found",
    });
  }

  if (!bodyAttribute) {
    return res.status(404).json({
      errorCode: "BODY_ATTRIBUTE_NOT_FOUND",
      error: "Body attribute not found",
    });
  }

  let age = ageAttribute.value;
  let body = bodyAttribute.value;

  let imageCid = parsedMetadata.image.split("ipfs://")[1];

  const size = 2000;

  // download image
  const imageBuffer = await downloadFile(imageCid);
  const baseLayerBuffer = await resizeImage(imageBuffer, size, size);

  let gmLayerPath;

  if (age === "Young") {
    gmLayerPath = path.join(layersDir, "GmMilk", `${body}.png`);
  } else if (age === "Old") {
    gmLayerPath = path.join(layersDir, "GmJuice", `${body}.png`);
  } else {
    return res.status(400).json({
      errorCode: "INVALID_CUB_AGE",
      error: "Cub GMs are only available for Young and Old cubs",
    });
  }

  const gmImageLayer = fs.readFileSync(gmLayerPath);
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

export const createCocoPride = async (req, res) => {
  const { tokenId } = req.params;
  console.log(`Creating Coco Pride image for token #${tokenId}`);

  let metadata;

  try {
    metadata = await getNFTMetadata(tokenId, LAZY_LIONS_ADDRESS);
    const parsedMetadata = JSON.parse(metadata.metadata);
    let attributes = parsedMetadata.attributes.reduce((acc, attribute) => {
      acc[attribute.trait_type] = attribute.value.trim();
      return acc;
    }, {});

    // Define directories
    let topNftLayerDir = path.join(nftLayersDir, "Top");
    let bottomNftLayerDir = path.join(nftLayersDir, "Bottom");

    let size = 2000;

    const skippedTraitValues = ["Santa Hat"];
    const skippedTraitTypes = [];

    // Prepare file paths and read files in parallel, only for existing attributes
    let { topPaths, bottomPaths } = prepareImagePaths(
      attributes,
      topNftLayerDir,
      bottomNftLayerDir,
      skippedTraitValues,
      skippedTraitTypes,
      "Santa Hat"
    );

    let topImageBuffers = await readImages(topPaths, size);
    let bottomImageBuffers = await readImages(bottomPaths, size);

    // Composite images
    const combinedImageBuffer = await compositeImages(
      topImageBuffers,
      bottomImageBuffers,
      size
    );

    let backgroundColor = attributes["Background"];

    const pathToBackgroundImage = path.join(
      layersDir,
      "CocoPride",
      "backgrounds",
      `${backgroundColor}.png`
    );

    const backgroundImageBuffer = await fsPromises.readFile(
      pathToBackgroundImage
    );

    const pathToForegroundImage = path.join(
      layersDir,
      "CocoPride",
      "foreground.png"
    );

    const foregroundImageBuffer = await fsPromises.readFile(
      pathToForegroundImage
    );

    const xOffset = size / 2;

    const finalImageBuffer = await sharp(backgroundImageBuffer)
      .composite([
        {
          input: combinedImageBuffer,
          top: 0,
          left: xOffset,
        },
        {
          input: foregroundImageBuffer,
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer();

    // Send image response
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Content-Length": finalImageBuffer.length,
    });
    res.end(finalImageBuffer);
  } catch (error) {
    console.error("An error occurred:", error);
    res.status(400).json({ error: "Failed to create image" });
  }
};

export const createSpringImage = async (req, res) => {
  const { tokenId } = req.params;
  console.log(`Creating Spring image for token #${tokenId}`);

  let metadata;

  try {
    metadata = await getNFTMetadata(tokenId, LAZY_LIONS_ADDRESS);
    const parsedMetadata = JSON.parse(metadata.metadata);
    let attributes = parsedMetadata.attributes.reduce((acc, attribute) => {
      acc[attribute.trait_type] = attribute.value.trim();
      return acc;
    }, {});

    // Define directories
    let topNftLayerDir = path.join(nftLayersDir, "Top");
    let bottomNftLayerDir = path.join(nftLayersDir, "Bottom");

    let size = 2000;

    const skippedTraitValues = [];
    const skippedTraitTypes = ["Headgear"];

    // Prepare file paths and read files in parallel, only for existing attributes
    let { topPaths, bottomPaths } = prepareImagePaths(
      attributes,
      topNftLayerDir,
      bottomNftLayerDir,
      skippedTraitValues,
      skippedTraitTypes,
      "Bunny Ears"
    );

    let topImageBuffers = await readImages(topPaths, size);
    let bottomImageBuffers = await readImages(bottomPaths, size);

    // Composite images
    const combinedImageBuffer = await compositeImages(
      topImageBuffers,
      bottomImageBuffers,
      size
    );

    let backgroundColor = attributes["Background"];

    const pathToBackgroundImage = path.join(
      layersDir,
      "Spring",
      "backgrounds",
      `${backgroundColor}.jpg`
    );

    const backgroundImageBuffer = await fsPromises.readFile(
      pathToBackgroundImage
    );

    const pathToForegroundImage = path.join(
      layersDir,
      "Spring",
      "foreground.png"
    );

    const foregroundImageBuffer = await fsPromises.readFile(
      pathToForegroundImage
    );

    const xOffset = size / 2;

    const finalImageBuffer = await sharp(backgroundImageBuffer)
      .composite([
        {
          input: combinedImageBuffer,
          top: 0,
          left: xOffset,
        },
        {
          input: foregroundImageBuffer,
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer();

    // Send image response
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Content-Length": finalImageBuffer.length,
    });
    res.end(finalImageBuffer);
  } catch (error) {
    console.error("An error occurred:", error);
    res.status(400).json({ error: "Failed to create image" });
  }
};

export const createSummerVideo = async (req, res) => {
  const { tokenId } = req.params;
  console.log(`Creating Summer video for token #${tokenId}`);

  let metadata;
  let middleLayerBuffer;
  let tempMiddleLayerPath;
  let tempOutputVideoPath;
  let outputVideoPath;

  try {
    metadata = await getNFTMetadata(tokenId, LAZY_LIONS_ADDRESS);
    const parsedMetadata = JSON.parse(metadata.metadata);
    let attributes = parsedMetadata.attributes.reduce((acc, attribute) => {
      acc[attribute.trait_type] = attribute.value.trim();
      return acc;
    }, {});

    // Define directories
    let topNftLayerDir = path.join(nftLayersDir, "Top");
    let bottomNftLayerDir = path.join(nftLayersDir, "Bottom");

    let size = 2000;

    const skippedTraitValues = [];
    const skippedTraitTypes = [];

    // Prepare file paths and read files in parallel, only for existing attributes
    let { topPaths, bottomPaths } = prepareImagePaths(
      attributes,
      topNftLayerDir,
      bottomNftLayerDir,
      skippedTraitValues,
      skippedTraitTypes
    );

    let topImageBuffers = await readImages(topPaths, size);
    let bottomImageBuffers = await readImages(bottomPaths, size);

    // Composite images
    const combinedImageBuffer = await compositeImages(
      topImageBuffers,
      bottomImageBuffers,
      size
    );

    middleLayerBuffer = combinedImageBuffer;

    const inputVideoPath = path.join(
      __dirname,
      "..",
      "layers",
      "Summer",
      "background-animated.webm"
    );
    const overlayImagePath = path.join(
      __dirname,
      "..",
      "layers",
      "Summer",
      "foreground.png"
    );
    const audioTrackPath = path.join(
      __dirname,
      "..",
      "layers",
      "Summer",
      "fireworks-4s2.mp3"
    );
    tempOutputVideoPath = path.join(
      __dirname,
      "..",
      "output",
      "summer-video",
      `${tokenId}_temp.mp4`
    );
    outputVideoPath = path.join(
      __dirname,
      "..",
      "output",
      "summer-image",
      `${tokenId}_overlay.mp4`
    );
    tempMiddleLayerPath = path.join(
      __dirname,
      "..",
      "output",
      "summer-image",
      `${tokenId}_middle_temp.png`
    );

    if (!fs.existsSync(inputVideoPath)) {
      return res.status(404).json({ error: "Input video not found" });
    }

    if (!fs.existsSync(overlayImagePath)) {
      return res.status(404).json({ error: "Overlay image not found" });
    }

    console.log("Middle layer created successfully");

    // Resize middle layer buffer to 2000x4000
    const resizedMiddleLayerBuffer = await sharp(middleLayerBuffer)
      .resize(500, 1000)
      .toBuffer();

    const background = sharp({
      create: {
        width: 1000,
        height: 1000,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    });

    console.log("Middle layer resized successfully");
    // Composite the resized image onto the transparent background
    await background
      .composite([{ input: resizedMiddleLayerBuffer, left: 250, top: 0 }])
      .png()
      .toFile(tempMiddleLayerPath);

    console.log("Middle layer created successfully");

    await new Promise((resolve, reject) => {
      console.log("Creating video...");
      ffmpeg(inputVideoPath)
        .input(tempMiddleLayerPath)
        .input(overlayImagePath)
        .complexFilter(
          ["[0:v][1:v]overlay=0:0[temp1]", "[temp1][2:v]overlay=0:0[out]"],
          ["out"]
        )
        .outputOptions("-c:a copy")
        .save(tempOutputVideoPath)
        .on("end", resolve)
        .on("error", reject);
    });

    console.log("Video created successfully");

    // add audio track to the video
    await new Promise((resolve, reject) => {
      console.log("Adding audio track...");
      ffmpeg(tempOutputVideoPath)
        .input(audioTrackPath)
        .outputOptions("-shortest")
        .save(outputVideoPath)
        .on("end", resolve)
        .on("error", reject);
    });

    console.log("Audio track added successfully");

    // Stream the result back to the client
    const stat = fs.statSync(outputVideoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    console.log("Streaming video...");

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(outputVideoPath, { start, end });
      const head = {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": "video/mp4",
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        "Content-Length": fileSize,
        "Content-Type": "video/mp4",
      };
      res.writeHead(200, head);
      fs.createReadStream(outputVideoPath).pipe(res);
    }
  } catch (error) {
    console.error("An error occurred:", error);
    res.status(500).json({ error: "Failed to create summer video" });
  } finally {
    // Clean up temporary files
    if (tempMiddleLayerPath && fs.existsSync(tempMiddleLayerPath)) {
      await unlink(tempMiddleLayerPath);
    }
    if (tempOutputVideoPath && fs.existsSync(tempOutputVideoPath)) {
      await unlink(tempOutputVideoPath);
    }
    if (outputVideoPath && fs.existsSync(outputVideoPath)) {
      await unlink(outputVideoPath);
    }
  }
};

export const createHalloweenImage = async (req, res) => {
  const { tokenId } = req.params;
  console.log(`Creating Halloween image for token #${tokenId}`);

  try {
    // Fetch and parse metadata
    const metadata = await getNFTMetadata(tokenId, LAZY_LIONS_ADDRESS);
    const parsedMetadata = JSON.parse(metadata.metadata);
    const attributes = parsedMetadata.attributes.reduce((acc, attribute) => {
      acc[attribute.trait_type] = attribute.value.trim();
      return acc;
    }, {});

    // Define directories
    const topNftLayerDir = path.join(nftLayersDir, "Top");
    const bottomNftLayerDir = path.join(nftLayersDir, "Bottom");
    const halloweenDir = path.join(layersDir, "Halloween2");
    const size = 2000;

    // Prepare image paths
    let { topPaths, bottomPaths } = prepareImagePaths(
      attributes,
      topNftLayerDir,
      bottomNftLayerDir,
      [],
      [],
      "Accessories"
    );

    // Replace lion skin with zombie-green layers
    topPaths["Body"] = path.join(halloweenDir, "zombie-green-upper-2k.png");
    bottomPaths["BottomBody"] = path.join(halloweenDir, "zombie-green-lower-2k.png");

    // Read images
    const topImageBuffers = await readImages(topPaths);
    const bottomImageBuffers = await readImages(bottomPaths);

    // Composite images (stack vertically)
    const combinedImageBuffer = await compositeImages(
      topImageBuffers,
      bottomImageBuffers,
      size
    );

    // Resize the combined image to fit within 2000x2000 pixels
    const resizedCombinedImageBuffer = await sharp(combinedImageBuffer)
      .resize(2000, 2000, {
        fit: 'inside',
      })
      .toBuffer();

    // Get metadata of resizedCombinedImageBuffer
    const resizedCombinedImageMetadata = await sharp(resizedCombinedImageBuffer).metadata();
    console.log('Resized Combined Image dimensions:', resizedCombinedImageMetadata.width, 'x', resizedCombinedImageMetadata.height);

    // Extend the canvas to 2000x2000 pixels if necessary
    const extendedCombinedImageBuffer = await sharp(resizedCombinedImageBuffer)
      .extend({
        top: Math.floor((2000 - resizedCombinedImageMetadata.height) / 2),
        bottom: Math.ceil((2000 - resizedCombinedImageMetadata.height) / 2),
        left: Math.floor((2000 - resizedCombinedImageMetadata.width) / 2),
        right: Math.ceil((2000 - resizedCombinedImageMetadata.width) / 2),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .toBuffer();

    // Read and resize background and foreground images
    const backgroundColor = attributes["Background"];
    const pathToBackgroundImage = path.join(
      halloweenDir,
      "Background",
      `${backgroundColor}.png`
    );
    const backgroundImageBuffer = await fsPromises.readFile(pathToBackgroundImage);
    const resizedBackgroundImageBuffer = await sharp(backgroundImageBuffer)
      .resize(size, size)
      .toBuffer();

    const pathToForegroundImage = path.join(halloweenDir, "foreground.png");
    const foregroundImageBuffer = await fsPromises.readFile(pathToForegroundImage);
    const resizedForegroundImageBuffer = await sharp(foregroundImageBuffer)
      .resize(size, size)
      .toBuffer();

    // Get metadata of background and foreground images
    const resizedBackgroundImageMetadata = await sharp(resizedBackgroundImageBuffer).metadata();
    console.log('Resized Background Image dimensions:', resizedBackgroundImageMetadata.width, 'x', resizedBackgroundImageMetadata.height);

    const resizedForegroundImageMetadata = await sharp(resizedForegroundImageBuffer).metadata();
    console.log('Resized Foreground Image dimensions:', resizedForegroundImageMetadata.width, 'x', resizedForegroundImageMetadata.height);

    // Composite the final image
    const finalImageBuffer = await sharp(resizedBackgroundImageBuffer)
      .composite([
        { input: resizedForegroundImageBuffer, top: 0, left: 0 },
        { input: extendedCombinedImageBuffer, top: 0, left: 0 },
      ])
      .png()
      .toBuffer();

    // Send image response
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Content-Length": finalImageBuffer.length,
    });
    res.end(finalImageBuffer);
  } catch (error) {
    console.error("An error occurred:", error);
    res.status(400).json({ error: "Failed to create Halloween image" });
  }
};

function prepareImagePaths(
  attributes,
  topNftLayerDir,
  bottomNftLayerDir,
  skippedTraitValues,
  skippedTraitTypes,
  includeSafeHat
) {
  const topLayerOrder = [
    // "Background",
    "Body",
    "Bodygear",
    "Mane",
    "Earring",
    "Eyes",
    "Headgear",
    "Mouth",
  ];

  const bottomLayerOrder = [
    // "BottomBackground",
    "BottomBody",
    "BottomMane",
    "BottomBodygear",
    "BottomHeadgear",
  ];

  let topPaths = {};
  let bottomPaths = {};
  let headgearTrait = "";

  // Prepare top layer paths
  topLayerOrder.forEach((trait) => {
    if (
      attributes[trait] &&
      !skippedTraitValues.includes(attributes[trait]) &&
      !skippedTraitTypes.includes(trait)
    ) {
      topPaths[trait] = path.join(
        topNftLayerDir,
        trait,
        `${attributes[trait]}.png`
      );
    }
    if (trait === "Headgear") {
      headgearTrait = attributes[trait];
    }
  });

  // Prepare bottom layer paths with special handling
  bottomLayerOrder.forEach((bottomTrait) => {
    const attributeKey = bottomTrait.replace("Bottom", "");
    if (
      attributes[attributeKey] &&
      !skippedTraitValues.includes(attributes[attributeKey]) &&
      !skippedTraitTypes.includes(attributeKey)
    ) {
      let bottomDir, fileName;
      switch (attributeKey) {
        case "Background":
          bottomDir = "Butt Background";
          fileName = `${attributes[attributeKey]}.png`;
          break;
        case "Body":
          bottomDir = "Butt - No Shadow";
          fileName = `${attributes[attributeKey]} Butt.png`;
          break;
        case "Mane":
          // Assuming mane attributes include color in their name, e.g., "Green Mane"
          const colorMatch = attributes[attributeKey].match(/(\w+)$/);
          const color = colorMatch
            ? colorMatch[1] === "Gold"
              ? "Black And Gold"
              : colorMatch[1]
            : "Default";
          bottomDir = "Tail Tuft";
          fileName = `${color}.png`;
          break;
        case "Headgear":
          console.log("includeSafeHat", includeSafeHat);
          bottomDir = includeSafeHat === "Accessories" ? "Accessories" : "Accessories-Safe";
          fileName = transformAccessories(attributes[attributeKey]);
          break;
        case "Bodygear":
          bottomDir = "Bodygear Bottom";
          fileName = transformBodygear(attributes[attributeKey]);
          break;
        default:
          bottomDir = "";
          fileName = `${attributes[attributeKey]}.png`;
          break;
      }
      if (bottomDir && fileName) {
        bottomPaths[bottomTrait] = path.join(
          bottomNftLayerDir,
          bottomDir,
          fileName
        );
      }
    }
  });

  // Adding "Santa Hat" specifically to bottom layers if it exists and includeSafeHat is true
  if (
    attributes["Headgear"] === "Santa Hat" &&
    includeSafeHat === "Santa Hat"
  ) {
    bottomPaths["Santa Hat"] = path.join(
      bottomNftLayerDir,
      "Accessories-Safe",
      "Santa Hat.png"
    );
  }

  // Adding "Bunny Ears" specifically to top layers if it exists and includeSafeHat is "Bunny Ears"
  if (includeSafeHat === "Bunny Ears") {
    topPaths[headgearTrait] = path.join(
      topNftLayerDir,
      "Headgear",
      "Bunny Ears.png"
    );
  }

  return { topPaths, bottomPaths };
}

async function compositeImages(topImageBuffers, bottomImageBuffers, size) {
  try {
    // Convert object of buffers into an array of { input: buffer } objects for top layers
    const topLayers = Object.values(topImageBuffers).map((buffer) => ({
      input: buffer,
    }));

    // Do the same for bottom layers
    const bottomLayers = Object.values(bottomImageBuffers).map((buffer) => ({
      input: buffer,
    }));

    // Composite the top part
    const topComposite = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: "transparent",
      },
    })
      .composite(topLayers)
      .png()
      .toBuffer();

    // Composite the bottom part
    const bottomComposite = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: "transparent",
      },
    })
      .composite(bottomLayers)
      .png()
      .toBuffer();

    // Now combine top and bottom composites vertically
    const finalImage = await sharp({
      create: {
        width: size,
        height: size * 2,
        channels: 4,
        background: "transparent",
      },
    })
      .composite([
        { input: topComposite, top: 0, left: 0 },
        { input: bottomComposite, top: size, left: 0 },
      ])
      .png()
      .toBuffer();

    return finalImage;
  } catch (error) {
    console.error("Error compositing images:", error);
    throw error;
  }
}

async function readImages(imagePaths) {
  let imageBuffers = {};
  for (const [trait, imagePath] of Object.entries(imagePaths)) {
    try {
      const buffer = await fsPromises.readFile(imagePath);
      const metadata = await sharp(buffer).metadata();
      console.log(`Read image for trait "${trait}" from "${imagePath}": ${metadata.width}x${metadata.height}`);
      imageBuffers[trait] = buffer;
    } catch (error) {
      console.error(`Error processing ${trait} at ${imagePath}:`, error);
    }
  }
  return imageBuffers;
}


function transformBodygear(bodygearName) {
  const bodygearMappings = {
    "Black Hoodie": "Black Hoodie Bottom.png",
    "Business Shirt": "Business Bottom.png",
    "Chef Uniform": "Chef Bottom.png",
    "Coconut Bra": "Coco Bottom.png",
    "Ethereum Business Shirt": "Ethereum Business Bottom.png",
    "Ethereum Shirt": "Ethereum Bottom.png",
    Floaties: "Floaty Bottom.png",
    "Football Jersey - Blue": "Blue Jersey Bottom.png",
    "Football Jersey - Red": "Red Jersey Bottom.png",
    "Gladiator Armour": "Armour Bottom.png",
    "Gold Chain": "Gold Chain Bottom.png",
    "Hawaiian Shirt": "Hawaiian Shorts.png",
    "Lab Coat": "Lab Coat Bottom.png",
    Lederhosen: "Lederhosen Bottom.png",
    "Leopard Fur Coat": "Leopard Coat Bottom.png",
    "Lion Shirt": "Lion Pants.png",
    "Police Uniform": "Police Pants.png",
    "Purple Fur Coat": "Purple Fur Coat Bottom.png",
    "Ranger Shirt": "Ranger Pants.png",
    "Referee shirt": "Referee Pants.png",
    "Ripped Shirt - Black": "Black Ripped Jeans.png",
    "Ripped Shirt - White": "White Ripped Jeans.png",
    "Space Suit": "Space Suit Bottom.png",
    // Assuming "Nothing" maps directly or has no bottom equivalent
    Nothing: "Nothing Bottom.png",
  };

  // Default transformation assuming most names map directly by appending " Bottom"
  return bodygearMappings[bodygearName] || `${bodygearName} Bottom.png`;
}

function transformAccessories(headgearName) {
  const accessoriesMappings = {
    "Black Cap": "Black High Tops.png",
    "Bucket Hat": "Boombox.png",
    "Bunny Ears": "Carrot.png",
    Crown: "Scepter.png",
    Halo: "Harp.png",
    Horns: "Hooves.png",
    "LAZY Hat": "LAZY Sneakers.png",
    Nothing: "Nothing.png",
    "Party Hat": "Party Balloon.png",
    "Pirate Hat": "Parrot and Cutlass.png",
    "Police Hat": "Baton and Flashlight.png",
    "Safari Hat": "Binoculars and Field Guide.png",
    "Santa Hat": "Toy Bag and Boots.png",
    "Sea Captain Hat": "Anchor with Rope.png",
    "Sheriff Hat": "Revolver and Boots.png",
    "Spinner Hat": "Puzzle Cube.png",
    "Straw Beach Hat": "Rum Bottle and Flip Flops.png",
    "Top Hat": "Fancy Cane.png",
    "Wizard Hat": "Magic Wand.png",
  };

  // Return the corresponding accessory, defaulting to "Nothing.png" if not found
  return accessoriesMappings[headgearName] || "Nothing.png";
}

