# Phase 2: Types & Data Layer

## 2.1 TypeScript Types

**File**: `src/types/index.ts`

```typescript
// ─── Core domain types ────────────────────────────────────────────────────────

export type Tag = "bone" | "supi"

export type GalleryMode = "classic" | "grid" | "explorative" | "experimental"

export type ImageFilter = "all" | "supi" | "bone"

export interface GalleryImage {
  id: string          // e.g. "photos-00", "bone-60-1", "supi-00"
  filename: string    // base filename without size suffix, e.g. "photos-00.webp"
  date: string        // YYYY-MM-DD
  sortOrder: number   // global sequential integer (0 = first/oldest in source)
  tag: Tag
}

// ─── UI state types ───────────────────────────────────────────────────────────

export const IMAGE_FILTER_LABELS: Record<ImageFilter, string> = {
  all: "Everything",
  supi: "SUPI.ER.TO",
  bone: "BONE",
}

export const GALLERY_MODE_LABELS: Record<GalleryMode, string> = {
  classic: "Classic",
  grid: "Grid",
  explorative: "Explorative",
  experimental: "Experimental",
}
```

---

## 2.2 Image Library

**File**: `src/lib/images.ts`

```typescript
import type { GalleryImage, ImageFilter } from "@/types"

// ─── Constants ────────────────────────────────────────────────────────────────

export const IMAGE_SIZES = [500, 1280, 2400] as const
export type ImageSize = (typeof IMAGE_SIZES)[number]

// ─── URL helpers ─────────────────────────────────────────────────────────────

/**
 * Returns the public URL for a specific image size.
 * e.g. getImageSrc("photos-00", 500) → "/images/photos-00.500.webp"
 */
export function getImageSrc(id: string, size: ImageSize): string {
  return `/images/${id}.${size}.webp`
}

/**
 * Returns a srcset string for responsive image loading.
 * Useful for <img srcset="..."> in Classic and Grid modes.
 */
export function getImageSrcSet(id: string): string {
  return IMAGE_SIZES.map((size) => `${getImageSrc(id, size)} ${size}w`).join(", ")
}

// ─── Data fetching ────────────────────────────────────────────────────────────

/**
 * Fetches the flat image list from /data/images.json.
 *
 * Returns images sorted NEWEST FIRST:
 * - Primary sort: date DESC
 * - Secondary sort: sortOrder DESC (higher sortOrder = added later within same date)
 *
 * The initial image set all share the placeholder date "2024-01-01", so the
 * secondary sortOrder sort ensures they appear in the intended sequence.
 */
export async function fetchImages(): Promise<GalleryImage[]> {
  const response = await fetch("/data/images.json")
  if (!response.ok) {
    throw new Error(`Failed to fetch images: ${response.status}`)
  }
  const images: GalleryImage[] = await response.json()
  return sortImages(images)
}

/**
 * Sorts images newest first (date DESC, then sortOrder DESC within same date).
 */
export function sortImages(images: GalleryImage[]): GalleryImage[] {
  return [...images].sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date)
    if (dateDiff !== 0) return dateDiff
    return b.sortOrder - a.sortOrder
  })
}

// ─── Filtering ────────────────────────────────────────────────────────────────

/**
 * Filters images by the active ImageFilter.
 * "all" returns all images unchanged.
 */
export function filterImages(images: GalleryImage[], filter: ImageFilter): GalleryImage[] {
  if (filter === "all") return images
  return images.filter((img) => img.tag === filter)
}

/**
 * Finds the index of a specific image ID within a filtered array.
 * Returns -1 if not found.
 */
export function findImageIndex(images: GalleryImage[], id: string): number {
  return images.findIndex((img) => img.id === id)
}
```

---

## 2.3 URL State Helpers

**File**: `src/lib/url-state.ts`

These helpers are used by `page.tsx` to manage the `?image={id}` deep link for carousel sharing.

```typescript
/**
 * Reads the ?image= query param from the current URL.
 * Returns null if not present.
 *
 * NOTE: Do not call this during SSR. Use only in useEffect or client components.
 */
export function getImageIdFromUrl(): string | null {
  if (typeof window === "undefined") return null
  const params = new URLSearchParams(window.location.search)
  return params.get("image")
}

/**
 * Sets or removes the ?image= query param in the URL without a page reload.
 * Pass null to remove the param.
 *
 * Uses history.pushState to avoid Next.js router overhead for this simple case.
 */
export function setImageUrl(id: string | null): void {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  if (id) {
    url.searchParams.set("image", id)
  } else {
    url.searchParams.delete("image")
  }
  window.history.pushState({}, "", url.toString())
}
```

**Important**: In `page.tsx` (App Router), use `useSearchParams()` from `next/navigation` for the initial read (requires `<Suspense>` boundary). For subsequent updates use `setImageUrl` directly to avoid router re-renders.

---

## 2.4 GitHub API Helpers

**File**: `src/lib/github.ts`

This file is used exclusively by the Netlify Function (`netlify/functions/upload-image.ts`). It is **never imported by client-side code**.

```typescript
import { Octokit } from "@octokit/rest"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CommitFile {
  path: string      // e.g. "public/images/img-1234.500.webp"
  content: Buffer   // file content as Buffer
  encoding: "base64" | "utf-8"
}

// ─── GitHub commit helper ─────────────────────────────────────────────────────

/**
 * Creates a single atomic GitHub commit with multiple files.
 *
 * Flow:
 * 1. Get current HEAD SHA
 * 2. Create blobs for each file
 * 3. Create a new tree based on current tree, adding/updating our files
 * 4. Create a commit pointing to the new tree
 * 5. Update the main branch ref to point to the new commit
 *
 * This ensures a single Netlify build trigger for any number of files.
 */
export async function commitFiles(
  files: CommitFile[],
  message: string,
  options: {
    token: string
    owner: string
    repo: string
    branch?: string
  }
): Promise<void> {
  const { token, owner, repo, branch = "main" } = options
  const octokit = new Octokit({ auth: token })

  // 1. Get current branch HEAD
  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  })
  const latestCommitSha = refData.object.sha

  // 2. Create blobs for each file
  const blobs = await Promise.all(
    files.map((file) =>
      octokit.git.createBlob({
        owner,
        repo,
        content: file.content.toString("base64"),
        encoding: "base64",
      })
    )
  )

  // 3. Create tree
  const { data: treeData } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: latestCommitSha,
    tree: files.map((file, i) => ({
      path: file.path,
      mode: "100644" as const,
      type: "blob" as const,
      sha: blobs[i].data.sha,
    })),
  })

  // 4. Create commit
  const { data: commitData } = await octokit.git.createCommit({
    owner,
    repo,
    message,
    tree: treeData.sha,
    parents: [latestCommitSha],
  })

  // 5. Update branch ref
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: commitData.sha,
  })
}
```

---

## 2.5 App State in page.tsx

The main `page.tsx` manages these state variables:

```typescript
// Gallery state
const [images, setImages] = useState<GalleryImage[]>([])         // full list from JSON
const [mode, setMode] = useState<GalleryMode>("classic")         // active gallery mode
const [filter, setFilter] = useState<ImageFilter>("all")         // active image filter
const [isLoading, setIsLoading] = useState(true)

// Carousel state
const [carouselOpen, setCarouselOpen] = useState(false)
const [carouselIndex, setCarouselIndex] = useState(0)

// Derived
const filteredImages = useMemo(() => filterImages(images, filter), [images, filter])
```

**On mount**:
```typescript
useEffect(() => {
  fetchImages().then((imgs) => {
    setImages(imgs)
    setIsLoading(false)

    // Check for deep link
    const imageId = getImageIdFromUrl()
    if (imageId) {
      const index = findImageIndex(filterImages(imgs, filter), imageId)
      if (index !== -1) {
        setCarouselOpen(true)
        setCarouselIndex(index)
      }
    }
  })
}, [])
```

**Admin image added callback**:
```typescript
const handleImageAdded = (newImage: GalleryImage) => {
  // Prepend to images array (newest first)
  setImages((prev) => sortImages([newImage, ...prev]))
}
```
