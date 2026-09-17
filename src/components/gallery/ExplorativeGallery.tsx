"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { getImageSrc } from "@/lib/images"
import type { GalleryImage } from "@/types"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_TILE_W = 5000
const BASE_TILE_H = 4000
const BASE_COUNT = 200
const BASE_IMG_WIDTH_MIN = 280
const BASE_IMG_WIDTH_MAX = 420
const REFERENCE_VP_WIDTH = 2560
const SEPARATION_TO_IMG_RATIO = 250 / ((280 + 420) / 2)

const TILE_OFFSETS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [0, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const

const TAP_THRESHOLD = 5
const INERTIA_DECAY = 0.95
const HOVER_LERP = 0.18

const ZOOM_LERP = 0.15
const ZOOM_WHEEL_SPEED = 0.0015
// Twist has to clear this before it engages, so an ordinary pinch zooms
// cleanly instead of tilting the whole gallery a few degrees
const ROTATE_THRESHOLD = (10 * Math.PI) / 180
// Zoomed all the way in, one picture spans this fraction of the screen width…
const ZOOM_IN_SCREEN_FRACTION = 0.5
// …except on phones, where pictures already render wider than that at rest, so
// the ceiling would sit below 1 and forbid zooming in at all.
const ZOOM_IN_FLOOR = 1.8

// Announces gesture boundaries to the page, which slides the bottom bar out of
// the way while the scene is being handled
const emitInteraction = (phase: "start" | "end") =>
  window.dispatchEvent(new Event(`gallery-interaction-${phase}`))

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Wraps into [-period/2, period/2) instead of [0, period). */
function wrapSigned(v: number, period: number) {
  const m = ((v % period) + period) % period
  return m >= period / 2 ? m - period : m
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImageLayout {
  id: string
  x: number
  y: number
  rotation: number
  width: number
}

interface GeneratedLayout {
  layouts: ImageLayout[]
  tileW: number
  tileH: number
}

interface ExplorativeGalleryProps {
  images: GalleryImage[]
  onImageClick: (index: number) => void
}

// ---------------------------------------------------------------------------
// Layout generation (identical to DOM version)
// ---------------------------------------------------------------------------

function generateLayout(
  images: GalleryImage[],
  vpEdge: number,
  isPortrait: boolean
): GeneratedLayout {
  const n = images.length
  const vpScale = (vpEdge / REFERENCE_VP_WIDTH) * (isPortrait ? 2 : 1)
  const countScale = Math.sqrt(Math.max(n, 1) / BASE_COUNT)

  const tileW = Math.round(BASE_TILE_W * countScale * vpScale)
  const tileH = Math.round(BASE_TILE_H * countScale * vpScale)

  const imgMin = Math.round(BASE_IMG_WIDTH_MIN * vpScale)
  const imgMax = Math.round(BASE_IMG_WIDTH_MAX * vpScale)
  const avgImg = (imgMin + imgMax) / 2
  const minSeparation = avgImg * SEPARATION_TO_IMG_RATIO * countScale

  const layouts: ImageLayout[] = []
  const positions: Array<{ x: number; y: number }> = []

  for (const image of images) {
    const width = Math.round(imgMin + Math.random() * (imgMax - imgMin))
    let x: number = Math.random() * tileW
    let y: number = Math.random() * tileH
    let attempts = 0

    do {
      x = Math.random() * tileW
      y = Math.random() * tileH
      attempts++
    } while (attempts < 20 && positions.some((p) => Math.hypot(p.x - x, p.y - y) < minSeparation))

    positions.push({ x, y })
    layouts.push({
      id: image.id,
      x,
      y,
      rotation: (Math.random() - 0.5) * 16,
      width,
    })
  }

  return { layouts, tileW, tileH }
}

function isTouchDevice() {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches
}

// ---------------------------------------------------------------------------
// Module-level texture cache — persists across filter changes / remounts
// ---------------------------------------------------------------------------

const textureCache = new Map<string, THREE.Texture>()

// Module constants, not inline literals: R3F compares these by identity on every
// Canvas render, so fresh objects make it reconfigure needlessly
const CANVAS_CAMERA = {
  position: [0, 0, 100] as [number, number, number],
  zoom: 1,
  near: 0.1,
  far: 1000,
}
const CANVAS_GL = { antialias: true, alpha: true, preserveDrawingBuffer: true }

// ---------------------------------------------------------------------------
// Three.js scene
// ---------------------------------------------------------------------------

interface SceneProps {
  images: GalleryImage[]
  layouts: ImageLayout[]
  tileW: number
  tileH: number
  onImageClick: (index: number) => void
  onReady: () => void
}

function ExplorativeScene({ images, layouts, tileW, tileH, onImageClick, onReady }: SceneProps) {
  const { camera, gl, size } = useThree()
  const groupRef = useRef<THREE.Group>(null!)
  const offsetRef = useRef({ x: 0, y: 0 })
  const velocityRef = useRef({ x: 0, y: 0 })
  const hoveredIdRef = useRef<string | null>(null)
  const isTouchRef = useRef(isTouchDevice())
  const zoomRef = useRef(1)
  const targetZoomRef = useRef(1)
  const zoomBoundsRef = useRef({ min: 1, max: 1 })
  const zoomAnchorRef = useRef<{ x: number; y: number } | null>(null)
  const rotationGroupRef = useRef<THREE.Group>(null!)
  const rotationRef = useRef(0)
  // Gesture scratch state. Held in a ref rather than the effect's closure so a
  // re-subscribe mid-gesture (any parent re-render can cause one) doesn't throw
  // away a drag that's already in progress.
  const gestureRef = useRef({
    isDragging: false,
    hasMoved: false,
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    lastX: 0,
    lastY: 0,
    smoothVx: 0,
    smoothVy: 0,
    hoveredAtDown: null as string | null,
    pinchDist: 0,
    pinchMidX: 0,
    pinchMidY: 0,
    pinchAngle: 0,
    twistTravel: 0,
    twisting: false,
    multiTouch: false,
  })

  const imageMap = useMemo(() => Object.fromEntries(images.map((img) => [img.id, img])), [images])

  const sharedGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), [])

  const avgImageWidth = useMemo(
    () => (layouts.length ? layouts.reduce((sum, l) => sum + l.width, 0) / layouts.length : 1),
    [layouts]
  )

  // Zoom-out floor: the point where a single tile exactly fills the viewport.
  // Any further out and the layout's repeat becomes visible on screen.
  useEffect(() => {
    const computeBounds = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      // The centred 3x3 block guarantees one tile of margin around the canvas
      // centre, so the rendered area has to fit inside that. Twisting is touch
      // only, and a rotated view needs its diagonal rather than its sides.
      const span = isTouchRef.current
        ? { x: Math.hypot(size.width, size.height), y: Math.hypot(size.width, size.height) }
        : { x: size.width, y: size.height }
      const coverFloor = Math.max(span.x / (2 * tileW), span.y / (2 * tileH))
      const min = Math.min(Math.max(vw / tileW, vh / tileH, coverFloor), 1)
      const max = Math.max((ZOOM_IN_SCREEN_FRACTION * vw) / avgImageWidth, ZOOM_IN_FLOOR, min)
      zoomBoundsRef.current = { min, max }
      targetZoomRef.current = clamp(targetZoomRef.current, min, max)
      zoomRef.current = clamp(zoomRef.current, min, max)
      const cam = camera as THREE.OrthographicCamera
      cam.zoom = zoomRef.current
      cam.updateProjectionMatrix()
    }
    computeBounds()
    window.addEventListener("resize", computeBounds)
    return () => window.removeEventListener("resize", computeBounds)
  }, [camera, size, tileW, tileH, avgImageWidth])

  const materials = useMemo(() => {
    const map = new Map<string, THREE.MeshBasicMaterial>()
    for (const layout of layouts) {
      const texture = textureCache.get(layout.id)
      if (texture && !map.has(layout.id)) {
        map.set(layout.id, new THREE.MeshBasicMaterial({ map: texture }))
      }
    }
    return map
  }, [layouts])

  useEffect(() => {
    return () => {
      for (const mat of materials.values()) mat.dispose()
      sharedGeo.dispose()
    }
  }, [materials, sharedGeo])

  // Orthographic camera: 1 world unit = 1 CSS pixel, origin = top-left
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera
    cam.left = 0
    cam.right = size.width
    cam.top = 0
    cam.bottom = -size.height
    cam.zoom = zoomRef.current
    cam.updateProjectionMatrix()
  }, [camera, size])

  // The offset lives in pre-rotation space, so every screen-driven delta has to
  // be turned back through -theta before it lands there. Drag, inertia, pinch
  // pan and the zoom anchor all come through here so they can't disagree.
  const panByWorldDelta = useCallback((wx: number, wy: number) => {
    const c = Math.cos(rotationRef.current)
    const sn = Math.sin(rotationRef.current)
    offsetRef.current.x += c * wx + sn * wy
    offsetRef.current.y -= -sn * wx + c * wy
  }, [])

  // The one place zoom is applied. Shifts the offset so the content under the
  // anchor (cursor or pinch midpoint) stays put across the scale change.
  const applyZoom = useCallback(
    (next: number, anchorX: number, anchorY: number) => {
      const prev = zoomRef.current
      if (Math.abs(next - prev) < 1e-6) return
      const shift = 1 / next - 1 / prev
      panByWorldDelta((anchorX - size.width / 2) * shift, -(anchorY - size.height / 2) * shift)
      zoomRef.current = next
      const cam = camera as THREE.OrthographicCamera
      cam.zoom = next
      cam.updateProjectionMatrix()
    },
    [camera, size, panByWorldDelta]
  )

  // Raycaster
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const ndcVec = useMemo(() => new THREE.Vector2(), [])

  const doRaycast = useCallback(
    (clientX: number, clientY: number): string | null => {
      if (!groupRef.current) return null
      // Convert viewport coords to canvas-local coords (canvas is oversized & centered)
      const rect = gl.domElement.getBoundingClientRect()
      const localX = clientX - rect.left
      const localY = clientY - rect.top
      ndcVec.set((localX / rect.width) * 2 - 1, -(localY / rect.height) * 2 + 1)
      raycaster.setFromCamera(ndcVec, camera)
      const hits = raycaster.intersectObject(groupRef.current, true)
      return hits.length > 0 ? (hits[0].object.userData.imageId ?? null) : null
    },
    [camera, raycaster, ndcVec, gl]
  )

  // Pointer events: drag, click, hover
  useEffect(() => {
    const canvas = gl.domElement
    canvas.style.touchAction = "none"
    canvas.style.cursor = "grab"

    const g = gestureRef.current

    const cancelDrag = () => {
      g.isDragging = false
      g.hasMoved = false
      velocityRef.current = { x: 0, y: 0 }
      canvas.style.cursor = "grab"
    }

    const zoomBy = (factor: number) => {
      const { min, max } = zoomBoundsRef.current
      targetZoomRef.current = clamp(targetZoomRef.current * factor, min, max)
    }

    const onPointerDown = (e: PointerEvent) => {
      if (g.multiTouch) return
      emitInteraction("start")
      if (e.pointerType === "touch") isTouchRef.current = true
      // A drag rewrites the offset from its own origin each move, which would
      // fight the anchor shift of a still-easing zoom — settle it instead
      targetZoomRef.current = zoomRef.current
      g.isDragging = true
      g.hasMoved = false
      g.hoveredAtDown = hoveredIdRef.current
      g.startX = e.clientX
      g.startY = e.clientY
      g.startOffsetX = offsetRef.current.x
      g.startOffsetY = offsetRef.current.y
      g.lastX = e.clientX
      g.lastY = e.clientY
      g.smoothVx = 0
      g.smoothVy = 0

      velocityRef.current = { x: 0, y: 0 }

      if (hoveredIdRef.current) {
        window.dispatchEvent(new CustomEvent("image-hover-end"))
        hoveredIdRef.current = null
      }

      canvas.setPointerCapture(e.pointerId)
      canvas.style.cursor = "grabbing"
    }

    const onPointerMove = (e: PointerEvent) => {
      if (g.multiTouch) return
      if (g.isDragging) {
        const totalDx = e.clientX - g.startX
        const totalDy = e.clientY - g.startY
        if (Math.abs(totalDx) > TAP_THRESHOLD || Math.abs(totalDy) > TAP_THRESHOLD) {
          g.hasMoved = true
        }

        const frameDx = e.clientX - g.lastX
        const frameDy = e.clientY - g.lastY
        g.smoothVx = g.smoothVx * 0.7 + frameDx * 0.3
        g.smoothVy = g.smoothVy * 0.7 + frameDy * 0.3
        g.lastX = e.clientX
        g.lastY = e.clientY

        // Pointer deltas are CSS pixels, the offset is world units — and one
        // CSS pixel covers 1/zoom world units, so panning must scale with zoom.
        // The field can also be twisted, so the delta turns back through -theta.
        const c = Math.cos(rotationRef.current)
        const sn = Math.sin(rotationRef.current)
        offsetRef.current.x = g.startOffsetX + (c * totalDx - sn * totalDy) / zoomRef.current
        offsetRef.current.y = g.startOffsetY + (sn * totalDx + c * totalDy) / zoomRef.current
      } else if (!isTouchRef.current) {
        const newId = doRaycast(e.clientX, e.clientY)
        if (newId !== hoveredIdRef.current) {
          if (hoveredIdRef.current && !newId) {
            window.dispatchEvent(new CustomEvent("image-hover-end"))
          } else if (newId && !hoveredIdRef.current) {
            window.dispatchEvent(new CustomEvent("image-hover-start"))
          }
          hoveredIdRef.current = newId
          canvas.style.cursor = newId ? "pointer" : "grab"
        }
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      if (g.multiTouch) {
        g.isDragging = false
        return
      }
      if (!g.isDragging) return
      g.isDragging = false
      canvas.style.cursor = hoveredIdRef.current ? "pointer" : "grab"

      emitInteraction("end")

      if (!g.hasMoved) {
        const imageId = g.hoveredAtDown ?? doRaycast(e.clientX, e.clientY)
        if (imageId) {
          const index = images.findIndex((img) => img.id === imageId)
          if (index !== -1) onImageClick(index)
        }
      } else {
        velocityRef.current = { x: g.smoothVx, y: g.smoothVy }
      }
    }

    const onPointerLeave = () => {
      if (hoveredIdRef.current) {
        window.dispatchEvent(new CustomEvent("image-hover-end"))
        hoveredIdRef.current = null
        canvas.style.cursor = "grab"
      }
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      zoomAnchorRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      // Scroll up zooms in — same direction as Experimental mode
      zoomBy(Math.exp(-e.deltaY * ZOOM_WHEEL_SPEED))
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length < 2) return
      g.multiTouch = true
      emitInteraction("start")
      cancelDrag()
      const [a, b] = [e.touches[0], e.touches[1]]
      g.pinchDist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY)
      g.pinchMidX = (a.clientX + b.clientX) / 2
      g.pinchMidY = (a.clientY + b.clientY) / 2
      g.pinchAngle = Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX)
      g.twistTravel = 0
      g.twisting = false
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length < 2) return
      e.preventDefault()
      g.multiTouch = true

      const [a, b] = [e.touches[0], e.touches[1]]
      const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY)
      const midX = (a.clientX + b.clientX) / 2
      const midY = (a.clientY + b.clientY) / 2
      const angle = Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX)

      const rect = canvas.getBoundingClientRect()
      const anchorX = midX - rect.left
      const anchorY = midY - rect.top
      zoomAnchorRef.current = { x: anchorX, y: anchorY }

      if (g.pinchDist > 0) {
        // Spread/squeeze scales, and the midpoint's travel pans — applied in the
        // same frame so a pinch zooms and moves the field at once. Zoom goes on
        // directly rather than through the eased target, so it tracks the fingers.
        const { min, max } = zoomBoundsRef.current
        applyZoom(clamp(zoomRef.current * (dist / g.pinchDist), min, max), anchorX, anchorY)
        targetZoomRef.current = zoomRef.current
        panByWorldDelta(
          (midX - g.pinchMidX) / zoomRef.current,
          -(midY - g.pinchMidY) / zoomRef.current
        )

        // Twist. Normalised across the +/-PI wrap so the angle can't jump a full
        // turn, and negated because the screen's y runs down while three's runs up
        let dAngle = angle - g.pinchAngle
        if (dAngle > Math.PI) dAngle -= 2 * Math.PI
        else if (dAngle < -Math.PI) dAngle += 2 * Math.PI
        // Signed, so jitter back and forth cancels instead of creeping up on
        // the threshold the way accumulated absolute travel would
        g.twistTravel += dAngle
        if (!g.twisting && Math.abs(g.twistTravel) > ROTATE_THRESHOLD) g.twisting = true
        if (g.twisting) rotationRef.current -= dAngle
      }
      g.pinchDist = dist
      g.pinchAngle = angle
      g.pinchMidX = midX
      g.pinchMidY = midY
    }

    const onTouchEnd = (e: TouchEvent) => {
      // Stay in multi-touch until every finger is up, so lifting one finger
      // mid-pinch doesn't hand a stale drag origin back to the pan handler
      if (e.touches.length > 0) return
      g.multiTouch = false
      g.pinchDist = 0
      g.twisting = false
      emitInteraction("end")
    }

    canvas.addEventListener("wheel", onWheel, { passive: false })
    canvas.addEventListener("touchstart", onTouchStart, { passive: false })
    canvas.addEventListener("touchmove", onTouchMove, { passive: false })
    canvas.addEventListener("touchend", onTouchEnd)
    canvas.addEventListener("touchcancel", onTouchEnd)
    canvas.addEventListener("pointerdown", onPointerDown)
    canvas.addEventListener("pointermove", onPointerMove)
    canvas.addEventListener("pointerup", onPointerUp)
    canvas.addEventListener("pointerleave", onPointerLeave)

    return () => {
      canvas.removeEventListener("wheel", onWheel)
      canvas.removeEventListener("touchstart", onTouchStart)
      canvas.removeEventListener("touchmove", onTouchMove)
      canvas.removeEventListener("touchend", onTouchEnd)
      canvas.removeEventListener("touchcancel", onTouchEnd)
      canvas.removeEventListener("pointerdown", onPointerDown)
      canvas.removeEventListener("pointermove", onPointerMove)
      canvas.removeEventListener("pointerup", onPointerUp)
      canvas.removeEventListener("pointerleave", onPointerLeave)
    }
  }, [gl, doRaycast, images, onImageClick, applyZoom, panByWorldDelta])

  const readyFired = useRef(false)
  useEffect(() => {
    if (!readyFired.current && layouts.length > 0) {
      readyFired.current = true
      onReady()
    }
  }, [layouts, onReady])

  // Animation loop: inertia + group position + hover animation
  useFrame(() => {
    if (!groupRef.current) return

    // Zoom: ease toward the target, anchored on the cursor / pinch midpoint so
    // the picture under the pointer stays put instead of sliding away
    const zPrev = zoomRef.current
    const zNext = zPrev + (targetZoomRef.current - zPrev) * ZOOM_LERP
    const anchor = zoomAnchorRef.current
    applyZoom(zNext, anchor?.x ?? size.width / 2, anchor?.y ?? size.height / 2)

    // Inertia — velocity is in CSS pixels, so it scales with zoom like the drag
    const vel = velocityRef.current
    if (Math.abs(vel.x) > 0.5 || Math.abs(vel.y) > 0.5) {
      panByWorldDelta(vel.x / zoomRef.current, -vel.y / zoomRef.current)
      velocityRef.current = { x: vel.x * INERTIA_DECAY, y: vel.y * INERTIA_DECAY }
    } else if (vel.x !== 0 || vel.y !== 0) {
      velocityRef.current = { x: 0, y: 0 }
    }

    // Group position: modulo wrapping (Y flipped for Three.js coordinates).
    // The 3x3 block reaches from -1 to +2 tiles, so wrapping into [0, tile)
    // would leave the left and top edges with no slack at all — fine at zoom 1,
    // where the view starts exactly at world 0, but zooming out widens the view
    // past that and opens a gap. Wrapping around a centred anchor instead puts a
    // full tile of margin on every side.
    const { x, y } = offsetRef.current
    const anchorX = size.width / 2 - tileW / 2
    const anchorY = -size.height / 2 + tileH / 2
    groupRef.current.position.set(
      anchorX + wrapSigned(x - anchorX, tileW),
      anchorY + wrapSigned(-y - anchorY, tileH),
      0
    )

    rotationGroupRef.current.rotation.z = rotationRef.current

    // Hover animation: rotation toward 0, scale up, z-index forward
    const hovered = hoveredIdRef.current
    groupRef.current.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh) || !obj.userData.imageId) return
      const ud = obj.userData
      const isHovered = hovered === ud.imageId

      const targetRot = isHovered ? 0 : ud.baseRotation
      const currentRot = ud._animRot ?? ud.baseRotation
      ud._animRot = currentRot + (targetRot - currentRot) * HOVER_LERP
      obj.rotation.z = ud._animRot

      const targetScale = isHovered ? 1.2 : 1.0
      const currentScale = ud._animScale ?? 1.0
      ud._animScale = currentScale + (targetScale - currentScale) * HOVER_LERP
      obj.scale.set(ud.planeW * ud._animScale, ud.planeH * ud._animScale, 1)

      obj.position.z = isHovered ? 1 : (ud.baseZ ?? 0)
    })
  })

  return (
    // Pivot pair: the outer group spins about the middle of the screen, the
    // inner one undoes that translation. groupRef keeps carrying the wrapped
    // offset in its own unrotated space, so the tiling math is untouched.
    <group ref={rotationGroupRef} position={[size.width / 2, -size.height / 2, 0]}>
      <group position={[-size.width / 2, size.height / 2, 0]}>
        <group ref={groupRef}>
          {TILE_OFFSETS.map(([tx, ty]) => (
            <group key={`${tx}-${ty}`} position={[tx * tileW, -ty * tileH, 0]}>
              {layouts.map((layout, layoutIndex) => {
                const image = imageMap[layout.id]
                if (!image) return null
                const material = materials.get(layout.id)
                if (!material) return null

                const aspect = image.width / image.height
                const planeW = layout.width
                const planeH = layout.width / aspect
                const centerX = layout.x + planeW / 2
                const centerY = layout.y + planeH / 2
                const baseRot = -(layout.rotation * Math.PI) / 180
                const baseZ = layoutIndex * 0.001

                return (
                  <mesh
                    key={layout.id}
                    geometry={sharedGeo}
                    material={material}
                    frustumCulled={false}
                    position={[centerX, -centerY, baseZ]}
                    rotation={[0, 0, baseRot]}
                    scale={[planeW, planeH, 1]}
                    userData={{
                      imageId: layout.id,
                      baseRotation: baseRot,
                      baseZ,
                      planeW,
                      planeH,
                    }}
                  />
                )
              })}
            </group>
          ))}
        </group>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function ExplorativeGallery({ images, onImageClick }: ExplorativeGalleryProps) {
  const vpEdge =
    typeof window !== "undefined"
      ? Math.max(window.innerWidth, window.innerHeight)
      : REFERENCE_VP_WIDTH
  const isPortrait = typeof window !== "undefined" ? window.innerHeight > window.innerWidth : false

  const { layouts, tileW, tileH } = useMemo(
    () => generateLayout(images, vpEdge, isPortrait),
    [images, vpEdge, isPortrait]
  )

  const [imagesPreloaded, setImagesPreloaded] = useState(false)
  const [sceneReady, setSceneReady] = useState(false)
  const [hasZoomed, setHasZoomed] = useState(false)
  const handleSceneReady = useCallback(() => setSceneReady(true), [])
  const isTouch = useMemo(() => isTouchDevice(), [])

  // Zoom hint retires itself the first time the user zooms
  useEffect(() => {
    const onZoomGesture = (e: Event) => {
      if (e.type === "touchmove" && (e as TouchEvent).touches.length < 2) return
      setHasZoomed(true)
    }
    window.addEventListener("wheel", onZoomGesture)
    window.addEventListener("touchmove", onZoomGesture)
    return () => {
      window.removeEventListener("wheel", onZoomGesture)
      window.removeEventListener("touchmove", onZoomGesture)
    }
  }, [])

  useEffect(() => {
    if (images.length === 0) {
      setImagesPreloaded(true)
      return
    }

    let stale = false
    let loaded = 0
    const toLoad = images.filter((img) => !textureCache.has(img.id))

    if (toLoad.length === 0) {
      setImagesPreloaded(true)
      return
    }

    for (const image of toLoad) {
      const url = image.previewSrc || getImageSrc(image.id, 500)
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = img.onerror = () => {
        if (stale) return
        if (img.naturalWidth > 0) {
          const texture = new THREE.Texture(img)
          texture.needsUpdate = true
          texture.colorSpace = THREE.SRGBColorSpace
          textureCache.set(image.id, texture)
        }
        loaded++
        if (loaded >= toLoad.length) setImagesPreloaded(true)
      }
      img.src = url
    }

    return () => {
      stale = true
    }
  }, [images])

  // Workaround: Three.js / R3F has an unresolved rendering bug where meshes
  // near the edges of the orthographic camera frustum sometimes stop drawing
  // despite being visible and having frustumCulled=false. We oversized the
  // canvas (175% on the long viewport edge, 150% on the short edge) and
  // center it so the clipped overflow hides the affected area. The outer div
  // clips with overflow:hidden, so the user never sees the artefact.
  const overW = isPortrait ? "175%" : "150%"
  const overH = isPortrait ? "150%" : "175%"

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {imagesPreloaded && (
        <div
          style={{
            width: overW,
            height: overH,
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            opacity: sceneReady ? 1 : 0,
            transition: "opacity 0.4s ease",
          }}
        >
          <Canvas orthographic camera={CANVAS_CAMERA} gl={CANVAS_GL}>
            <ExplorativeScene
              images={images}
              layouts={layouts}
              tileW={tileW}
              tileH={tileH}
              onImageClick={onImageClick}
              onReady={handleSceneReady}
            />
          </Canvas>
        </div>
      )}

      {/* Zoom hint — mirrors Experimental mode's scroll hint */}
      <div
        className="text-foreground pointer-events-none fixed right-0 bottom-[calc(var(--header-height,0px)+var(--gutter))] left-0 z-[9998] flex justify-center text-[10px]"
        style={{
          opacity: sceneReady && !hasZoomed ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      >
        <span className="flex items-center gap-1">
          <kbd className="border-foreground/50 bg-background inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[3px] border px-1 py-0.5 font-[inherit] text-[10px] leading-none">
            {isTouch ? "Pinch" : "Scroll"}
          </kbd>
          <span className="ml-1.5">Zoom in and out</span>
        </span>
      </div>
    </div>
  )
}

// The page re-renders whenever the bottom bar toggles; without this the whole
// canvas subtree re-renders mid-gesture and the scene's listeners get rebound.
export default memo(ExplorativeGallery)
