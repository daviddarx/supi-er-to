"use client"

import { useEffect, useRef, useState } from "react"
import { getImageSrc, type ImageSize } from "@/lib/images"
import { cn } from "@/lib/utils"

interface LoadableImageProps {
  id: string
  size: ImageSize
  alt: string
  /** Optional CSS aspect-ratio value (e.g. 1.5 → 3/2 landscape) */
  aspectRatio?: number
  className?: string
  onClick?: () => void
}

/**
 * Lazily-loaded image component using IntersectionObserver.
 * Fades in when loaded. Shows a subtle placeholder background while loading.
 * Loads the image 200px before it enters the viewport for smoother UX.
 */
export function LoadableImage({
  id,
  size,
  alt,
  aspectRatio,
  className,
  onClick,
}: LoadableImageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      // Start loading 200px before the image enters the viewport
      { rootMargin: "200px" }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      className={cn("relative overflow-hidden", onClick && "cursor-pointer", className)}
      style={aspectRatio ? { aspectRatio: String(aspectRatio) } : undefined}
    >
      {/* Subtle placeholder while the image loads */}
      <div className="bg-muted/20 absolute inset-0" />

      {isVisible && !hasError && (
        <img
          src={getImageSrc(id, size)}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0"
          )}
          draggable={false}
        />
      )}
    </div>
  )
}
