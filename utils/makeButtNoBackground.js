import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
// import tokenIds from './retry.json' assert { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const metadataDir = path.join(__dirname, "../lazy-butts-md");
const layersDir = path.join(__dirname, "../layers");
const outputDir = path.join(__dirname, "../output/buttsNoBackground/");
const size = 5000;

const layerOrder = [
  "Butt Background",
  "Butt",
  "Tail Tuft",
  "Bodygear Bottom",
  "Accessories",
];

const main = async (tokenId) => {
  try {
    const fileName = `${tokenId}.json`;
    const filePath = path.join(metadataDir, fileName);

    try {
      const fileContents = await fs.readFile(filePath, "utf8");
      const metadata = JSON.parse(fileContents);

      if (metadata.attributes.length !== 5) return;

      // remove "Butt Background" from the attributes
      metadata.attributes = metadata.attributes.filter(
        (attribute) => attribute.trait_type !== "Butt Background"
      );

      metadata.attributes.sort(
        (a, b) =>
          layerOrder.indexOf(a.trait_type) - layerOrder.indexOf(b.trait_type)
      );

      const buttIndex = metadata.attributes.findIndex(
        (attribute) => attribute.trait_type === "Butt"
      );

      metadata.attributes[buttIndex].trait_type = "Butt - No Shadow";
      
      const layers = metadata.attributes.map((attribute) => {
        const dir = path.join(layersDir, attribute.trait_type);
        const filename = `${attribute.value}.png`;

        return path.join(dir, filename);
      });

      console.log(layers)

      const outputFilePath = path.join(
        outputDir,
        `${tokenId}.png`
      );

      try {
        await fs.access(outputFilePath);
        console.log(
          `File ${tokenId}.png already exists, skipping...`
        );
      } catch (error) {
        const compositeLayers = layers.map((layer) => ({
          input: layer,
          gravity: "center",
        }));

        const resizedLayers = await Promise.all(
          compositeLayers.map((layer) =>
            sharp(layer.input)
              .resize(size, size)
              .toBuffer()
              .then((buffer) => ({ input: buffer, gravity: "center" }))
          )
        );

        // Composite the layers
        let processedImage = sharp({
          create: {
            width: size,
            height: size,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          },
        }).composite(resizedLayers);

        await processedImage.toFile(outputFilePath);

        console.log(
          `File ${tokenId}.png saved to ${outputFilePath}`
        );
      }
    } catch (error) {
      console.error(`Error reading or processing ${tokenId}:`, error);
    }
  } catch (err) {
    console.error(err);
  }
};

export default main;
