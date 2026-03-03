"use client"

import { useRef, useEffect } from "react"
import { useFrame } from "@react-three/fiber"
import { useTexture } from "@react-three/drei"
import * as THREE from "three"
import type { BuildingConfig } from "./types"
import { getImageSrc } from "@/lib/images"

interface BuildingProps {
  config: BuildingConfig
  isDarkMode: boolean
  /** Called when the user clicks the graffiti plane — triggers camera focus. */
  onGraffitiClick: () => void
}

/**
 * Renders a single procedural building consisting of:
 *   1. A main body box
 *   2. A rooftop stairhouse box
 *   3. A graffiti plane on one face of the rooftop, textured with the gallery image
 *
 * Buildings fade in from transparent to opaque over ~1.25s via useFrame.
 * The graffiti plane is clickable to trigger a camera focus transition.
 *
 * @param config     - Procedurally generated dimensions and position
 * @param isDarkMode - Controls building colour (dark/light palette)
 * @param onGraffitiClick - Callback for camera focus
 */
export function Building({ config, isDarkMode, onGraffitiClick }: BuildingProps) {
  const { position, bodySize, rooftop } = config

  const bodyMeshRef = useRef<THREE.Mesh>(null)
  const rooftopMeshRef = useRef<THREE.Mesh>(null)
  const graffitiMeshRef = useRef<THREE.Mesh>(null)
  // Track fade progress outside React state to avoid re-renders each frame.
  const opacityRef = useRef(0)

  // useTexture suspends until the texture is loaded, handled by the parent <Suspense>.
  const texture = useTexture(getImageSrc(config.id, 1280))

  // Flip texture right-way-up (WebP images are typically Y-flipped in WebGL).
  texture.flipY = false

  const bodyColor = isDarkMode ? "#2A2A2A" : "#F0F0F0"
  const rooftopColor = isDarkMode ? "#333333" : "#E8E8E8"

  // Fade-in animation: lerp opacity from 0 → 1 over ~1.25s.
  useFrame((_, delta) => {
    if (opacityRef.current >= 1) return
    opacityRef.current = Math.min(1, opacityRef.current + delta * 0.8)
    const mat1 = bodyMeshRef.current?.material as THREE.MeshStandardMaterial | undefined
    const mat2 = rooftopMeshRef.current?.material as THREE.MeshStandardMaterial | undefined
    const mat3 = graffitiMeshRef.current?.material as THREE.MeshBasicMaterial | undefined
    if (mat1) mat1.opacity = opacityRef.current
    if (mat2) mat2.opacity = opacityRef.current
    if (mat3) mat3.opacity = opacityRef.current
  })

  // Sync building colour when dark mode toggles without remounting.
  useEffect(() => {
    const mat1 = bodyMeshRef.current?.material as THREE.MeshStandardMaterial | undefined
    const mat2 = rooftopMeshRef.current?.material as THREE.MeshStandardMaterial | undefined
    if (mat1) mat1.color.set(bodyColor)
    if (mat2) mat2.color.set(rooftopColor)
  }, [isDarkMode, bodyColor, rooftopColor])

  // Dispose texture on unmount to free GPU memory.
  useEffect(() => {
    return () => {
      texture.dispose()
    }
  }, [texture])

  // ─── Derived geometry values ───────────────────────────────────────────────

  const [rw, rh, rd] = rooftop.size

  /**
   * Y of the rooftop mesh centre in local group space.
   * Group origin is at ground (Y=0), so:
   *   body occupies [0 .. bodySize[1]]
   *   rooftop occupies [bodySize[1] .. bodySize[1] + rh]
   */
  const rooftopCenterY = bodySize[1] + rh / 2

  /**
   * Position of the graffiti plane in local group space.
   * Y = rooftopCenterY (centre of the rooftop wall face).
   * XZ = pushed just outside the rooftop face by 0.01 to avoid z-fighting.
   */
  const graffitiPosition: [number, number, number] = (() => {
    switch (rooftop.graffitiWall) {
      case "north":
        return [0, rooftopCenterY, -rd / 2 - 0.01]
      case "south":
        return [0, rooftopCenterY, rd / 2 + 0.01]
      case "east":
        return [rw / 2 + 0.01, rooftopCenterY, 0]
      case "west":
        return [-rw / 2 - 0.01, rooftopCenterY, 0]
    }
  })()

  /** Rotation so the plane faces outward from the rooftop wall. */
  const graffitiRotation: [number, number, number] = (() => {
    switch (rooftop.graffitiWall) {
      case "north":
        return [0, 0, 0]
      case "south":
        return [0, Math.PI, 0]
      case "east":
        return [0, Math.PI / 2, 0]
      case "west":
        return [0, -Math.PI / 2, 0]
    }
  })()

  /**
   * Scale the graffiti plane to 90% of the rooftop wall dimensions.
   * Keeps a small border of wall visible around the artwork.
   */
  const graffitiWidth = rw * 0.9
  const graffitiHeight = rh * 0.9

  return (
    <group position={position}>
      {/* Main building body */}
      <mesh ref={bodyMeshRef} position={[0, bodySize[1] / 2, 0]}>
        <boxGeometry args={bodySize} />
        <meshStandardMaterial color={bodyColor} transparent opacity={0} />
      </mesh>

      {/* Rooftop stairhouse */}
      <mesh ref={rooftopMeshRef} position={[0, rooftopCenterY, 0]}>
        <boxGeometry args={rooftop.size} />
        <meshStandardMaterial color={rooftopColor} transparent opacity={0} />
      </mesh>

      {/* Graffiti plane — clickable to focus camera */}
      <mesh
        ref={graffitiMeshRef}
        position={graffitiPosition}
        rotation={graffitiRotation}
        onClick={(e) => {
          // Stop propagation so OrbitControls doesn't misinterpret the click.
          e.stopPropagation()
          onGraffitiClick()
        }}
      >
        <planeGeometry args={[graffitiWidth, graffitiHeight]} />
        {/*
         * meshBasicMaterial ignores scene lighting so the graffiti is always
         * fully visible regardless of light direction or angle.
         * Initial opacity 0 — synced with body/rooftop via the useFrame fade-in.
         */}
        <meshBasicMaterial map={texture} transparent opacity={0} />
      </mesh>
    </group>
  )
}
