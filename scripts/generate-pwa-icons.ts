/**
 * Generate PWA icons from src/app/icon.svg.
 *
 * Outputs:
 *   public/icons/apple-touch-icon.png  — 180×180, iOS home screen
 *   public/icons/icon-192.png          — 192×192, Android manifest
 *   public/icons/icon-512.png          — 512×512, Android manifest + install dialog
 *   public/icons/icon-512-maskable.png — 512×512 maskable, safe zone = inner 80%
 *
 * Run: npm run generate-pwa-icons
 */

import sharp from "sharp"
import { readFileSync } from "fs"
import { resolve } from "path"

const ROOT = resolve(process.cwd())
const SVG_PATH = resolve(ROOT, "src/app/icon.svg")
const OUT_DIR = resolve(ROOT, "public/icons")

async function main() {
  const svgBuffer = readFileSync(SVG_PATH)

  console.log("Generating PWA icons from", SVG_PATH)

  // iOS home screen icon — 180×180
  await sharp(svgBuffer).resize(180, 180).png().toFile(`${OUT_DIR}/apple-touch-icon.png`)
  console.log("  apple-touch-icon.png (180×180)")

  // Android manifest icon — 192×192
  await sharp(svgBuffer).resize(192, 192).png().toFile(`${OUT_DIR}/icon-192.png`)
  console.log("  icon-192.png (192×192)")

  // Android manifest + install dialog — 512×512
  await sharp(svgBuffer).resize(512, 512).png().toFile(`${OUT_DIR}/icon-512.png`)
  console.log("  icon-512.png (512×512)")

  // Android maskable icon — 512×512 with "SU" glyph inset to the 80% safe zone.
  // Resize the SVG content to 410×410 (≈80% of 512) then extend with black padding
  // to reach 512×512. This ensures the glyph never gets clipped by the mask shape.
  await sharp(svgBuffer)
    .resize(410, 410)
    .extend({ top: 51, bottom: 51, left: 51, right: 51, background: "#000000" })
    .png()
    .toFile(`${OUT_DIR}/icon-512-maskable.png`)
  console.log("  icon-512-maskable.png (512×512 maskable)")

  console.log("Done.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
