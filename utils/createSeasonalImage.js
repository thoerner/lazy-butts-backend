import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import s3Client, {
  GetObjectCommand,
} from "../services/s3Service.js";
import { uploadImageToS3 } from "./uploadToS3.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const metadataDir = path.join(projectRoot, "lazy-butts-md");
const layersDir = path.join(projectRoot, "layers");
const transparentLionBucketKey = "public/images/full-transparent";
const seasonalBucketKey = "public/images/seasonal";

const layerOrder = ["Butt Background"];

const TEMP_FOLDER = path.join(projectRoot, "output", "temp");

const downloadImageFromS3 = async (key, outputPath) => {
  try {
    const params = {
      Bucket: "lazybutts",
      Key: key,
    };
    const command = new GetObjectCommand(params);
    const data = await s3Client.send(command);
    await fs.writeFile(outputPath, data.Body);
    console.log(`File ${key} downloaded from S3`);
    return outputPath;
  } catch (err) {
    console.error(err);
  }
};

const main = async (tokenId, season) => {
  try {
    const filePath = path.join(metadataDir, `${tokenId}.json`);
    const fileContents = await fs.readFile(filePath, "utf8");

    const metadata = JSON.parse(fileContents);

    if (metadata.attributes.length !== 5) return;

    metadata.attributes.sort(
      (a, b) =>
        layerOrder.indexOf(a.trait_type) - layerOrder.indexOf(b.trait_type)
    );

    // first we need to get the butt background type from the metadata
    // look for the Background key in the metadata attributes
    const buttBackground = metadata.attributes.find(
      (item) => item.trait_type === "Butt Background"
    ).value;

    const halloweenBackground = path.join(
      layersDir,
      season,
      `${buttBackground}.png`
    );

    const tempPath = path.join(TEMP_FOLDER, `${tokenId}.png`);

    const transparentLion = await downloadImageFromS3(
      `${transparentLionBucketKey}/${tokenId}.png`,
      tempPath
    );

    const halloweenForeground = path.join(layersDir, season, "Foreground.png");

    const layers = [halloweenBackground, transparentLion, halloweenForeground];

    // create season folder if it doesn't exist
    const seasonFolder = path.join(projectRoot, "output", `${season}`);
    try {
      await fs.access(seasonFolder);
    } catch (error) {
      await fs.mkdir(seasonFolder);
    }

    const outputFilePath = path.join(
      projectRoot,
      "output",
      `${season}`,
      `${tokenId}.png`
    );

    try {
      await fs.access(outputFilePath);
      console.log(`File ${tokenId}.png already exists, skipping...`);
    } catch (error) {
      const compositeLayers = layers.map((layer) => ({
        input: layer,
        gravity: "center",
      }));

      const resizedLayers = await Promise.all(
        compositeLayers.map((layer, index) =>
          sharp(layer.input)
            .metadata()
            .then((metadata) => {
              let newWidth = 2000;
              let newHeight = 2000;

              // If it's the lion layer, resize while maintaining aspect ratio
              if (index === 1) {
                const aspectRatio = metadata.width / metadata.height;
                if (aspectRatio < 1) {
                  // Means it's portrait like the lion
                  newHeight = 2000;
                  newWidth = Math.round(newHeight * aspectRatio);
                } else {
                  newWidth = 2000;
                  newHeight = Math.round(newWidth / aspectRatio);
                }
              }

              return sharp(layer.input).resize(newWidth, newHeight).toBuffer();
            })
            .then((buffer) => ({ input: buffer, gravity: "center" }))
        )
      );

      // Composite the layers
      let processedImage = sharp({
        create: {
          width: 2000,
          height: 2000,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      }).composite(resizedLayers);

      await processedImage.toFile(outputFilePath);

      console.log(`File ${tokenId}.png saved to ${outputFilePath}`);

      await uploadImageToS3(outputFilePath, tokenId, seasonalBucketKey);

      await fs.unlink(tempPath);
      await fs.unlink(outputFilePath);
    }
  } catch (err) {
    console.error(err);
  }
};

export default main;
