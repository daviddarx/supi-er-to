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

/** Camera starting Z position. */
export const CAMERA_START_Z = 8

/** How much each scroll pixel moves the camera target Z position. */
const SCROLL_SPEED = 0.025

/** Lerp factor for camera easing (0–1, lower = smoother). */
const CAMERA_LERP = 0.06

/** Max horizontal rotation from mouse position (radians). */
const MOUSE_LOOK_AMOUNT = 0.15

/** Lerp factor for mouse-look easing. */
const MOUSE_LOOK_LERP = 0.04

/** How far ahead (in world units) to show walls. */
const VISIBLE_AHEAD = 400

/** How far behind (in world units) to keep walls visible. */
const VISIBLE_BEHIND = 30

/** Small padding factor so the image doesn't touch the screen edges. */
const FOCUS_PADDING = 1.15

/** Lerp speed for focus/unfocus camera animation. */
const FOCUS_LERP = 0.04

interface ThreeDSceneProps {
  images: GalleryImage[]
  isDarkMode: boolean
  onReady?: () => void
}

interface WallConfig {
  image: GalleryImage
  position: [number, number, number]
  rotation: [number, number, number]
  border: number
  depth: number
  z: number
  isLeft: boolean
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
        isLeft: true,
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
        isLeft: false,
      })
      rightZ += wallWidth + WALL_GAP
    }
  }

  const totalLength = Math.max(leftZ, rightZ)
  return { walls, totalLength }
}

export function ThreeDScene({ images, isDarkMode, onReady }: ThreeDSceneProps) {
  const { scene, camera, gl } = useThree()
  scene.background = new THREE.Color(isDarkMode ? "#0a0a0a" : "#f8f8f8")

  const { walls, totalLength } = useMemo(() => computeLayout(images), [images])

  // Track wall texture instantiation — signal parent when all walls are ready
  const readyCountRef = useRef(0)
  const sceneReadyRef = useRef(false)
  const handleWallReady = useMemo(() => {
    return () => {
      readyCountRef.current++
      if (!sceneReadyRef.current && readyCountRef.current >= walls.length) {
        sceneReadyRef.current = true
        onReady?.()
      }
    }
  }, [walls.length, onReady])

  // Precompute per-side wall index arrays (corridor order) for arrow-key navigation
  const { leftIndices, rightIndices } = useMemo(() => {
    const left: number[] = []
    const right: number[] = []
    walls.forEach((w, i) => {
      if (w.isLeft) left.push(i)
      else right.push(i)
    })
    return { leftIndices: left, rightIndices: right }
  }, [walls])

  const wallRefs = useMemo(() => walls.map(() => createRef<WallHandle>()), [walls])

  // Camera scroll state
  const targetZ = useRef(CAMERA_START_Z)
  const mouseX = useRef(0)
  const currentRotationY = useRef(0)
  const isTouch = useRef(false)

  // Focus state — all in refs for imperative animation
  const focusedWall = useRef<number | null>(null)
  const focusTarget = useRef(new THREE.Vector3())
  const focusLookAt = useRef(new THREE.Vector3())
  const returnPosition = useRef(new THREE.Vector3())
  const returnRotationY = useRef(0)
  const isFocusing = useRef(false)
  const isReturning = useRef(false)

  // Scratch objects for lookAt quaternion computation
  const lookAtMatrix = useRef(new THREE.Matrix4())
  const lookAtQuat = useRef(new THREE.Quaternion())

  const focusOnWall = (wallIndex: number) => {
    const wall = walls[wallIndex]
    // Compute effective Z the same way as in useFrame (may be looped)
    const camZ = camera.position.z
    let effectiveZ = wall.z
    if (totalLength > 0) {
      const loopOffset = Math.round((camZ - wall.z) / totalLength) * totalLength
      effectiveZ = wall.z + loopOffset
    }

    // Compute image dimensions in world units
    const aspect = wall.image.width / wall.image.height
    const imgHeight = WALL_HEIGHT
    const imgWidth = imgHeight * aspect

    // Compute distance so the image fits the screen with minimal cropping
    const cam = camera as THREE.PerspectiveCamera
    const fovRad = (cam.fov * Math.PI) / 180
    const screenAspect = cam.aspect
    const distV = (imgHeight / 2 / Math.tan(fovRad / 2)) * FOCUS_PADDING
    const distH = (imgWidth / 2 / (Math.tan(fovRad / 2) * screenAspect)) * FOCUS_PADDING
    const focusDistance = Math.max(distV, distH)

    // Compute camera position: in front of the wall face
    const wallX = wall.position[0]
    const offset = wall.isLeft ? focusDistance : -focusDistance
    focusTarget.current.set(wallX + offset, 0, effectiveZ)
    focusLookAt.current.set(wallX, 0, effectiveZ)

    // Save return position only when entering focus from corridor
    if (!isFocusing.current) {
      returnPosition.current.set(0, 0, camera.position.z)
      returnRotationY.current = currentRotationY.current
    }

    focusedWall.current = wallIndex
    isFocusing.current = true
    isReturning.current = false
    window.dispatchEvent(new Event("image-zoomed-in"))
  }

  const handleWallClick = (wallIndex: number) => {
    if (isFocusing.current && focusedWall.current === wallIndex) {
      unfocus()
      return
    }
    focusOnWall(wallIndex)
  }

  const unfocus = () => {
    if (!isFocusing.current) return
    window.dispatchEvent(new Event("image-zoomed-out"))
    // Update scroll target to match current camera Z so corridor resumes nearby
    targetZ.current = camera.position.z
    isFocusing.current = false
    isReturning.current = true
    focusedWall.current = null
  }

  // Keyboard handler: Escape to unfocus, arrows to navigate between walls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFocusing.current) {
        unfocus()
        return
      }

      if (!isFocusing.current || focusedWall.current === null) return

      const currentIndex = focusedWall.current
      const wall = walls[currentIndex]
      const sameIndices = wall.isLeft ? leftIndices : rightIndices
      const posInSide = sameIndices.indexOf(currentIndex)

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault()
        // When facing a left wall the camera looks left, so ArrowLeft = deeper (next).
        // When facing a right wall the camera looks right, so ArrowLeft = shallower (prev).
        const goDeeper =
          (e.key === "ArrowRight" && wall.isLeft) || (e.key === "ArrowLeft" && !wall.isLeft)
        // Block going shallower past the first wall (toward corridor entrance)
        if (!goDeeper && posInSide === 0) return
        const nextPos = goDeeper ? (posInSide + 1) % sameIndices.length : posInSide - 1
        focusOnWall(sameIndices[nextPos])
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault()
        // Switch to closest wall on the opposite side
        const otherIndices = wall.isLeft ? rightIndices : leftIndices
        let closestIdx = otherIndices[0]
        let closestDist = Infinity
        for (const idx of otherIndices) {
          const dist = Math.abs(walls[idx].z - wall.z)
          if (dist < closestDist) {
            closestDist = dist
            closestIdx = idx
          }
        }
        focusOnWall(closestIdx)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [walls, leftIndices, rightIndices])

  useEffect(() => {
    const canvas = gl.domElement

    const handleTouchStart = () => {
      isTouch.current = true
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (isFocusing.current) return // Disable scroll when focused
      targetZ.current -= e.deltaY * SCROLL_SPEED
      targetZ.current = Math.min(CAMERA_START_Z, targetZ.current)
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
    if (isFocusing.current) {
      // Animate camera to focused wall
      camera.position.lerp(focusTarget.current, FOCUS_LERP)

      // Smoothly rotate to look at the wall
      lookAtMatrix.current.lookAt(camera.position, focusLookAt.current, camera.up)
      lookAtQuat.current.setFromRotationMatrix(lookAtMatrix.current)
      camera.quaternion.slerp(lookAtQuat.current, FOCUS_LERP)
    } else if (isReturning.current) {
      // Animate back to corridor center
      const returnTarget = new THREE.Vector3(0, 0, targetZ.current)
      camera.position.lerp(returnTarget, FOCUS_LERP)

      // Lerp Y toward the current mouse-look target so there's no jump when corridor mode takes over
      const mouseTarget = isTouch.current ? 0 : -mouseX.current * MOUSE_LOOK_AMOUNT
      camera.rotation.x += (0 - camera.rotation.x) * FOCUS_LERP
      camera.rotation.y += (mouseTarget - camera.rotation.y) * FOCUS_LERP
      camera.rotation.z += (0 - camera.rotation.z) * FOCUS_LERP

      // Check if position and all rotation axes have converged
      const dist = camera.position.distanceTo(returnTarget)
      const rotConverged =
        Math.abs(camera.rotation.x) < 0.005 &&
        Math.abs(camera.rotation.y - mouseTarget) < 0.005 &&
        Math.abs(camera.rotation.z) < 0.005
      if (dist < 0.1 && rotConverged) {
        currentRotationY.current = camera.rotation.y
        isReturning.current = false
      }
    } else {
      // Normal corridor mode
      camera.position.z += (targetZ.current - camera.position.z) * CAMERA_LERP

      if (!isTouch.current) {
        const targetRotation = -mouseX.current * MOUSE_LOOK_AMOUNT
        currentRotationY.current += (targetRotation - currentRotationY.current) * MOUSE_LOOK_LERP
        camera.rotation.y = currentRotationY.current
      }
    }

    // Visibility culling — always runs
    const camZ = camera.position.z
    const frontZ = camZ + VISIBLE_BEHIND
    const backZ = camZ - VISIBLE_AHEAD

    for (let i = 0; i < walls.length; i++) {
      const wallZ = walls[i].z
      let effectiveZ = wallZ
      if (totalLength > 0) {
        const loopOffset = Math.round((camZ - wallZ) / totalLength) * totalLength
        effectiveZ = wallZ + loopOffset
      }
      const visible = effectiveZ <= frontZ && effectiveZ >= backZ && effectiveZ <= 0
      const handle = wallRefs[i].current
      if (handle) {
        handle.setVisible(visible)
        if (visible) {
          handle.setPositionZ(effectiveZ)
        }
      }
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
            onClick={() => handleWallClick(i)}
            onReady={handleWallReady}
          />
        </Suspense>
      ))}
    </>
  )
}
