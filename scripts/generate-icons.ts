/**
 * Generates the PWA icon set in public/icons from a single inline SVG.
 * Run: npx tsx scripts/generate-icons.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const svg = (maskable: boolean) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${maskable ? 0 : 96}" fill="#1c1917"/>
  <g transform="translate(256 256) rotate(-35)">
    <ellipse rx="118" ry="168" fill="#f5e9da"/>
    <path d="M0 -168 C -58 -110 58 -60 0 0 C -58 60 58 110 0 168" stroke="#1c1917" stroke-width="26" fill="none" stroke-linecap="round"/>
  </g>
</svg>`;

const out = "public/icons";
mkdirSync(out, { recursive: true });
const jobs: [string, number, boolean][] = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, true],
];
async function main() {
  for (const [name, size, maskable] of jobs) {
    const png = await sharp(Buffer.from(svg(maskable)))
      .resize(size, size)
      .png()
      .toBuffer();
    writeFileSync(`${out}/${name}`, png);
    console.log(`wrote ${out}/${name} (${size}px, ${png.length} bytes)`);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
