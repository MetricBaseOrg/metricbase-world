import { Jimp } from "jimp";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sourceImages = [
  {
    src: "C:/Users/PC/.gemini/antigravity/brain/ce5a0ad4-a855-49a7-b349-cecece5aee45/health_potion_1784106703908.png",
    dest: "../assets/items/health-potion.png"
  },
  {
    src: "C:/Users/PC/.gemini/antigravity/brain/ce5a0ad4-a855-49a7-b349-cecece5aee45/bread_1784106716012.png",
    dest: "../assets/items/bread.png"
  },
  {
    src: "C:/Users/PC/.gemini/antigravity/brain/ce5a0ad4-a855-49a7-b349-cecece5aee45/carrot_soup_1784106728415.png",
    dest: "../assets/items/carrot-soup.png"
  },
  {
    src: "C:/Users/PC/.gemini/antigravity/brain/ce5a0ad4-a855-49a7-b349-cecece5aee45/carrot_bread_1784106742221.png",
    dest: "../assets/items/carrot-bread.png"
  },
  {
    src: "C:/Users/PC/.gemini/antigravity/brain/ce5a0ad4-a855-49a7-b349-cecece5aee45/wood_1784106755107.png",
    dest: "../assets/items/wood.png"
  },
  {
    src: "C:/Users/PC/.gemini/antigravity/brain/ce5a0ad4-a855-49a7-b349-cecece5aee45/plank_1784106766581.png",
    dest: "../assets/items/plank.png"
  },
  {
    src: "C:/Users/PC/.gemini/antigravity/brain/ce5a0ad4-a855-49a7-b349-cecece5aee45/hardwood_1784106778882.png",
    dest: "../assets/items/hardwood.png"
  },
  {
    src: "C:/Users/PC/.gemini/antigravity/brain/ce5a0ad4-a855-49a7-b349-cecece5aee45/hardwood_plank_1784106791720.png",
    dest: "../assets/items/hardwood-plank.png"
  },
  {
    src: "C:/Users/PC/.gemini/antigravity/brain/ce5a0ad4-a855-49a7-b349-cecece5aee45/steel_bar_1784106804889.png",
    dest: "../assets/items/steel-bar.png"
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
  console.log(`Reference background color: rgba(${ref.r}, ${ref.g}, ${ref.b}, ${ref.a})`);

  // We perform a BFS flood-fill from all edge pixels to remove background
  const visited = new Uint8Array(width * height);
  const queue = [];

  const pushPixel = (x, y) => {
    const idx = y * width + x;
    if (visited[idx]) return;
    visited[idx] = 1;

    const hex = image.getPixelColor(x, y);
    const pixel = getRGBA(hex);

    const dist = Math.sqrt(
      Math.pow(pixel.r - ref.r, 2) +
      Math.pow(pixel.g - ref.g, 2) +
      Math.pow(pixel.b - ref.b, 2)
    );

    if (dist < 60) {
      queue.push([x, y]);
    }
  };

  // Push boundary
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
    image.setPixelColor(0x00000000, cx, cy);

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

  // Auto-crop
  image.autocrop();

  // Save 1024x1024 PNG to D:\metricbase-world\assets\items
  const rawImage = image.clone();
  rawImage.contain({ w: 1024, h: 1024 });
  const absoluteDest = path.resolve(__dirname, destPath);
  const destDir = path.dirname(absoluteDest);
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }
  await rawImage.write(absoluteDest);
  console.log(`Saved raw image to ${absoluteDest}`);

  // Save 256x256 PNG to D:\metricbase-world\client\public\assets\items
  const clientDest = absoluteDest.replace("assets\\items", "client\\public\\assets\\items");
  const clientDir = path.dirname(clientDest);
  if (!existsSync(clientDir)) {
    mkdirSync(clientDir, { recursive: true });
  }
  const clientImage = image.clone();
  clientImage.contain({ w: 256, h: 256 });
  await clientImage.write(clientDest);
  console.log(`Saved client image to ${clientDest}`);
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
