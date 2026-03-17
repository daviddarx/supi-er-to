"use client"

import { useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"
import { Wall } from "./Wall"
import type { GalleryImage } from "@/types"

interface ThreeDSceneProps {
  images: GalleryImage[]
  isDarkMode: boolean
}

export function ThreeDScene({ images, isDarkMode }: ThreeDSceneProps) {
  const { scene } = useThree()

  scene.background = new THREE.Color(isDarkMode ? "#0a0a0a" : "#f8f8f8")

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[50, 100, 50]} intensity={0.8} />

      {images.length > 0 && <Wall image={images[0]} isDarkMode={isDarkMode} />}

      <OrbitControls enableDamping dampingFactor={0.05} />
    </>
  )
}
