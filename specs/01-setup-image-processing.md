# Phase 0–1: Project Setup & Image Processing

## Phase 0: Project Setup

### 0.1 Initialize Next.js

```bash
npx create-next-app@latest supi-er-to \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*"
```

Then move into the project and reorganize to use `src/` directory (manually or adjust the command). The final structure uses `src/app/`, `src/components/`, `src/lib/`, `src/types/`.

### 0.2 Install All Dependencies

```bash
# UI
npm install @radix-ui/react-tooltip @radix-ui/react-select @radix-ui/react-radio-group
npm install framer-motion

# shadcn (installs components on demand)
npx shadcn@latest init

# Gallery modes
npm install @use-gesture/react
npm install react-masonry-css
npm install yet-another-react-lightbox

# Three.js
npm install three @react-three/fiber @react-three/drei
npm install @types/three

# Auth
npm install next-auth

# Admin / GitHub API
npm install @octokit/rest

# Dev
npm install --save-dev @netlify/functions
npm install --save-dev sharp tsx

# Formatting
npm install --save-dev prettier prettier-plugin-tailwindcss
```

### 0.3 Install shadcn Components

Run these as needed during development:

```bash
npx shadcn@latest add button
npx shadcn@latest add select
npx shadcn@latest add tooltip
npx shadcn@latest add toggle-group
npx shadcn@latest add sheet
npx shadcn@latest add radio-group
npx shadcn@latest add input
npx shadcn@latest add label
npx shadcn@latest add toast
```

### 0.4 Prettier Configuration

Create `.prettierrc`:

```json
{
  "semi": false,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

Add to `package.json` scripts:

```json
"format": "prettier --write \"src/**/*.{ts,tsx}\" \"*.{ts,tsx,js,mjs}\""
```

### 0.5 Tailwind Configuration

In `tailwind.config.ts`, override the default border radius to 2px everywhere:

```typescript
import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        DEFAULT: "2px",
        sm: "2px",
        md: "2px",
        lg: "2px",
        xl: "2px",
        "2xl": "2px",
        full: "9999px",
      },
      fontFamily: {
        mono: ["var(--font-dm-mono)", "ui-monospace", "monospace"],
        sans: ["var(--font-dm-mono)", "ui-monospace", "monospace"],
      },
    },
  },
}
```

### 0.6 DM Mono Font

In `src/app/layout.tsx`:

```typescript
import { DM_Mono } from "next/font/google"

const dmMono = DM_Mono({
  weight: ["300", "400", "500"],
  subsets: ["latin"],
  variable: "--font-dm-mono",
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmMono.variable} dark`} suppressHydrationWarning>
      <body className="font-mono antialiased">{children}</body>
    </html>
  )
}
```

Note: `dark` class is added by default (dark mode default). The dark mode toggle will manipulate this class client-side.

### 0.7 shadcn Theme Customization

In `src/app/globals.css`, customize the shadcn CSS variables to match the minimal aesthetic:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 3.9%;
    --border: 0 0% 89.8%;
    --radius: 2px;
    /* Keep other shadcn vars as defaults */
  }

  .dark {
    --background: 0 0% 3.9%;
    --foreground: 0 0% 98%;
    --border: 0 0% 14.9%;
    --radius: 2px;
  }
}

* {
  box-shadow: none !important; /* Override all shadows globally */
}
```

### 0.8 netlify.toml

```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "20"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[functions]
  directory = "netlify/functions"
  node_bundler = "nft"
```

Also run:

```bash
npm install --save-dev @netlify/plugin-nextjs
```

### 0.9 Environment Variables Template

Create `.env.local.example` (commit this, not `.env.local`):

```
GITHUB_ID=
GITHUB_SECRET=
GITHUB_TOKEN=
GITHUB_REPO=owner/repo-name
GITHUB_REPO_OWNER=
ALLOWED_GITHUB_USERNAME=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
```

### 0.10 next.config.ts

```typescript
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "export",   // static export for Netlify
  images: {
    unoptimized: true, // images are pre-optimized via Sharp
  },
}

export default nextConfig
```

Note: `output: "export"` generates a static site. With `@netlify/plugin-nextjs`, dynamic features (like API routes for next-auth) are handled via Netlify Functions automatically.

---

## Phase 1: Image Processing Pipeline

### 1.1 Script: `scripts/process-images.ts`

This script is run once locally before the first deployment, and never needs to run again unless the source images change.

**npm script** (add to `package.json`):
```json
"process-images": "npx tsx scripts/process-images.ts"
```

**Dependencies**: `sharp` (already installed as dev dep), Node built-ins (`fs`, `path`)

### 1.2 Full Algorithm

```typescript
import sharp from "sharp"
import fs from "fs"
import path from "path"

// ─── Types ───────────────────────────────────────────────────────────────────

interface ImageEntry {
  id: string
  filename: string  // base filename, e.g. "photos-00.webp"
  date: string      // "YYYY-MM-DD"
  sortOrder: number // global sequential integer, 0-indexed
  tag: "bone" | "supi"
}

interface SourceFile {
  absolutePath: string
  tag: "bone" | "supi"
  prefix: string    // folder prefix: "photos", "bone", "supi"
  numericKey: number  // parsed float for sorting, e.g. 60.1 for "60.1.jpg"
  numericStr: string  // sanitized string for ID, e.g. "60-1" for "60.1.jpg"
}

// ─── Config ──────────────────────────────────────────────────────────────────

const SOURCE_ROOT = path.join(process.cwd(), "image-sources")
const OUTPUT_IMAGES = path.join(process.cwd(), "public", "images")
const OUTPUT_JSON = path.join(process.cwd(), "public", "data", "images.json")
const PLACEHOLDER_DATE = "2024-01-01"
const SIZES = [500, 1280, 2400] as const
const QUALITY = 82

// ─── Folder → tag mapping ────────────────────────────────────────────────────

const FOLDER_MAP: Array<{ name: string; tag: "bone" | "supi"; prefix: string }> = [
  { name: "00-photos", tag: "bone", prefix: "photos" },
  { name: "01-sketch-bone", tag: "bone", prefix: "bone" },
  { name: "02-rip.jpg", tag: "bone", prefix: "rip" },  // single file at root
  { name: "03-sketch-supi", tag: "supi", prefix: "supi" },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse a filename like "60.1.jpg" → numeric key 60.1, string "60-1"
 * "00.jpg" → 0, "00"
 * "00.0.jpg" → 0.0, "00-0"
 */
function parseFilename(filename: string): { key: number; str: string } {
  const base = path.basename(filename, path.extname(filename)) // e.g. "60.1"
  const key = parseFloat(base)
  const str = base.replace(".", "-") // "60.1" → "60-1", "00" → "00"
  return { key, str }
}

/**
 * Get all image files from a directory, sorted by numeric prefix
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

// ─── Main ─────────────────────────────────────────────────────────────────────

async function processImages() {
  // Ensure output directories exist
  fs.mkdirSync(OUTPUT_IMAGES, { recursive: true })
  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true })

  const allFiles: SourceFile[] = []

  for (const folder of FOLDER_MAP) {
    const folderPath = path.join(SOURCE_ROOT, folder.name)
    const stat = fs.statSync(folderPath)

    if (stat.isFile()) {
      // Single file (02-rip.jpg)
      const { key, str } = parseFilename(folder.name)
      allFiles.push({
        absolutePath: folderPath,
        tag: folder.tag,
        prefix: folder.prefix,
        numericKey: key,
        numericStr: "00", // single file, no numeric suffix needed
      })
    } else if (stat.isDirectory()) {
      const files = getFilesInDir(folderPath, folder.tag, folder.prefix)
      allFiles.push(...files)
    }
  }

  const entries: ImageEntry[] = []

  for (let i = 0; i < allFiles.length; i++) {
    const file = allFiles[i]
    const id = `${file.prefix}-${file.numericStr}` // e.g. "photos-00", "bone-60-1"

    console.log(`[${i + 1}/${allFiles.length}] Processing ${id}...`)

    try {
      for (const size of SIZES) {
        const outputPath = path.join(OUTPUT_IMAGES, `${id}.${size}.webp`)

        // Skip if already processed (for re-runs)
        if (fs.existsSync(outputPath)) {
          console.log(`  ↳ ${size}px — skipped (already exists)`)
          continue
        }

        await sharp(file.absolutePath)
          .resize(size, undefined, { withoutEnlargement: true })
          .webp({ quality: QUALITY })
          .toFile(outputPath)

        console.log(`  ↳ ${size}px — done`)
      }

      entries.push({
        id,
        filename: `${id}.webp`,
        date: PLACEHOLDER_DATE,
        sortOrder: i,
        tag: file.tag,
      })
    } catch (err) {
      console.warn(`  ↳ ERROR processing ${id}: ${err}`)
    }
  }

  // Write JSON sorted by sortOrder (ascending = oldest to newest in source,
  // but gallery displays newest first — that sorting happens at runtime)
  const json = JSON.stringify(entries, null, 2)
  fs.writeFileSync(OUTPUT_JSON, json, "utf8")

  console.log(`\n✓ Processed ${entries.length} images`)
  console.log(`✓ Written to ${OUTPUT_JSON}`)
}

processImages().catch(console.error)
```

### 1.3 Important Notes

**Duplicate IDs**: If two files in different folders produce the same ID (e.g. `photos-00` and `bone-00`), the current script will overwrite the WebP files of the first with the second. This is acceptable because:
- The numeric IDs within each folder are scoped by the prefix (`photos-`, `bone-`, `supi-`)
- `photos-00` and `bone-00` are different IDs

**Decimal variants**: `00.0.jpg` → ID `photos-00-0`, `00.1.jpg` → `photos-00-1`. These are treated as separate images.

**Re-runs**: The script skips WebP files that already exist. To force re-processing, delete `public/images/` and re-run.

**02-rip.jpg**: The single file at root of `image-sources/` is treated as a directory entry with prefix `rip` and numeric suffix `00`, producing ID `rip-00`.

**Quality 82**: Sharp's WebP quality 82 is approximately equivalent to Photoshop's "Save for Web" at ~80 quality. This gives good compression without visible artifacting for photographic content.

### 1.4 Verification

After running `npm run process-images`:

```bash
# Count WebP files (should be ~197 × 3 = ~591)
ls public/images/*.webp | wc -l

# Verify JSON structure
cat public/data/images.json | head -30

# Check a specific image exists in all 3 sizes
ls public/images/photos-00.*.webp
```
