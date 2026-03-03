"use client"

import { Suspense } from "react"
import { Canvas } from "@react-three/fiber"
import { CityScene } from "./experimental/CityScene"
import type { GalleryImage } from "@/types"

interface ExperimentalGalleryProps {
  images: GalleryImage[]
  isDarkMode: boolean
}

/**
 * Experimental gallery mode — a procedurally generated 3D city where each
 * graffiti image appears as a texture on the wall of a rooftop stairhouse.
 *
 * The city layout is random per session. The camera auto-drifts between pieces;
 * clicking any graffiti plane snaps the camera to that building.
 * OrbitControls remain fully active for manual exploration.
 *
 * Rendering is client-only (no SSR). Texture loading is async via useTexture
 * inside Building components, suspended by the <Suspense> boundary below.
 *
 * @param images     - Filtered + sorted gallery images (already processed by page.tsx)
 * @param isDarkMode - Controls scene background and building palette
 */
export default function ExperimentalGallery({ images, isDarkMode }: ExperimentalGalleryProps) {
  const bgColor = isDarkMode ? "#0a0a0a" : "#f8f8f8"

  return (
    /*
     * position: fixed + inset: 0 fills the entire viewport, sitting below the
     * Header/OptionsBar which are z-indexed above the canvas.
     */
    <div style={{ position: "fixed", inset: 0 }}>
      <Canvas
        camera={{ position: [0, 80, 80], fov: 50, near: 0.1, far: 2000 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: bgColor }}
      >
        {/*
         * Suspense fallback is null — the canvas background colour is already
         * visible, so a loading spinner inside 3D space is unnecessary.
         * Buildings individually fade in as their textures resolve.
         */}
        <Suspense fallback={null}>
          <CityScene images={images} isDarkMode={isDarkMode} />
        </Suspense>
      </Canvas>
    </div>
  )
}
