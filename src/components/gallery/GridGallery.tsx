"use client"

import { useEffect, useRef, useState } from "react"
import Masonry from "react-masonry-css"
import { LoadableImage } from "@/components/ui/LoadableImage"
import type { GalleryImage } from "@/types"

interface GridGalleryProps {
  images: GalleryImage[]
  onImageClick: (index: number) => void
}

/**
 * Grid gallery mode — masonry layout using react-masonry-css.
 * Column count is computed dynamically from the container width (~500px per column).
 * Minimum 2 columns at all screen sizes. 1px gap between images.
 * The masonry grid CSS lives in globals.css (not duplicated here).
 */
export default function GridGallery({ images, onImageClick }: GridGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [columnCount, setColumnCount] = useState(3)

  useEffect(() => {
    const updateColumns = () => {
      if (!containerRef.current) return
      const containerWidth = containerRef.current.offsetWidth
      // Aim for ~500px columns; always at least 2 columns
      const cols = Math.max(2, Math.round(containerWidth / 500))
      setColumnCount(cols)
    }

    updateColumns()

    const observer = new ResizeObserver(updateColumns)
    if (containerRef.current) observer.observe(containerRef.current)

    return () => observer.disconnect()
  }, [images])

  return (
    <div ref={containerRef} className="pb-5">
      <Masonry
        breakpointCols={columnCount}
        className="masonry-grid"
        columnClassName="masonry-grid_column"
      >
        {images.map((image, index) => (
          <LoadableImage
            key={image.id}
            id={image.id}
            size={500}
            alt={`${image.tag} piece`}
            onClick={() => onImageClick(index)}
            className="mb-px w-full"
            overrideSrc={image.previewSrc}
            width={image.width}
            height={image.height}
          />
        ))}
      </Masonry>
    </div>
  )
}
