import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import s3Client, {
  GetObjectCommand,
  PutObjectCommand,
} from "../services/s3Service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const lionImagesDir = path.join(projectRoot, "output", "transparentTop");
const buttDir = path.join(projectRoot, "output", "buttsNoBackground");
const outputDir = path.join(projectRoot, "output", "fullTransparent");
const bucketKey = "public/images/full-transparent";

const size = 5000; // must match size of bottom half

const uploadImageToS3 = async (imagePath, imageName) => {
  try {
    const fileContent = await fs.readFile(imagePath);
    const params = {
      Bucket: "lazybutts",
      Key: `${bucketKey}/${imageName}.png`,
      Body: fileContent,
    };
    const command = new PutObjectCommand(params);
    const data = await s3Client.send(command);
    console.log(`File ${imageName}.png uploaded to S3`);
    await fs.unlink(imagePath);
  } catch (err) {
    console.error(err);
  }
};

const combineImages = async (tokenId) => {
  try {
    const topHalfPath = path.join(lionImagesDir, `${tokenId}.png`);
    const outputPath = path.join(outputDir, `${tokenId}.png`);
    const bottomHalfPath = path.join(buttDir, `${tokenId}.png`);

    try {
      await fs.access(outputPath);
      console.log(`File ${tokenId}.png already exists, skipping...`);
    } catch (error) {
      // Resize top half
      const topHalf = await sharp(topHalfPath).resize(size, size).toBuffer();

      const bottomHalf = await sharp(bottomHalfPath)
        .extend({
          top: size,
          bottom: 0,
          left: 0,
          right: 0,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .composite([{ input: topHalf, gravity: "north" }])
        .toFile(outputPath, async (err, info) => {
          if (err) console.error(err);
          else {
            console.log(`File ${tokenId}.png saved to ${outputPath}`);
            // await fs.unlink(bottomHalfPath);
            await uploadImageToS3(outputPath, tokenId);
            await fs.unlink(topHalfPath);
            await fs.unlink(bottomHalfPath);
          }
        });
    }
  } catch (err) {
    console.error(err);
  }
};

export default combineImages;

