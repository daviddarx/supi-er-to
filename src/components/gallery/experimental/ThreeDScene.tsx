"use client"

import { useMemo, useRef, useEffect } from "react"
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
}

function ScrollCamera({ corridorEnd }: { corridorEnd: number }) {
  const { camera, gl } = useThree()
  const targetZ = useRef(camera.position.z)
  // Mouse X normalized to -1..1, and current smoothed value
  const mouseX = useRef(0)
  const currentRotationY = useRef(0)
  const isTouch = useRef(false)

  useEffect(() => {
    const canvas = gl.domElement

    // Detect touch device on first touch
    const handleTouchStart = () => {
      isTouch.current = true
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      targetZ.current -= e.deltaY * SCROLL_SPEED
      targetZ.current = Math.min(12, Math.max(corridorEnd, targetZ.current))
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (isTouch.current) return
      // Normalize mouse X to -1..1
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
  }, [gl, corridorEnd])

  useFrame(() => {
    // Scroll easing
    camera.position.z += (targetZ.current - camera.position.z) * CAMERA_LERP

    // Mouse-look easing (non-touch only)
    if (!isTouch.current) {
      const targetRotation = -mouseX.current * MOUSE_LOOK_AMOUNT
      currentRotationY.current += (targetRotation - currentRotationY.current) * MOUSE_LOOK_LERP
      camera.rotation.y = currentRotationY.current
    }
  })

  return null
}

export function ThreeDScene({ images, isDarkMode }: ThreeDSceneProps) {
  const { scene } = useThree()

  scene.background = new THREE.Color(isDarkMode ? "#0a0a0a" : "#f8f8f8")

  const { walls, corridorEnd } = useMemo(() => {
    const result: WallConfig[] = []
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
        result.push({
          image,
          position: [-CORRIDOR_WIDTH / 2, 0, z],
          rotation: [0, Math.PI / 2 - INWARD_ANGLE, 0],
          border,
          depth,
        })
        leftZ += wallWidth + WALL_GAP
      } else {
        const z = -(rightZ + wallWidth / 2)
        result.push({
          image,
          position: [CORRIDOR_WIDTH / 2, 0, z],
          rotation: [0, -Math.PI / 2 + INWARD_ANGLE, 0],
          border,
          depth,
        })
        rightZ += wallWidth + WALL_GAP
      }
    }

    const end = -Math.max(leftZ, rightZ)
    return { walls: result, corridorEnd: end }
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
          rotation={w.rotation}
          border={w.border}
          depth={w.depth}
        />
      ))}

      <ScrollCamera corridorEnd={corridorEnd} />
    </>
  )
}
