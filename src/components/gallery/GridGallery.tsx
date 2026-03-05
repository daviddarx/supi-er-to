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
 * The masonry grid CSS lives in globals.css (not duplicated here).
 */
export default function GridGallery({ images, onImageClick }: GridGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [columnCount, setColumnCount] = useState(3)

  useEffect(() => {
    const updateColumns = () => {
      if (!containerRef.current) return
      const containerWidth = containerRef.current.offsetWidth
      // Aim for ~500px columns; always at least 1
      const cols = Math.max(1, Math.round(containerWidth / 500))
      setColumnCount(cols)
    }

    updateColumns()

    const observer = new ResizeObserver(updateColumns)
    if (containerRef.current) observer.observe(containerRef.current)

    return () => observer.disconnect()
  }, [images])

  return (
    <div ref={containerRef} className="mx-auto max-w-[2000px] px-5 py-20 md:py-16">
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
            className="mb-5 w-full"
            overrideSrc={image.previewSrc}
          />
        ))}
      </Masonry>
    </div>
  )
}
