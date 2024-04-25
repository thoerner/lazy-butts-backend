import path from 'path';
import sharp from 'sharp';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const layersDir = path.join(__dirname, '../layers/lazyLayers');
const size = 5000;

const layerOrder = [
  "Background",
  "Body",
  "Bodygear",
  "Mane",
  "Eyes",
  "Mouth",
  "Earring",
  "Headgear",
];

export async function generateImage(traits) {
  try {
    const layers = layerOrder.map(trait => {
      const traitValue = traits[trait];
      if (!traitValue) return null;
      const filename = `${traitValue}.png`;
      const layerPath = path.join(layersDir, trait, filename);
      if (!fs.existsSync(layerPath)) {
        console.error(`File not found: ${layerPath}`);
        return null;
      }
      return layerPath;
    }).filter(Boolean);

    if (layers.length === 0) {
      throw new Error('No valid image layers found.');
    }

    const compositeLayers = layers.map(layer => ({
      input: layer,
      gravity: 'center'
    }));

    const resizedLayers = await Promise.all(
      compositeLayers.map(layer =>
        sharp(layer.input)
          .resize(size, size)
          .toBuffer()
          .then(buffer => ({ input: buffer, gravity: 'center' }))
      )
    );

    const imageBuffer = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      }
    }).composite(resizedLayers).png().toBuffer();

    return imageBuffer;
  } catch (error) {
    console.error('Error generating image:', error);
    throw error;
  }
}


const traits = {
  "Background": "Gold",
  "Body": "Grey",
  "Bodygear": "Hawaiian Shirt",
  "Eyes": "Shades",
  "Mane": "Black",
  "Mouth": "Big Smile",
  "Earring": "Diamond Stud",
  "Headgear": "Straw Beach Hat"
};

// async function testImageCreation() {
//   try {
//     const imageBuffer = await generateImage(traits);
//     console.log('Writing image to file...'); // Confirm this step is reached
//     fs.writeFileSync('output.png', imageBuffer);
//     console.log('Image written to output.png');
//   } catch (error) {
//     console.error('Failed to create image:', error);
//   }
// }

// testImageCreation();
