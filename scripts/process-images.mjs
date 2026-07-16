import { Jimp } from "jimp";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sourceImages = [
  {
    src: "C:/Users/PC/.gemini/antigravity/brain/ce5a0ad4-a855-49a7-b349-cecece5aee45/billboard_1784106628289.png",
    dest: "../assets/world/billboard.png"
  },
  {
    src: "C:/Users/PC/.gemini/antigravity/brain/ce5a0ad4-a855-49a7-b349-cecece5aee45/portal_gate_1784106642724.png",
    dest: "../assets/world/portal-gate.png"
  }
];

function getRGBA(hex) {
  const r = (hex >>> 24) & 0xff;
  const g = (hex >>> 16) & 0xff;
  const b = (hex >>> 8) & 0xff;
  const a = hex & 0xff;
  return { r, g, b, a };
}

async function processImage(srcPath, destPath) {
  console.log(`Loading ${srcPath}...`);
  const image = await Jimp.read(srcPath);
  const width = image.width;
  const height = image.height;

  // Read reference color at top-left corner
  const refHex = image.getPixelColor(0, 0);
  const ref = getRGBA(refHex);
  console.log(`Reference background color at (0,0): rgba(${ref.r}, ${ref.g}, ${ref.b}, ${ref.a})`);

  // We perform a BFS flood-fill from all edge pixels to remove background
  const visited = new Uint8Array(width * height);
  const queue = [];

  const pushPixel = (x, y) => {
    const idx = y * width + x;
    if (visited[idx]) return;
    visited[idx] = 1;

    const hex = image.getPixelColor(x, y);
    const pixel = getRGBA(hex);

    // Compute color distance
    const dist = Math.sqrt(
      Math.pow(pixel.r - ref.r, 2) +
      Math.pow(pixel.g - ref.g, 2) +
      Math.pow(pixel.b - ref.b, 2)
    );

    // If it's close to reference background color, it's background
    if (dist < 60) {
      queue.push([x, y]);
    }
  };

  // Push all boundary pixels
  for (let x = 0; x < width; x++) {
    pushPixel(x, 0);
    pushPixel(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    pushPixel(0, y);
    pushPixel(width - 1, y);
  }

  // BFS
  let head = 0;
  while (head < queue.length) {
    const [cx, cy] = queue[head++];
    // Mark as transparent
    image.setPixelColor(0x00000000, cx, cy);

    // Check 4 neighbors
    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1]
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const idx = ny * width + nx;
        if (!visited[idx]) {
          visited[idx] = 1;
          const hex = image.getPixelColor(nx, ny);
          const pixel = getRGBA(hex);
          const dist = Math.sqrt(
            Math.pow(pixel.r - ref.r, 2) +
            Math.pow(pixel.g - ref.g, 2) +
            Math.pow(pixel.b - ref.b, 2)
          );
          if (dist < 60) {
            queue.push([nx, ny]);
          }
        }
      }
    }
  }

  console.log(`Flooded ${queue.length} background pixels to transparent.`);

  // Auto-crop transparent boundaries
  image.autocrop();

  // Resize and contain in a 1024x1024 transparent canvas
  image.contain({ w: 1024, h: 1024 });

  // Ensure destination folder exists
  const absoluteDest = path.resolve(__dirname, destPath);
  const destDir = path.dirname(absoluteDest);
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  // Save as PNG
  await image.write(absoluteDest);
  console.log(`Successfully saved processed image to ${absoluteDest}`);
}

async function main() {
  for (const item of sourceImages) {
    if (existsSync(item.src)) {
      await processImage(item.src, item.dest);
    } else {
      console.warn(`Source image does not exist: ${item.src}`);
    }
  }
}

main().catch(err => {
  console.error("Error processing images:", err);
  process.exit(1);
});
