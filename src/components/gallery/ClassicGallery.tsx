"use client"

import { LoadableImage } from "@/components/ui/LoadableImage"
import type { GalleryImage } from "@/types"

interface ClassicGalleryProps {
  images: GalleryImage[]
  onImageClick: (index: number) => void
}

/**
 * Classic gallery mode — full-width images stacked vertically, newest first.
 * Max 1200px centered. 15vh gap between images and top padding.
 * Clicking an image opens the fullscreen carousel.
 */
export default function ClassicGallery({ images, onImageClick }: ClassicGalleryProps) {
  return (
    <main
      className="mx-auto flex max-w-[1200px] flex-col px-[var(--gutter)]"
      style={{ gap: "15vh", paddingTop: "15vh", paddingBottom: "15vh" }}
    >
      {images.map((image, index) => (
        <LoadableImage
          key={image.id}
          id={image.id}
          size={1280}
          alt={`${image.tag} piece`}
          onClick={() => onImageClick(index)}
          className="w-full"
          overrideSrc={image.previewSrc}
          width={image.width}
          height={image.height}
        />
      ))}
    </main>
  )
}
