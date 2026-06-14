import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "assets", "images", "logo.2.png");
const bak = path.join(root, "assets", "images", "logo.2.bak.png");

const require = createRequire(import.meta.url);
const { Jimp } = await import("jimp");

function dist(c1, c2) {
  return Math.sqrt(
    (c1.r - c2.r) ** 2 + (c1.g - c2.g) ** 2 + (c1.b - c2.b) ** 2
  );
}

const img = await Jimp.read(src);
const w = img.bitmap.width;
const h = img.bitmap.height;

const pts = [
  [1, 1],
  [w - 2, 1],
  [1, h - 2],
  [w - 2, h - 2],
  [Math.floor(w / 2), 1],
  [Math.floor(w / 2), h - 2],
];
let rs = 0,
  gs = 0,
  bs = 0;
for (const [x, y] of pts) {
  const c = Jimp.intToRGBA(img.getPixelColor(x, y));
  rs += c.r;
  gs += c.g;
  bs += c.b;
}
const bg = { r: Math.round(rs / pts.length), g: Math.round(gs / pts.length), b: Math.round(bs / pts.length) };
const tol = 42;
const soft = tol + 24;

img.scan(0, 0, w, h, function (x, y, idx) {
  const r = this.bitmap.data[idx];
  const g = this.bitmap.data[idx + 1];
  const b = this.bitmap.data[idx + 2];
  const d = dist({ r, g, b }, bg);
  if (d <= tol) {
    this.bitmap.data[idx + 3] = 0;
  } else if (d < soft) {
    const fade = Math.round(255 * ((d - tol) / (soft - tol)));
    this.bitmap.data[idx + 3] = Math.min(this.bitmap.data[idx + 3], fade);
  }
});

if (!fs.existsSync(bak)) {
  fs.copyFileSync(src, bak);
  console.log("Backup:", bak);
}

await img.write(src);
console.log("Background médio:", bg);
console.log("Salvo:", src, `${w}x${h}`);
