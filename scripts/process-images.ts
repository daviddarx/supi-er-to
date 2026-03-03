/**
 * process-images.ts
 *
 * Processes source images from image-sources/ and outputs:
 * - public/images/{id}.500.webp
 * - public/images/{id}.1280.webp
 * - public/images/{id}.2400.webp
 * - public/data/images.json
 *
 * Skips files that have already been processed (idempotent).
 * Run via: npm run process-images
 */

import sharp from "sharp"
import fs from "fs"
import path from "path"

interface ImageEntry {
  id: string
  filename: string
  date: string
  sortOrder: number
  tag: "bone" | "supi"
}

interface SourceFile {
  absolutePath: string
  tag: "bone" | "supi"
  prefix: string
  numericKey: number
  numericStr: string
}

const SOURCE_ROOT = path.join(process.cwd(), "image-sources")
const OUTPUT_IMAGES = path.join(process.cwd(), "public", "images")
const OUTPUT_JSON = path.join(process.cwd(), "public", "data", "images.json")
const PLACEHOLDER_DATE = "2024-01-01"
const SIZES = [500, 1280, 2400] as const
const QUALITY = 82

/**
 * Maps each image-sources/ subdirectory to a tag and ID prefix.
 * Order determines sortOrder in the output JSON.
 */
const FOLDER_MAP: Array<{ name: string; tag: "bone" | "supi"; prefix: string }> = [
  { name: "00-photos", tag: "bone", prefix: "photos" },
  { name: "01-sketch-bone", tag: "bone", prefix: "bone" },
  { name: "02-rip.jpg", tag: "bone", prefix: "rip" },
  { name: "03-sketch-supi", tag: "supi", prefix: "supi" },
]

/**
 * Parses a filename to extract a numeric sort key and a string version
 * safe for use in IDs (replaces "." with "-", e.g. "1.5" → "1-5").
 */
function parseFilename(filename: string): { key: number; str: string } {
  const base = path.basename(filename, path.extname(filename))
  const key = parseFloat(base)
  const str = base.replace(".", "-")
  return { key, str }
}

/**
 * Reads all image files from a directory, sorted numerically by filename.
 */
function getFilesInDir(dir: string, tag: "bone" | "supi", prefix: string): SourceFile[] {
  const entries = fs.readdirSync(dir)
  const imageFiles = entries.filter((f) => /\.(jpg|jpeg|png)$/i.test(f))

  return imageFiles
    .map((f) => {
      const { key, str } = parseFilename(f)
      return {
        absolutePath: path.join(dir, f),
        tag,
        prefix,
        numericKey: key,
        numericStr: str,
      }
    })
    .sort((a, b) => a.numericKey - b.numericKey)
}

async function processImages() {
  fs.mkdirSync(OUTPUT_IMAGES, { recursive: true })
  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true })

  const allFiles: SourceFile[] = []

  // Collect all source files in order
  for (const folder of FOLDER_MAP) {
    const folderPath = path.join(SOURCE_ROOT, folder.name)

    if (!fs.existsSync(folderPath)) {
      console.warn(`  SKIP: ${folderPath} not found`)
      continue
    }

    const stat = fs.statSync(folderPath)

    if (stat.isFile()) {
      // Handle single-file entries like "02-rip.jpg"
      allFiles.push({
        absolutePath: folderPath,
        tag: folder.tag,
        prefix: folder.prefix,
        numericKey: 0,
        numericStr: "00",
      })
    } else if (stat.isDirectory()) {
      const files = getFilesInDir(folderPath, folder.tag, folder.prefix)
      allFiles.push(...files)
    }
  }

  const entries: ImageEntry[] = []

  for (let i = 0; i < allFiles.length; i++) {
    const file = allFiles[i]
    const id = `${file.prefix}-${file.numericStr}`

    console.log(`[${i + 1}/${allFiles.length}] Processing ${id}...`)

    try {
      for (const size of SIZES) {
        const outputPath = path.join(OUTPUT_IMAGES, `${id}.${size}.webp`)

        if (fs.existsSync(outputPath)) {
          console.log(`  ${size}px — skipped (already exists)`)
          continue
        }

        await sharp(file.absolutePath)
          .resize(size, undefined, { withoutEnlargement: true })
          .webp({ quality: QUALITY })
          .toFile(outputPath)

        console.log(`  ${size}px — done`)
      }

      entries.push({
        id,
        filename: `${id}.webp`,
        date: PLACEHOLDER_DATE,
        sortOrder: i,
        tag: file.tag,
      })
    } catch (err) {
      console.warn(`  ERROR processing ${id}: ${err}`)
    }
  }

  const json = JSON.stringify(entries, null, 2)
  fs.writeFileSync(OUTPUT_JSON, json, "utf8")

  console.log(`\nProcessed ${entries.length} images`)
  console.log(`Written to ${OUTPUT_JSON}`)
}

processImages().catch(console.error)
