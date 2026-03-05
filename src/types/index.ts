export type Tag = "bone" | "supi"

export type GalleryMode = "classic" | "grid" | "explorative" | "experimental"

export type ImageFilter = "all" | "supi" | "bone"

export interface GalleryImage {
  id: string
  filename: string
  date: string
  sortOrder: number
  tag: Tag
  /** Temporary blob URL for optimistic display before the Netlify rebuild completes. Never persisted. */
  previewSrc?: string
}

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
