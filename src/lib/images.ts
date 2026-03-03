import type { GalleryImage, ImageFilter } from "@/types"

export const IMAGE_SIZES = [500, 1280, 2400] as const
export type ImageSize = (typeof IMAGE_SIZES)[number]

/**
 * Returns the path to a WebP image at a given size.
 * @param id - Image ID (e.g. "photos-01")
 * @param size - Pixel width: 500, 1280, or 2400
 */
export function getImageSrc(id: string, size: ImageSize): string {
  return `/images/${id}.${size}.webp`
}

/**
 * Returns a srcset string for responsive image loading across all three sizes.
 * @param id - Image ID
 */
export function getImageSrcSet(id: string): string {
  return IMAGE_SIZES.map((size) => `${getImageSrc(id, size)} ${size}w`).join(", ")
}

/**
 * Fetches and returns all images from the static JSON data file.
 * Sorted newest-first (date DESC, sortOrder DESC).
 * @throws Error if the fetch fails
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
 * Sorts images newest-first: date DESC, then sortOrder DESC.
 * Returns a new array (does not mutate input).
 */
export function sortImages(images: GalleryImage[]): GalleryImage[] {
  return [...images].sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date)
    if (dateDiff !== 0) return dateDiff
    return b.sortOrder - a.sortOrder
  })
}

/**
 * Filters images by tag. Returns all images when filter is "all".
 * @param images - Pre-sorted image list
 * @param filter - The active filter ("all" | "supi" | "bone")
 */
export function filterImages(images: GalleryImage[], filter: ImageFilter): GalleryImage[] {
  if (filter === "all") return images
  return images.filter((img) => img.tag === filter)
}

/**
 * Finds the index of an image by its ID within a list.
 * Returns -1 if not found.
 */
export function findImageIndex(images: GalleryImage[], id: string): number {
  return images.findIndex((img) => img.id === id)
}
