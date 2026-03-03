"use client"

import { useMemo, useRef } from "react"
import { Building } from "./Building"
import { CameraController, type CameraControllerHandle } from "./CameraController"
import { generateCity } from "./generateCity"
import type { GalleryImage } from "@/types"

interface CitySceneProps {
  images: GalleryImage[]
  isDarkMode: boolean
}

/**
 * Three.js scene containing the full procedural city.
 *
 * Responsibilities:
 * - Generates building configs + camera targets once per image set (useMemo)
 * - Renders all Building instances and lighting
 * - Wires graffiti clicks → CameraController.focusOnBuilding via imperative ref
 *
 * The city layout is random per session (Math.random, not seeded) and
 * regenerates whenever the images array reference changes (filter change).
 */
export function CityScene({ images, isDarkMode }: CitySceneProps) {
  const cameraControllerRef = useRef<CameraControllerHandle>(null)

  // generateCity is expensive with large image sets; memoize by image array identity.
  const { buildings, graffitiTargets } = useMemo(() => generateCity(images), [images])

  /**
   * Called when a user clicks a graffiti plane.
   * Instructs the camera to drift to that building's viewing position.
   */
  const handleGraffitiClick = (buildingId: string) => {
    cameraControllerRef.current?.focusOnBuilding(buildingId)
  }

  return (
    <>
      {/* Ambient light: fills shadow areas so unlit faces aren't pure black. */}
      <ambientLight intensity={0.6} />

      {/*
       * Directional light from the upper-right, simulating late-afternoon sun.
       * Positioned far away so shadows are roughly parallel (orthographic).
       */}
      <directionalLight position={[50, 100, 50]} intensity={0.8} />

      {buildings.map((config, idx) => (
        <Building
          key={`${idx}-${config.id}`}
          config={config}
          isDarkMode={isDarkMode}
          onGraffitiClick={() => handleGraffitiClick(config.id)}
        />
      ))}

      <CameraController ref={cameraControllerRef} targets={graffitiTargets} />
    </>
  )
}
