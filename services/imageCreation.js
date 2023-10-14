import { s3, GetObjectCommand, PutObjectCommand } from "./s3Service.js";
import axios from "axios";
import fs, { promises as fsPromises } from "fs";
import FormData from "form-data";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const downloadImageFromS3 = async (key, outputPath) => {
  try {
    const params = {
      Bucket: "lazybutts",
      Key: key,
    };
    const command = new GetObjectCommand(params);
    const data = await s3.send(command);
    await fsPromises.writeFile(outputPath, data.Body); // <-- Change here
    console.log(`File ${key} downloaded from S3`);
    return outputPath;
  } catch (err) {
    console.error(err);
  }
};

const uploadImageToS3 = async (key, imagePath, tokenId) => {
  try {
    const fileContent = await fsPromises.readFile(imagePath); // <-- Change here
    const params = {
      Bucket: "lazybutts",
      Key: `${key}${tokenId}.png`,
      Body: fileContent,
      ACL: "public-read",
    };
    const command = new PutObjectCommand(params);
    const data = await s3.send(command);
    console.log(`File ${tokenId}.png uploaded to S3`);
    await fsPromises.unlink(imagePath);
  } catch (err) {
    console.error(err);
  }
};

const createTransparentImage = async (tokenId) => {
  const inputKey = `public/images/full-lions/`;
  const outputKey = `public/images/transparent-full-lions/`;
  const outputPath = path.join(__dirname, "../output/download/");

  const inputPath = await downloadImageFromS3(
    `${inputKey}${tokenId}.png`,
    `${outputPath}${tokenId}.png`
  );

  if (!inputPath) {
    console.error("Failed to download image from S3");
    return;
  }

  const resizedImagePath = `${outputPath}resized_${tokenId}.png`;

  await sharp(inputPath).resize(3535, 7070).toFile(resizedImagePath);

  const formData = new FormData();
  formData.append("size", "full");
  formData.append(
    "image_file",
    fs.createReadStream(resizedImagePath),
    path.basename(resizedImagePath)
  );

  const config = {
    method: "post",
    url: "https://api.remove.bg/v1.0/removebg",
    data: formData,
    responseType: "arraybuffer",
    headers: {
      ...formData.getHeaders(),
      "X-Api-Key": process.env.REMOVE_BG_API_KEY,
    },
    encoding: null,
  };

  axios(config)
    .then((response) => {
      if (response.status != 200)
        return console.error("Error:", response.status, response.statusText);
      const outputPath = path.join(__dirname, "../output/transparent/");
      fs.writeFileSync(`${outputPath}${tokenId}.png`, response.data);
      console.log(`File ${tokenId}.png downloaded from remove.bg`);
      uploadImageToS3(outputKey, `${outputPath}${tokenId}.png`, tokenId).then(
        () => {
          fs.unlinkSync(inputPath);
          fs.unlinkSync(resizedImagePath);
        }
      );
    })
    .catch((error) => {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error("Error Data:", error.response.data.toString("utf8"));
      }
      console.error("Request failed:", error);
    });

  return;
};

const createSeasonalImage = async (tokenId) => {
  return;
};

export const createImages = async (tokenId) => {
  await createTransparentImage(tokenId);
  await createSeasonalImage(tokenId);
};

// createImages(1530);
