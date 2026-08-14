"use client"

import { Suspense, useMemo, useRef, useEffect, useState, useCallback, createRef } from "react"
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
const WALL_GAP = BASE_BORDER * 4

/** Slight inward rotation so walls face the viewer a bit more (radians). */
const INWARD_ANGLE = 0.25

/** Z-axis rotation increment per row (radians). ~5° per row. */
const TWIST_PER_ROW = (5 * Math.PI) / 180

/** How far ahead (in world units) the camera twist targets, to better align with visible rows. */
const TWIST_LOOK_AHEAD = 15

/** Camera starting Z at the reference aspect ratio (2560/1229). */
const BASE_START_Z = 8
/** Reference aspect ratio where BASE_START_Z was tuned. */
const REF_ASPECT = 2560 / 1229

/**
 * Compute starting Z so the horizontal coverage matches the reference aspect.
 * At narrower viewports the camera pulls back to keep the same world width visible.
 */
export function computeStartZ(aspect: number): number {
  if (aspect >= REF_ASPECT) return BASE_START_Z
  // Horizontal FOV scales with aspect. To see the same width, push camera back proportionally.
  return BASE_START_Z * (REF_ASPECT / aspect)
}

/** Fallback for Canvas initial position (will be corrected on first frame). */
export const CAMERA_START_Z = BASE_START_Z

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
const FOCUS_PADDING = 1.3

/** Lerp speed for focus/unfocus camera animation. */
const FOCUS_LERP = 0.04

/**
 * Lerp speed once a swipe is driving the focused camera — twice FOCUS_LERP, so
 * the camera trails the finger with half the lag. The tap-to-focus fly-in keeps
 * the slower FOCUS_LERP.
 */
const FOCUS_SWIPE_LERP = FOCUS_LERP * 2

/**
 * Fractional wall indices travelled per pixel of horizontal swipe while focused.
 * Tuned so a full-width phone swipe covers roughly two images, matching the
 * responsiveness of the corridor's vertical swipe.
 */
const FOCUS_SWIPE_SPEED = 0.005

/** Total touch travel (px) before a gesture counts as a drag instead of a tap. */
const DRAG_THRESHOLD = 8

/**
 * Frustum padding when testing whether a wall blocks the focused image.
 * Slightly over-hiding is invisible (those walls are off-screen anyway) whereas
 * under-hiding leaves a wall standing in front of the picture.
 */
const OCCLUDE_MARGIN = 1.1

/** Auto-drift speed: world units per second the camera moves into the corridor. */
const AUTO_DRIFT_SPEED = 1.5

/** Seconds of inactivity before auto-drift resumes after user interaction. */
const AUTO_DRIFT_RESUME_DELAY = 10

/** Max number of Wall components mounted at once (GPU texture limit on mobile). */
const MAX_MOUNTED_WALLS = 30

interface ThreeDSceneProps {
  images: GalleryImage[]
  isDarkMode: boolean
  textureSize: 500 | 1280
  onReady?: () => void
}

interface WallConfig {
  image: GalleryImage
  position: [number, number, number]
  rotation: [number, number, number]
  twistAngle: number
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

    // Row index: images 0,1 = row 0; 2,3 = row 1; etc.
    const row = Math.floor(i / 2)
    const twistAngle = -row * TWIST_PER_ROW

    if (isLeft) {
      const z = -(leftZ + wallWidth / 2)
      walls.push({
        image,
        position: [-CORRIDOR_WIDTH / 2, 0, z],
        rotation: [0, Math.PI / 2 - INWARD_ANGLE, 0],
        twistAngle,
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
        twistAngle,
        border,
        depth,
        z,
        isLeft: false,
      })
      rightZ += wallWidth + WALL_GAP
    }
  }

  // Build sorted twist map (Z → twistAngle) for camera interpolation.
  // One entry per row, using the average Z of the left/right wall in that row.
  const rowMap = new Map<number, { zSum: number; count: number; twist: number }>()
  for (const w of walls) {
    const row = Math.round(w.twistAngle / -TWIST_PER_ROW)
    const entry = rowMap.get(row) || { zSum: 0, count: 0, twist: w.twistAngle }
    entry.zSum += w.z
    entry.count++
    rowMap.set(row, entry)
  }
  // Sorted by Z descending (0 first, most negative last)
  const twistMap = Array.from(rowMap.values())
    .map((e) => ({ z: e.zSum / e.count, twist: e.twist }))
    .sort((a, b) => b.z - a.z)

  const totalLength = Math.max(leftZ, rightZ)
  return { walls, totalLength, twistMap }
}

const isMobile =
  typeof window !== "undefined" &&
  (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768)

export function ThreeDScene({ images, isDarkMode, textureSize, onReady }: ThreeDSceneProps) {
  const { scene, camera, gl } = useThree()
  scene.background = new THREE.Color(isDarkMode ? "#0a0a0a" : "#ffffff")

  const { walls, totalLength, twistMap } = useMemo(() => computeLayout(images), [images])

  /** Interpolate the twist angle for a given Z position from the twist map. */
  const getTwistAtZ = (z: number): number => {
    if (twistMap.length === 0) return 0
    // Before first row
    if (z >= twistMap[0].z) return twistMap[0].twist
    // After last row
    if (z <= twistMap[twistMap.length - 1].z) return twistMap[twistMap.length - 1].twist
    // Find the two surrounding entries and lerp
    for (let i = 0; i < twistMap.length - 1; i++) {
      if (z <= twistMap[i].z && z >= twistMap[i + 1].z) {
        const t = (z - twistMap[i].z) / (twistMap[i + 1].z - twistMap[i].z)
        return twistMap[i].twist + t * (twistMap[i + 1].twist - twistMap[i].twist)
      }
    }
    return 0
  }

  // Track wall texture instantiation — signal parent when all walls are ready
  const readyCountRef = useRef(0)
  const sceneReadyRef = useRef(false)
  const handleWallReady = useMemo(() => {
    return () => {
      readyCountRef.current++
      const readyThreshold = Math.min(walls.length, MAX_MOUNTED_WALLS)
      if (!sceneReadyRef.current && readyCountRef.current >= readyThreshold) {
        sceneReadyRef.current = true
        onReady?.()
        // Enable interaction detection after loader fade-out completes
        setTimeout(() => {
          interactionsEnabled.current = true
        }, 1200)
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

  // On mobile, only mount nearby walls to limit GPU memory. On desktop, mount all.
  const allWallIndices = useMemo(() => new Set(walls.map((_, i) => i)), [walls])
  const [mountedWalls, setMountedWalls] = useState<Set<number>>(() =>
    isMobile ? new Set() : allWallIndices
  )
  const mountedWallsRef = useRef(mountedWalls)
  mountedWallsRef.current = mountedWalls

  // Compute aspect-aware start Z and set camera on mount
  const cam = camera as THREE.PerspectiveCamera
  const startZ = useMemo(() => computeStartZ(cam.aspect), [cam.aspect])
  const startZRef = useRef(startZ)
  startZRef.current = startZ

  // Set camera position on first render / aspect change
  useEffect(() => {
    camera.position.z = startZ
  }, [startZ])

  // Camera scroll state
  const targetZ = useRef(startZ)
  const mouseX = useRef(0)
  const currentRotationY = useRef(0)
  const isTouch = useRef(false)
  const meshClicked = useRef(false)

  // Auto-drift state
  const isAutoDrifting = useRef(true)
  const autoDriftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const interactionsEnabled = useRef(false)

  const stopAutoDrift = () => {
    if (!interactionsEnabled.current) return // Ignore interactions during loading + fade-in
    isAutoDrifting.current = false
    if (autoDriftTimer.current) clearTimeout(autoDriftTimer.current)
    autoDriftTimer.current = setTimeout(() => {
      // If focused, unfocus first — the returning animation will finish, then auto-drift starts
      if (isFocusing.current) {
        unfocus()
      }
      isAutoDrifting.current = true
    }, AUTO_DRIFT_RESUME_DELAY * 1000)
  }

  // Focus state — all in refs for imperative animation
  const focusedWall = useRef<number | null>(null)
  const focusTarget = useRef(new THREE.Vector3())
  const focusQuat = useRef(new THREE.Quaternion())
  const returnPosition = useRef(new THREE.Vector3())
  const returnRotationY = useRef(0)
  const isFocusing = useRef(false)
  const isReturning = useRef(false)

  /**
   * Continuous position along the focused side's wall row, as a fractional index
   * into leftIndices/rightIndices. 3.5 sits exactly between the 4th and 5th wall.
   * Swipes drive this directly; the camera eases toward the pose it describes,
   * the same way targetZ drives the camera in corridor mode.
   */
  const focusPos = useRef(0)
  /** Which side the current focus is on — fixed for the duration of a focus. */
  const focusIsLeft = useRef(true)
  /** Corridor loop offset locked when focus began, so blended poses stay continuous. */
  const focusLoopOffset = useRef(0)
  /** True once a touch has travelled far enough to be a drag, so it can't read as a tap. */
  const touchDragged = useRef(false)
  /** True once a swipe has driven this focus — selects the tighter easing. */
  const focusDragActive = useRef(false)

  // Scratch objects for quaternion computation
  const poseMatrix = useRef(new THREE.Matrix4())
  const poseLookAt = useRef(new THREE.Vector3())
  const poseUp = useRef(new THREE.Vector3())
  const blendPos = useRef(new THREE.Vector3())
  const blendQuat = useRef(new THREE.Quaternion())
  const viewFwd = useRef(new THREE.Vector3())
  const viewRight = useRef(new THREE.Vector3())
  const viewUp = useRef(new THREE.Vector3())
  const relVec = useRef(new THREE.Vector3())
  const wallCenter = useRef(new THREE.Vector3())
  const twistQuat = useRef(new THREE.Quaternion())
  const mouseLookQuat = useRef(new THREE.Quaternion())
  const corridorQuat = useRef(new THREE.Quaternion())

  /**
   * Header height as a fraction of viewport height. Cached rather than read per
   * frame — computeFocusPose runs every frame while focused and getComputedStyle
   * forces layout.
   */
  const headerFraction = useRef(0)
  const readHeaderFraction = () => {
    const headerPx = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--header-height") || "0"
    )
    headerFraction.current = headerPx / window.innerHeight
  }

  /** Corridor loop offset that brings a wall into the same lap as the camera. */
  const getLoopOffset = (wallZ: number, camZ: number) =>
    totalLength > 0 ? Math.round((camZ - wallZ) / totalLength) * totalLength : 0

  /**
   * Compute the camera pose that faces a wall head-on, writing into the supplied
   * output objects. Pure geometry with no state mutation, so it can be called
   * twice per frame to blend between two neighbouring walls.
   */
  const computeFocusPose = (
    wallIndex: number,
    loopOffset: number,
    outPos: THREE.Vector3,
    outQuat: THREE.Quaternion
  ) => {
    const wall = walls[wallIndex]
    const effectiveZ = wall.z + loopOffset

    // Compute image dimensions in world units
    const aspect = wall.image.width / wall.image.height
    const imgHeight = WALL_HEIGHT
    const imgWidth = imgHeight * aspect

    // Compute distance so the image fits the screen with minimal cropping
    const perspCam = camera as THREE.PerspectiveCamera
    const fovRad = (perspCam.fov * Math.PI) / 180
    const distV = (imgHeight / 2 / Math.tan(fovRad / 2)) * FOCUS_PADDING
    const distH = (imgWidth / 2 / (Math.tan(fovRad / 2) * perspCam.aspect)) * FOCUS_PADDING
    const focusDistance = Math.max(distV, distH)

    // Compute camera position along the wall's actual face normal (accounts for INWARD_ANGLE + twist)
    const twist = wall.twistAngle
    const cosT = Math.cos(twist)
    const sinT = Math.sin(twist)

    // Wall center in world space (twist applied to local position)
    const wallX = wall.position[0]
    const wallY = wall.position[1]
    const centerX = wallX * cosT - wallY * sinT
    const centerY = wallX * sinT + wallY * cosT

    // Face normal in local space: wall's Y rotation puts front face (+Z) toward viewer
    // Left wall: rotation Y = π/2 - IA → normal = (cos(IA), 0, sin(IA))
    // Right wall: rotation Y = -π/2 + IA → normal = (-cos(IA), 0, sin(IA))
    const cosIA = Math.cos(INWARD_ANGLE)
    const sinIA = Math.sin(INWARD_ANGLE)
    const localNX = wall.isLeft ? cosIA : -cosIA

    // Apply twist rotation (around Z) to the normal's X,Y components
    const normalX = localNX * cosT
    const normalY = localNX * sinT
    const normalZ = sinIA

    // Offset to compensate for header covering top of viewport:
    // shift camera + lookAt down (in twisted local "up") by half the header's angular share
    const visibleHeight = 2 * Math.tan(fovRad / 2) * focusDistance
    const headerOffset = (headerFraction.current * visibleHeight) / 2
    // Twisted up direction
    poseUp.current.set(-sinT, cosT, 0)

    // Camera = wall center + normal * focusDistance, shifted down by header offset
    outPos.set(
      centerX + normalX * focusDistance - poseUp.current.x * headerOffset,
      centerY + normalY * focusDistance - poseUp.current.y * headerOffset,
      effectiveZ + normalZ * focusDistance
    )
    poseLookAt.current.set(
      centerX - poseUp.current.x * headerOffset,
      centerY - poseUp.current.y * headerOffset,
      effectiveZ
    )
    poseMatrix.current.lookAt(outPos, poseLookAt.current, poseUp.current)
    outQuat.setFromRotationMatrix(poseMatrix.current)
  }

  /** World-space center of a wall, accounting for its row twist and corridor looping. */
  const getWallCenter = (index: number, camZ: number, out: THREE.Vector3) => {
    const w = walls[index]
    const effZ = w.z + getLoopOffset(w.z, camZ)
    out.set(w.position[0] * Math.cos(w.twistAngle), w.position[0] * Math.sin(w.twistAngle), effZ)
  }

  /** Bounding radius of a wall face — catches walls whose center sits just off-screen. */
  const getWallRadius = (index: number) => {
    const w = walls[index]
    const halfW = (WALL_HEIGHT * (w.image.width / w.image.height)) / 2 + w.border
    return Math.hypot(halfW, WALL_HEIGHT / 2 + w.border)
  }

  /**
   * Collect every opposite-side wall standing between a camera pose and the
   * focused image.
   *
   * In portrait the image only fits at a distance greater than the corridor is
   * wide, so the camera backs out through the opposite wall row and one or more
   * of those walls end up in front of the picture. Which ones can't be guessed
   * from Z proximity — the camera is also offset along Z by the wall normal, so
   * the blocker is often not the nearest wall, and there is frequently more than
   * one. Testing the actual view frustum handles every case, and in landscape it
   * naturally selects nothing: there the camera stays inside the corridor, which
   * leaves the opposite row behind it.
   */
  const collectBlockingWalls = (
    pos: THREE.Vector3,
    quat: THREE.Quaternion,
    focusedIndex: number,
    oppositeIndices: number[],
    camZ: number,
    out: Set<number>
  ) => {
    const perspCam = camera as THREE.PerspectiveCamera
    const tanV = Math.tan((perspCam.fov * Math.PI) / 180 / 2) * OCCLUDE_MARGIN
    const tanH = tanV * perspCam.aspect

    viewFwd.current.set(0, 0, -1).applyQuaternion(quat)
    viewRight.current.set(1, 0, 0).applyQuaternion(quat)
    viewUp.current.set(0, 1, 0).applyQuaternion(quat)

    getWallCenter(focusedIndex, camZ, wallCenter.current)
    const focusDepth = relVec.current.subVectors(wallCenter.current, pos).dot(viewFwd.current)

    for (const i of oppositeIndices) {
      getWallCenter(i, camZ, wallCenter.current)
      relVec.current.subVectors(wallCenter.current, pos)
      const depth = relVec.current.dot(viewFwd.current)
      // Behind the camera, or no nearer than the image being viewed
      if (depth <= 0.5 || depth >= focusDepth - 0.5) continue
      const radius = getWallRadius(i)
      if (Math.abs(relVec.current.dot(viewRight.current)) - radius >= tanH * depth) continue
      if (Math.abs(relVec.current.dot(viewUp.current)) - radius >= tanV * depth) continue
      out.add(i)
    }
  }

  /**
   * Rebuild focusTarget/focusQuat from the current fractional focusPos, blending
   * between the two walls it sits between. Runs every frame while focused.
   */
  const updateFocusPoseFromPosition = () => {
    const sideIndices = focusIsLeft.current ? leftIndices : rightIndices
    if (sideIndices.length === 0) return

    const s = Math.max(0, Math.min(sideIndices.length - 1, focusPos.current))
    const i0 = Math.floor(s)
    const t = s - i0

    computeFocusPose(
      sideIndices[i0],
      focusLoopOffset.current,
      focusTarget.current,
      focusQuat.current
    )

    if (t > 0.0001 && i0 + 1 < sideIndices.length) {
      computeFocusPose(
        sideIndices[i0 + 1],
        focusLoopOffset.current,
        blendPos.current,
        blendQuat.current
      )
      focusTarget.current.lerp(blendPos.current, t)
      focusQuat.current.slerp(blendQuat.current, t)
    }
  }

  const focusOnWall = (wallIndex: number) => {
    const wall = walls[wallIndex]
    readHeaderFraction()

    // Save return position only when entering focus from corridor
    if (!isFocusing.current) {
      returnPosition.current.set(0, 0, camera.position.z)
      returnRotationY.current = currentRotationY.current
    }

    const sideIndices = wall.isLeft ? leftIndices : rightIndices
    focusIsLeft.current = wall.isLeft
    focusLoopOffset.current = getLoopOffset(wall.z, camera.position.z)
    focusPos.current = sideIndices.indexOf(wallIndex)
    updateFocusPoseFromPosition()

    focusedWall.current = wallIndex
    isFocusing.current = true
    isReturning.current = false
    focusDragActive.current = false
    window.dispatchEvent(new CustomEvent("image-zoomed-in", { detail: { isLeft: wall.isLeft } }))
  }

  const handleWallClick = (wallIndex: number) => {
    // A swipe that ends on a wall must not read as a tap
    if (touchDragged.current) return
    meshClicked.current = true
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
    focusDragActive.current = false
  }

  // Keyboard handler: Escape to unfocus, arrows to navigate between walls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFocusing.current) {
        stopAutoDrift()
        unfocus()
        return
      }

      if (!isFocusing.current || focusedWall.current === null) return
      stopAutoDrift()

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

    let lastTouchY = 0
    let lastTouchX = 0
    let touchTravel = 0

    const handleTouchStart = (e: TouchEvent) => {
      isTouch.current = true
      lastTouchY = e.touches[0].clientY
      lastTouchX = e.touches[0].clientX
      touchTravel = 0
      touchDragged.current = false
    }

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      stopAutoDrift()

      const touchY = e.touches[0].clientY
      const touchX = e.touches[0].clientX
      const deltaY = lastTouchY - touchY
      const deltaX = touchX - lastTouchX
      lastTouchY = touchY
      lastTouchX = touchX

      touchTravel += Math.abs(deltaX) + Math.abs(deltaY)
      if (touchTravel > DRAG_THRESHOLD) touchDragged.current = true

      if (isFocusing.current) {
        // Horizontal swipe walks continuously along the focused side's wall row.
        // Content follows the finger: facing a left wall, deeper into the corridor
        // reads as screen-right, so swiping left advances. On a right wall the
        // corridor runs the other way across the screen, so the sign flips.
        const sideIndices = focusIsLeft.current ? leftIndices : rightIndices
        if (sideIndices.length < 2) return
        const direction = focusIsLeft.current ? -1 : 1
        const next = focusPos.current + deltaX * FOCUS_SWIPE_SPEED * direction
        focusPos.current = Math.max(0, Math.min(sideIndices.length - 1, next))
        focusedWall.current = sideIndices[Math.round(focusPos.current)]
        // Tighten the easing for the rest of this focus, so the camera stays
        // close to the finger instead of trailing at fly-in speed
        focusDragActive.current = true
        return
      }

      targetZ.current += deltaY * SCROLL_SPEED * 8
      targetZ.current = Math.min(startZRef.current, targetZ.current)
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (isFocusing.current) return // Disable scroll when focused
      stopAutoDrift()
      targetZ.current += e.deltaY * SCROLL_SPEED
      targetZ.current = Math.min(startZRef.current, targetZ.current)
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (isTouch.current) return
      stopAutoDrift()
      mouseX.current = (e.clientX / window.innerWidth) * 2 - 1
    }

    const handleClick = () => {
      // Trailing click from a swipe — never let a drag close the focused image
      if (touchDragged.current) {
        touchDragged.current = false
        meshClicked.current = false
        return
      }
      stopAutoDrift()
      // When focused, clicking empty space (not a wall mesh) unfocuses.
      // meshClicked is set by R3F onClick before this DOM handler fires via setTimeout.
      setTimeout(() => {
        if (isFocusing.current && !meshClicked.current) {
          unfocus()
        }
        meshClicked.current = false
      }, 0)
    }

    // Header height changes with viewport (e.g. phone rotation) — refresh the
    // cached fraction so focus poses stay correctly offset
    const handleResize = () => readHeaderFraction()

    canvas.addEventListener("wheel", handleWheel, { passive: false })
    window.addEventListener("resize", handleResize)
    window.addEventListener("mousemove", handleMouseMove)
    canvas.addEventListener("touchstart", handleTouchStart)
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false })
    canvas.addEventListener("click", handleClick)
    return () => {
      canvas.removeEventListener("wheel", handleWheel)
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("mousemove", handleMouseMove)
      canvas.removeEventListener("touchstart", handleTouchStart)
      canvas.removeEventListener("touchmove", handleTouchMove)
      canvas.removeEventListener("click", handleClick)
      if (autoDriftTimer.current) clearTimeout(autoDriftTimer.current)
    }
  }, [gl])

  useFrame(() => {
    if (isFocusing.current) {
      // Rebuild the target pose from the swipe-driven position each frame, so a
      // fractional focusPos blends smoothly between neighbouring walls
      updateFocusPoseFromPosition()

      // Animate camera to focused wall — tighter easing once a swipe is driving it
      const focusLerp = focusDragActive.current ? FOCUS_SWIPE_LERP : FOCUS_LERP
      camera.position.lerp(focusTarget.current, focusLerp)

      // Slerp toward precomputed quaternion — stable Z-roll, no wobble
      camera.quaternion.slerp(focusQuat.current, focusLerp)
    } else if (isReturning.current) {
      // Animate back to corridor center
      const returnTarget = new THREE.Vector3(0, 0, targetZ.current)
      camera.position.lerp(returnTarget, FOCUS_LERP)

      // Build target quaternion same as corridor mode
      const mouseTarget = isTouch.current ? 0 : -mouseX.current * MOUSE_LOOK_AMOUNT
      const returnTwist = getTwistAtZ(targetZ.current - TWIST_LOOK_AHEAD)
      twistQuat.current.setFromAxisAngle(new THREE.Vector3(0, 0, 1), returnTwist)
      mouseLookQuat.current.setFromAxisAngle(new THREE.Vector3(0, 1, 0), mouseTarget)
      corridorQuat.current.copy(twistQuat.current).multiply(mouseLookQuat.current)
      camera.quaternion.slerp(corridorQuat.current, FOCUS_LERP)

      // Check if position and rotation have converged
      const dist = camera.position.distanceTo(returnTarget)
      const rotDist = camera.quaternion.angleTo(corridorQuat.current)
      if (dist < 0.1 && rotDist < 0.005) {
        currentRotationY.current = mouseTarget
        isReturning.current = false
      }
    } else {
      // Normal corridor mode
      if (isAutoDrifting.current) {
        // Auto-drift: smoothly move deeper into the corridor
        targetZ.current -= AUTO_DRIFT_SPEED * (1 / 60)
        // Reset mouse look toward center during auto-drift
        currentRotationY.current += (0 - currentRotationY.current) * MOUSE_LOOK_LERP
      } else if (!isTouch.current) {
        const targetRotation = -mouseX.current * MOUSE_LOOK_AMOUNT
        currentRotationY.current += (targetRotation - currentRotationY.current) * MOUSE_LOOK_LERP
      }

      camera.position.z += (targetZ.current - camera.position.z) * CAMERA_LERP

      // Build camera orientation via quaternions:
      // 1. Twist around Z axis (corridor spiral)
      // 2. Mouse look around Y axis in the twisted local frame
      const targetTwist = getTwistAtZ(camera.position.z - TWIST_LOOK_AHEAD)
      twistQuat.current.setFromAxisAngle(new THREE.Vector3(0, 0, 1), targetTwist)
      mouseLookQuat.current.setFromAxisAngle(new THREE.Vector3(0, 1, 0), currentRotationY.current)
      // Twist first, then mouse look in local space: twist * mouseLook
      corridorQuat.current.copy(twistQuat.current).multiply(mouseLookQuat.current)
      camera.quaternion.slerp(corridorQuat.current, CAMERA_LERP)
    }

    // Visibility culling + mount management — always runs
    const camZ = camera.position.z
    const frontZ = camZ + VISIBLE_BEHIND
    const backZ = camZ - VISIBLE_AHEAD

    // Collect walls sorted by distance to camera for mount priority
    const wallDistances: Array<{ index: number; effectiveZ: number; visible: boolean }> = []

    // Hide any opposite-side wall standing between the viewer and the focused
    // image. Measured against the focus *target* rather than the live camera, so
    // the blockers start fading the moment a picture is picked and are gone by
    // the time the camera arrives — and, while swiping, the set tracks the finger.
    // Clearing on unfocus fades the whole side back in for the corridor view.
    const occludedWalls = new Set<number>()
    if (isFocusing.current && focusedWall.current !== null) {
      const fw = walls[focusedWall.current]
      collectBlockingWalls(
        focusTarget.current,
        focusQuat.current,
        focusedWall.current,
        fw.isLeft ? rightIndices : leftIndices,
        camZ,
        occludedWalls
      )
    }

    for (let i = 0; i < walls.length; i++) {
      const wallZ = walls[i].z
      let effectiveZ = wallZ
      if (totalLength > 0) {
        const loopOffset = Math.round((camZ - wallZ) / totalLength) * totalLength
        effectiveZ = wallZ + loopOffset
      }
      const visible = effectiveZ <= frontZ && effectiveZ >= backZ && effectiveZ <= 0
      wallDistances.push({ index: i, effectiveZ, visible })

      const occluded = occludedWalls.has(i)

      const handle = wallRefs[i].current
      if (handle) {
        handle.setVisible(visible)
        handle.setOccluded(occluded)
        if (visible) {
          handle.setPositionZ(effectiveZ)
        }
      }
    }

    // On mobile: update mounted set to keep closest walls, limiting GPU memory
    if (isMobile) {
      const sorted = wallDistances
        .map((w) => ({ ...w, dist: Math.abs(w.effectiveZ - camZ) }))
        .sort((a, b) => a.dist - b.dist)
      const newMounted = new Set(sorted.slice(0, MAX_MOUNTED_WALLS).map((w) => w.index))

      // Only trigger React re-render if the set actually changed
      const prev = mountedWallsRef.current
      if (newMounted.size !== prev.size || [...newMounted].some((i) => !prev.has(i))) {
        setMountedWalls(newMounted)
      }
    }
  })

  return (
    <>
      <ambientLight intensity={isDarkMode ? 0.15 : 1.4} />
      {/* Top light */}
      <directionalLight position={[0, 100, 0]} intensity={isDarkMode ? 1.0 : 0.5} />
      {/* Front-right light — differentiates front and side faces */}
      <directionalLight position={[80, 30, 60]} intensity={isDarkMode ? 0.45 : 0.3} />
      {/* Left fill light */}
      <directionalLight position={[-60, 10, -40]} intensity={isDarkMode ? 0.2 : 0.1} />

      {walls.map((w, i) =>
        mountedWalls.has(i) ? (
          <group key={i} rotation={[0, 0, w.twistAngle]}>
            <Suspense fallback={null}>
              <Wall
                ref={wallRefs[i]}
                image={w.image}
                isDarkMode={isDarkMode}
                textureSize={textureSize}
                position={w.position}
                rotation={w.rotation}
                border={w.border}
                depth={w.depth}
                onClick={() => handleWallClick(i)}
                onReady={handleWallReady}
              />
            </Suspense>
          </group>
        ) : null
      )}
    </>
  )
}
