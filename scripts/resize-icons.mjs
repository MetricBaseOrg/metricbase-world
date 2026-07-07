import { Jimp } from "jimp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inputPath = path.resolve(__dirname, "../assets/logo/logo.jpeg");
const out192Path = path.resolve(__dirname, "../client/public/pwa-192x192.png");
const out512Path = path.resolve(__dirname, "../client/public/pwa-512x512.png");

async function main() {
  console.log("Reading source image:", inputPath);
  const image = await Jimp.read(inputPath);
  
  const width = image.width;
  const height = image.height;
  console.log(`Original dimensions: ${width}x${height}`);

  let squareImage = image;
  if (width !== height) {
    const size = Math.max(width, height);
    console.log(`Containing image in a square of ${size}x${size} with background #b8e8fc...`);
    squareImage = image.clone();
    squareImage.contain({ w: size, h: size, background: 0xb8e8fcff });
  } else {
    console.log("Image is already square, no padding needed.");
  }

  console.log("Resizing and writing 512x512...");
  const img512 = squareImage.clone().resize({ w: 512, h: 512 });
  await img512.write(out512Path);
  console.log("✓ Saved 512x512 icon to:", out512Path);

  console.log("Resizing and writing 192x192...");
  const img192 = squareImage.clone().resize({ w: 192, h: 192 });
  await img192.write(out192Path);
  console.log("✓ Saved 192x192 icon to:", out192Path);
}

main().catch((err) => {
  console.error("Error generating icons:", err);
  process.exit(1);
});
