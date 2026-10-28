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
 * Square and portrait pictures are never taller than the viewport, so they
 * always fit on screen; capped ones are narrowed and centred on a
 * grey band (the same grey as Experimental mode's walls). Landscape pictures
 * stay full width.
 * Clicking an image opens the fullscreen carousel.
 */
export default function ClassicGallery({ images, onImageClick }: ClassicGalleryProps) {
  return (
    <main className="md:px-gutter mx-auto flex max-w-300 flex-col gap-px md:gap-[10vh] md:pt-[10vh] md:pb-[10vh]">
      {images.map((image, index) => {
        const picture = (
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
        )
        if (image.width > image.height) return picture

        return (
          <div key={image.id} className="flex justify-center bg-[#f7f7f7] dark:bg-[#161616]">
            <div
              className="w-full"
              style={{
                // Width that makes the picture exactly as tall as the viewport, unless
                // the column is narrower — then it's full width and under the cap
                maxWidth: `calc(100svh * ${image.width / image.height})`,
              }}
            >
              {picture}
            </div>
          </div>
        )
      })}
    </main>
  )
}
