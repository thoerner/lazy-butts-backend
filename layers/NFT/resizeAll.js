import sharp from "sharp";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const rename = promisify(fs.rename);
const unlink = promisify(fs.unlink);

// Function to resize a single image and replace the original
const resizeImage = async (filePath) => {
  try {
    const tempPath = filePath + '.tmp'; // Temporary file path
    await sharp(filePath)
      .resize(2000, 2000)
      .toFile(tempPath);

    await unlink(filePath); // Remove the original file
    await rename(tempPath, filePath); // Rename the temporary file to the original file path

    console.log(`${filePath} resized and replaced successfully.`);
  } catch (error) {
    console.error(`Error resizing and replacing ${filePath}:`, error);
  }
};

// Recursively find and process PNG files in a directory
const findAndResizePngs = async (directory) => {
  const items = await readdir(directory);
  for (const item of items) {
    const fullPath = path.join(directory, item);
    const itemStats = await stat(fullPath);
    if (itemStats.isDirectory()) {
      await findAndResizePngs(fullPath);
    } else if (itemStats.isFile() && fullPath.endsWith('.png')) {
      await resizeImage(fullPath);
    }
  }
};

findAndResizePngs('.').catch(console.error);
