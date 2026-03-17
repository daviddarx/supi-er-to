"use client"

import { useRef, useEffect, forwardRef, useImperativeHandle } from "react"
import { useFrame } from "@react-three/fiber"
import { useTexture } from "@react-three/drei"
import * as THREE from "three"
import type { GalleryImage } from "@/types"
import { getImageSrc } from "@/lib/images"

/** Border width around the image on the wall face, in world units. */
export const BORDER = 1.2

/** Target height of the wall in world units (width is derived from image aspect ratio). */
export const WALL_HEIGHT = 8

/** Depth of the wall cube in world units. */
export const WALL_DEPTH = 1.5

/** Fade-in speed (opacity units per second). */
const FADE_SPEED = 1.5

export interface WallHandle {
  /** Set visibility imperatively — no React re-render. */
  setVisible: (v: boolean) => void
  /** Reposition the wall along Z for infinite looping — no React re-render. */
  setPositionZ: (z: number) => void
}

interface WallProps {
  image: GalleryImage
  isDarkMode: boolean
  position?: [number, number, number]
  rotation?: [number, number, number]
  border?: number
  depth?: number
}

export const Wall = forwardRef<WallHandle, WallProps>(function Wall(
  {
    image,
    isDarkMode,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    border = BORDER,
    depth = WALL_DEPTH,
  },
  ref
) {
  const texture = useTexture(getImageSrc(image.id, 1280))
  const groupRef = useRef<THREE.Group>(null)
  const opacityRef = useRef(0)
  const visibleRef = useRef(true)
  const wasVisibleRef = useRef(false)

  useEffect(() => {
    return () => {
      texture.dispose()
    }
  }, [texture])

  useImperativeHandle(ref, () => ({
    setVisible(v: boolean) {
      visibleRef.current = v
      if (groupRef.current) {
        groupRef.current.visible = v
      }
      if (v && !wasVisibleRef.current) {
        opacityRef.current = 0
      }
      wasVisibleRef.current = v
    },
    setPositionZ(z: number) {
      if (groupRef.current) {
        groupRef.current.position.z = z
      }
    },
  }))

  useFrame((_, delta) => {
    if (!visibleRef.current || opacityRef.current >= 1) return
    opacityRef.current = Math.min(1, opacityRef.current + delta * FADE_SPEED)
    const group = groupRef.current
    if (!group) return
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material as THREE.Material
        mat.transparent = true
        mat.opacity = opacityRef.current
      }
    })
  })

  const aspect = image.width / image.height
  const imgHeight = WALL_HEIGHT
  const imgWidth = imgHeight * aspect
  const wallWidth = imgWidth + border * 2
  const wallHeight = imgHeight + border * 2
  const wallColor = isDarkMode ? "#333333" : "#E8E8E8"

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      <mesh>
        <boxGeometry args={[wallWidth, wallHeight, depth]} />
        <meshStandardMaterial color={wallColor} transparent opacity={0} />
      </mesh>
      <mesh position={[0, 0, depth / 2 + 0.15]}>
        <planeGeometry args={[imgWidth, imgHeight]} />
        <meshBasicMaterial map={texture} transparent opacity={0} />
      </mesh>
    </group>
  )
})
