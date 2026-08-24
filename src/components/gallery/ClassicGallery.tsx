"use client"

import { LoadableImage } from "@/components/ui/LoadableImage"
import type { GalleryImage } from "@/types"

interface ClassicGalleryProps {
  images: GalleryImage[]
  onImageClick: (index: number) => void
}

/**
 * Classic gallery mode — full-width images stacked vertically, newest first.
 * Max 1200px centered. On desktop, 10vh gap between images plus gutter padding;
 * on mobile the images run edge to edge with a 1px gap and no vertical padding.
 * Clicking an image opens the fullscreen carousel.
 */
export default function ClassicGallery({ images, onImageClick }: ClassicGalleryProps) {
  return (
    <main className="md:px-gutter mx-auto flex max-w-300 flex-col gap-px md:gap-[10vh] md:pt-[10vh] md:pb-[10vh]">
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
          priority={index === 0}
        />
      ))}
    </main>
  )
}
