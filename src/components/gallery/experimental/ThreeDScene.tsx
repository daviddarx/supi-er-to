"use client"

import { Suspense, useMemo, useRef, useEffect, createRef } from "react"
import { useThree, useFrame } from "@react-three/fiber"
import * as THREE from "three"
import {
  Wall,
  WALL_HEIGHT,
  BORDER as BASE_BORDER,
  WALL_DEPTH as BASE_DEPTH,
  type WallHandle,
} from "./Wall"
import type { GalleryImage } from "@/types"

/** Distance between left and right walls (corridor width). */
const CORRIDOR_WIDTH = 14

/** Gap between consecutive same-side walls, approximately matching border width. */
const WALL_GAP = BASE_BORDER * 3

/** Slight inward rotation so walls face the viewer a bit more (radians). */
const INWARD_ANGLE = 0.25

/** How much each scroll pixel moves the camera target Z position. */
const SCROLL_SPEED = 0.025

/** Lerp factor for camera easing (0–1, lower = smoother). */
const CAMERA_LERP = 0.06

/** Max horizontal rotation from mouse position (radians). */
const MOUSE_LOOK_AMOUNT = 0.15

/** Lerp factor for mouse-look easing. */
const MOUSE_LOOK_LERP = 0.04

/** How far ahead (in world units) to show walls. */
const VISIBLE_AHEAD = 200

/** How far behind (in world units) to keep walls visible. */
const VISIBLE_BEHIND = 30

interface ThreeDSceneProps {
  images: GalleryImage[]
  isDarkMode: boolean
}

interface WallConfig {
  image: GalleryImage
  position: [number, number, number]
  rotation: [number, number, number]
  border: number
  depth: number
  z: number
}

function computeLayout(images: GalleryImage[]) {
  const walls: WallConfig[] = []
  let leftZ = 0
  let rightZ = 0

  for (let i = 0; i < images.length; i++) {
    const image = images[i]
    const isLeft = i % 2 === 0
    const randomFactor = () => 0.5 + Math.random()
    const border = BASE_BORDER * randomFactor()
    const depth = BASE_DEPTH * randomFactor()

    const aspect = image.width / image.height
    const imgWidth = WALL_HEIGHT * aspect
    const wallWidth = imgWidth + border * 2

    if (isLeft) {
      const z = -(leftZ + wallWidth / 2)
      walls.push({
        image,
        position: [-CORRIDOR_WIDTH / 2, 0, z],
        rotation: [0, Math.PI / 2 - INWARD_ANGLE, 0],
        border,
        depth,
        z,
      })
      leftZ += wallWidth + WALL_GAP
    } else {
      const z = -(rightZ + wallWidth / 2)
      walls.push({
        image,
        position: [CORRIDOR_WIDTH / 2, 0, z],
        rotation: [0, -Math.PI / 2 + INWARD_ANGLE, 0],
        border,
        depth,
        z,
      })
      rightZ += wallWidth + WALL_GAP
    }
  }

  const totalLength = Math.max(leftZ, rightZ)
  return { walls, totalLength }
}

export function ThreeDScene({ images, isDarkMode }: ThreeDSceneProps) {
  const { scene, camera, gl } = useThree()
  scene.background = new THREE.Color(isDarkMode ? "#0a0a0a" : "#f8f8f8")

  const { walls, totalLength } = useMemo(() => computeLayout(images), [images])

  // One ref per wall for imperative visibility control
  const wallRefs = useMemo(() => walls.map(() => createRef<WallHandle>()), [walls])

  // Camera scroll state — all in refs, no React state
  const targetZ = useRef(12)
  const mouseX = useRef(0)
  const currentRotationY = useRef(0)
  const isTouch = useRef(false)

  useEffect(() => {
    const canvas = gl.domElement

    const handleTouchStart = () => {
      isTouch.current = true
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      targetZ.current -= e.deltaY * SCROLL_SPEED
      targetZ.current = Math.min(12, targetZ.current)
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (isTouch.current) return
      mouseX.current = (e.clientX / window.innerWidth) * 2 - 1
    }

    canvas.addEventListener("wheel", handleWheel, { passive: false })
    window.addEventListener("mousemove", handleMouseMove)
    canvas.addEventListener("touchstart", handleTouchStart, { once: true })
    return () => {
      canvas.removeEventListener("wheel", handleWheel)
      window.removeEventListener("mousemove", handleMouseMove)
      canvas.removeEventListener("touchstart", handleTouchStart)
    }
  }, [gl])

  // All updates in a single useFrame — no React state, pure imperative
  useFrame(() => {
    // Camera scroll easing
    camera.position.z += (targetZ.current - camera.position.z) * CAMERA_LERP
    const camZ = camera.position.z

    // Mouse-look
    if (!isTouch.current) {
      const targetRotation = -mouseX.current * MOUSE_LOOK_AMOUNT
      currentRotationY.current += (targetRotation - currentRotationY.current) * MOUSE_LOOK_LERP
      camera.rotation.y = currentRotationY.current
    }

    // Visibility culling — pure imperative, no setState
    const frontZ = camZ + VISIBLE_BEHIND
    const backZ = camZ - VISIBLE_AHEAD

    for (let i = 0; i < walls.length; i++) {
      const wallZ = walls[i].z
      // For infinite loop: also check if wall should appear from a repeated loop
      let effectiveZ = wallZ
      if (totalLength > 0) {
        // Find the closest repeat of this wall to the camera
        const loopOffset = Math.round((camZ - wallZ) / totalLength) * totalLength
        effectiveZ = wallZ + loopOffset
      }
      const visible = effectiveZ <= frontZ && effectiveZ >= backZ
      wallRefs[i].current?.setVisible(visible)
    }
  })

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[50, 100, 50]} intensity={0.8} />

      {walls.map((w, i) => (
        <Suspense key={i} fallback={null}>
          <Wall
            ref={wallRefs[i]}
            image={w.image}
            isDarkMode={isDarkMode}
            position={w.position}
            rotation={w.rotation}
            border={w.border}
            depth={w.depth}
          />
        </Suspense>
      ))}
    </>
  )
}
