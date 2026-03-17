"use client"

import { useMemo } from "react"
import { useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"
import { Wall } from "./Wall"
import type { GalleryImage } from "@/types"

/** Base values — each wall gets a random variation of ±50%. */
const BASE_BORDER = 1.2
const BASE_DEPTH = 1.5

/** Spacing between walls in the grid. */
const GRID_SPACING = 16

interface ThreeDSceneProps {
  images: GalleryImage[]
  isDarkMode: boolean
}

interface WallConfig {
  image: GalleryImage
  position: [number, number, number]
  border: number
  depth: number
}

export function ThreeDScene({ images, isDarkMode }: ThreeDSceneProps) {
  const { scene } = useThree()

  scene.background = new THREE.Color(isDarkMode ? "#0a0a0a" : "#f8f8f8")

  const walls: WallConfig[] = useMemo(() => {
    const cols = Math.ceil(Math.sqrt(images.length))
    return images.map((image, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const randomFactor = () => 0.5 + Math.random() // 0.5 to 1.5
      return {
        image,
        position: [
          col * GRID_SPACING - ((cols - 1) * GRID_SPACING) / 2,
          0,
          row * GRID_SPACING - ((Math.ceil(images.length / cols) - 1) * GRID_SPACING) / 2,
        ] as [number, number, number],
        border: BASE_BORDER * randomFactor(),
        depth: BASE_DEPTH * randomFactor(),
      }
    })
  }, [images])

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[50, 100, 50]} intensity={0.8} />

      {walls.map((w) => (
        <Wall
          key={w.image.id}
          image={w.image}
          isDarkMode={isDarkMode}
          position={w.position}
          border={w.border}
          depth={w.depth}
        />
      ))}

      <OrbitControls enableDamping dampingFactor={0.05} />
    </>
  )
}
