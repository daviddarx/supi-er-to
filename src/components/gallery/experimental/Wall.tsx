"use client"

import { useEffect } from "react"
import { useTexture } from "@react-three/drei"
import type { GalleryImage } from "@/types"
import { getImageSrc } from "@/lib/images"

/** Border width around the image on the wall face, in world units. */
const BORDER = 1.2

/** Target height of the wall in world units (width is derived from image aspect ratio). */
const WALL_HEIGHT = 8

/** Depth of the wall cube in world units. */
const WALL_DEPTH = 1.5

interface WallProps {
  image: GalleryImage
  isDarkMode: boolean
  position?: [number, number, number]
}

/**
 * A 3D box (wall with depth) displaying a single gallery image on its front face.
 * The wall matches the image's aspect ratio with a uniform border around it.
 */
export function Wall({ image, isDarkMode, position = [0, 0, 0] }: WallProps) {
  const texture = useTexture(getImageSrc(image.id, 1280))

  useEffect(() => {
    return () => {
      texture.dispose()
    }
  }, [texture])

  const aspect = image.width / image.height

  // Image plane dimensions
  const imgHeight = WALL_HEIGHT
  const imgWidth = imgHeight * aspect

  // Wall dimensions (image + border on each side)
  const wallWidth = imgWidth + BORDER * 2
  const wallHeight = imgHeight + BORDER * 2

  const wallColor = isDarkMode ? "#333333" : "#E8E8E8"

  return (
    <group position={position}>
      {/* Wall cube */}
      <mesh>
        <boxGeometry args={[wallWidth, wallHeight, WALL_DEPTH]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>

      {/* Image plane on the front face, offset half the depth + tiny epsilon */}
      <mesh position={[0, 0, WALL_DEPTH / 2 + 0.05]}>
        <planeGeometry args={[imgWidth, imgHeight]} />
        <meshBasicMaterial map={texture} />
      </mesh>
    </group>
  )
}
