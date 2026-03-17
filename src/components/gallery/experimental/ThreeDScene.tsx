"use client"

import { Suspense, useMemo, useRef, useEffect, useState, useCallback } from "react"
import { useThree, useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { Wall, WALL_HEIGHT, BORDER as BASE_BORDER, WALL_DEPTH as BASE_DEPTH } from "./Wall"
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

/** How many walls to render ahead of the camera. */
const RENDER_AHEAD = 20

/** How many walls to keep behind the camera before culling. */
const RENDER_BEHIND = 5

interface ThreeDSceneProps {
  images: GalleryImage[]
  isDarkMode: boolean
}

/** Precomputed layout for a single wall slot in one loop of all images. */
interface WallSlot {
  imageIndex: number
  localZ: number
  isLeft: boolean
  border: number
  depth: number
}

/**
 * Precompute the layout for one full loop of all images.
 * Returns the slots and the total Z length of one loop.
 */
function computeLoopLayout(images: GalleryImage[]) {
  const slots: WallSlot[] = []
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
      slots.push({ imageIndex: i, localZ: leftZ + wallWidth / 2, isLeft: true, border, depth })
      leftZ += wallWidth + WALL_GAP
    } else {
      slots.push({ imageIndex: i, localZ: rightZ + wallWidth / 2, isLeft: false, border, depth })
      rightZ += wallWidth + WALL_GAP
    }
  }

  const loopLength = Math.max(leftZ, rightZ)
  return { slots, loopLength }
}

function ScrollCamera({ onCameraZ }: { onCameraZ: (z: number) => void }) {
  const { camera, gl } = useThree()
  const targetZ = useRef(camera.position.z)
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
      // No upper clamp needed — infinite scroll forward, but don't go backward past start
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

  useFrame(() => {
    camera.position.z += (targetZ.current - camera.position.z) * CAMERA_LERP
    onCameraZ(camera.position.z)

    if (!isTouch.current) {
      const targetRotation = -mouseX.current * MOUSE_LOOK_AMOUNT
      currentRotationY.current += (targetRotation - currentRotationY.current) * MOUSE_LOOK_LERP
      camera.rotation.y = currentRotationY.current
    }
  })

  return null
}

/** Unique key for a visible wall instance (loop index + slot index). */
interface VisibleWall {
  key: string
  image: GalleryImage
  position: [number, number, number]
  rotation: [number, number, number]
  border: number
  depth: number
}

export function ThreeDScene({ images, isDarkMode }: ThreeDSceneProps) {
  const { scene } = useThree()
  scene.background = new THREE.Color(isDarkMode ? "#0a0a0a" : "#f8f8f8")

  const { slots, loopLength } = useMemo(() => computeLoopLayout(images), [images])

  const [visibleWalls, setVisibleWalls] = useState<VisibleWall[]>([])
  const cameraZRef = useRef(12)

  const updateVisibleWalls = useCallback(() => {
    if (slots.length === 0 || loopLength === 0) return

    const camZ = cameraZRef.current
    // Camera moves in negative Z. Determine the visible range.
    const frontZ = camZ + RENDER_BEHIND * 6 // a bit behind
    const backZ = camZ - RENDER_AHEAD * 12 // well ahead

    // Determine which loops are potentially visible
    // camZ is positive at start, goes negative. localZ in slots is positive (offset from 0).
    // World Z for a wall = -(loopIndex * loopLength + slot.localZ)

    const result: VisibleWall[] = []

    // Figure out the loop range we need
    // worldZ = -(loop * loopLength + localZ)
    // For worldZ >= backZ: loop * loopLength + localZ <= -backZ
    // For worldZ <= frontZ: loop * loopLength + localZ >= -frontZ
    const minOffset = Math.max(0, -frontZ)
    const maxOffset = -backZ

    const minLoop = Math.floor(minOffset / loopLength)
    const maxLoop = Math.ceil(maxOffset / loopLength)

    for (let loop = minLoop; loop <= maxLoop; loop++) {
      for (let s = 0; s < slots.length; s++) {
        const slot = slots[s]
        const worldZ = -(loop * loopLength + slot.localZ)

        if (worldZ <= frontZ && worldZ >= backZ) {
          const x = slot.isLeft ? -CORRIDOR_WIDTH / 2 : CORRIDOR_WIDTH / 2
          const rotY = slot.isLeft ? Math.PI / 2 - INWARD_ANGLE : -Math.PI / 2 + INWARD_ANGLE
          result.push({
            key: `${loop}-${s}`,
            image: images[slot.imageIndex],
            position: [x, 0, worldZ],
            rotation: [0, rotY, 0],
            border: slot.border,
            depth: slot.depth,
          })
        }
      }
    }

    setVisibleWalls(result)
  }, [slots, loopLength, images])

  // Initial population
  useEffect(() => {
    updateVisibleWalls()
  }, [updateVisibleWalls])

  const frameCount = useRef(0)
  const handleCameraZ = useCallback(
    (z: number) => {
      cameraZRef.current = z
      // Update visibility every 10 frames to avoid excessive state updates
      frameCount.current++
      if (frameCount.current % 10 === 0) {
        updateVisibleWalls()
      }
    },
    [updateVisibleWalls]
  )

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[50, 100, 50]} intensity={0.8} />

      {visibleWalls.map((w) => (
        <Suspense key={w.key} fallback={null}>
          <Wall
            image={w.image}
            isDarkMode={isDarkMode}
            position={w.position}
            rotation={w.rotation}
            border={w.border}
            depth={w.depth}
          />
        </Suspense>
      ))}

      <ScrollCamera onCameraZ={handleCameraZ} />
    </>
  )
}
