import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#dc2626"/>
  <path d="M256 120a136 136 0 100 272 136 136 0 000-272zm0 40a20 20 0 0120 20v96a20 20 0 01-40 0v-96a20 20 0 0120-20zm0 176a24 24 0 110 48 24 24 0 010-48z" fill="#ffffff"/>
</svg>
`;

const outDir = path.join(process.cwd(), "public", "icons");
fs.mkdirSync(outDir, { recursive: true });

for (const size of [192, 512]) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(outDir, `icon-${size}.png`));
  console.log(`Generated icon-${size}.png`);
}
