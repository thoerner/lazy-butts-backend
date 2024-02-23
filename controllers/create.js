import fs from "fs";
import fsPromises from "fs/promises";
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";
import { downloadFile } from "../utils/ipfsUtils.js";
import s3, { GetObjectCommand } from "../services/s3Service.js";
import { getTokenMetadata } from "../utils/cubMetadata.js";
import { getNFTMetadata } from "../utils/nftMetadata.js";
import { LAZY_LIONS_ADDRESS } from "../utils/consts.js";
import { getMetadataFunction } from "./metadata.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "output");
const downloadDir = path.join(outputDir, "download");
const layersDir = path.join(projectRoot, "layers");
const rexDir = path.join(layersDir, "RexRoar");
const nftLayersDir = path.join(layersDir, "NFT");

async function resizeImage(imageBuffer, width, height) {
  return await sharp(imageBuffer).resize(width, height).png().toBuffer();
}

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

    // Prepare file paths and read files in parallel, only for existing attributes
    let { topPaths, bottomPaths } = prepareImagePaths(
      attributes,
      topNftLayerDir,
      bottomNftLayerDir
    );

    let topImageBuffers = await readAndResizeImages(topPaths, size);
    let bottomImageBuffers = await readAndResizeImages(bottomPaths, size);

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

    const xOffset = (4000 - 2000) / 2;

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

function prepareImagePaths(attributes, topNftLayerDir, bottomNftLayerDir) {
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

  // Prepare top layer paths
  topLayerOrder.forEach((trait) => {
    if (attributes[trait] && attributes[trait] !== "Santa Hat") { // Skip "Santa Hat"
      topPaths[trait] = path.join(topNftLayerDir, trait, `${attributes[trait]}.png`);
    }
  });

  // Prepare bottom layer paths with special handling
  bottomLayerOrder.forEach((bottomTrait) => {
    const attributeKey = bottomTrait.replace("Bottom", "");
    if (attributes[attributeKey]) {
      let bottomDir, fileName;
      switch (attributeKey) {
        case "Background":
          bottomDir = "Butt Background";
          fileName = `${attributes[attributeKey]}.png`;
          break;
        case "Body":
          bottomDir = "Butt";
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
          bottomDir = "Accessories-Safe";
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

  // Adding "Santa Hat" specifically to bottom layers if it exists
  if (attributes["Headgear"] === "Santa Hat") {
    bottomPaths["Santa Hat"] = path.join(bottomNftLayerDir, "Accessories-Safe", "Santa Hat.png");
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
        height: size * 2, // Assuming vertical stacking
        channels: 4,
        background: "transparent",
      },
    })
      .composite([
        { input: topComposite, top: 0, left: 0 },
        { input: bottomComposite, top: size, left: 0 }, // Adjust 'top' for correct positioning
      ])
      .png()
      .toBuffer();

    return finalImage;
  } catch (error) {
    console.error("Error compositing images:", error);
    throw error;
  }
}

async function readAndResizeImages(imagePaths, size) {
  let imageBuffers = {};
  for (const [trait, path] of Object.entries(imagePaths)) {
    try {
      const buffer = await fsPromises.readFile(path);
      const resizedBuffer = await sharp(buffer)
        .resize(size, size)
        .png()
        .toBuffer();
      imageBuffers[trait] = resizedBuffer;
    } catch (error) {
      console.error(`Error processing ${trait}:`, error);
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
