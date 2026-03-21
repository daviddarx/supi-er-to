"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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

  const imageMap = useMemo(() => Object.fromEntries(images.map((img) => [img.id, img])), [images])

  const sharedGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), [])

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
    cam.updateProjectionMatrix()
  }, [camera, size])

  // Raycaster
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const ndcVec = useMemo(() => new THREE.Vector2(), [])

  const doRaycast = useCallback(
    (clientX: number, clientY: number): string | null => {
      if (!groupRef.current) return null
      ndcVec.set((clientX / size.width) * 2 - 1, -(clientY / size.height) * 2 + 1)
      raycaster.setFromCamera(ndcVec, camera)
      const hits = raycaster.intersectObject(groupRef.current, true)
      return hits.length > 0 ? (hits[0].object.userData.imageId ?? null) : null
    },
    [camera, raycaster, ndcVec, size]
  )

  // Pointer events: drag, click, hover
  useEffect(() => {
    const canvas = gl.domElement
    canvas.style.touchAction = "none"
    canvas.style.cursor = "grab"

    let isDragging = false
    let hasMoved = false
    let startX = 0
    let startY = 0
    let startOffsetX = 0
    let startOffsetY = 0
    let lastX = 0
    let lastY = 0
    let smoothVx = 0
    let smoothVy = 0
    let hoveredAtDown: string | null = null

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") isTouchRef.current = true
      isDragging = true
      hasMoved = false
      hoveredAtDown = hoveredIdRef.current
      startX = e.clientX
      startY = e.clientY
      startOffsetX = offsetRef.current.x
      startOffsetY = offsetRef.current.y
      lastX = e.clientX
      lastY = e.clientY
      smoothVx = 0
      smoothVy = 0

      velocityRef.current = { x: 0, y: 0 }

      if (hoveredIdRef.current) {
        window.dispatchEvent(new CustomEvent("image-hover-end"))
        hoveredIdRef.current = null
      }

      canvas.setPointerCapture(e.pointerId)
      canvas.style.cursor = "grabbing"
    }

    const onPointerMove = (e: PointerEvent) => {
      if (isDragging) {
        const totalDx = e.clientX - startX
        const totalDy = e.clientY - startY
        if (Math.abs(totalDx) > TAP_THRESHOLD || Math.abs(totalDy) > TAP_THRESHOLD) {
          hasMoved = true
        }

        const frameDx = e.clientX - lastX
        const frameDy = e.clientY - lastY
        smoothVx = smoothVx * 0.7 + frameDx * 0.3
        smoothVy = smoothVy * 0.7 + frameDy * 0.3
        lastX = e.clientX
        lastY = e.clientY

        offsetRef.current.x = startOffsetX + totalDx
        offsetRef.current.y = startOffsetY + totalDy
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
      if (!isDragging) return
      isDragging = false
      canvas.style.cursor = hoveredIdRef.current ? "pointer" : "grab"

      if (!hasMoved) {
        const imageId = hoveredAtDown ?? doRaycast(e.clientX, e.clientY)
        if (imageId) {
          const index = images.findIndex((img) => img.id === imageId)
          if (index !== -1) onImageClick(index)
        }
      } else {
        velocityRef.current = { x: smoothVx, y: smoothVy }
      }
    }

    const onPointerLeave = () => {
      if (hoveredIdRef.current) {
        window.dispatchEvent(new CustomEvent("image-hover-end"))
        hoveredIdRef.current = null
        canvas.style.cursor = "grab"
      }
    }

    canvas.addEventListener("pointerdown", onPointerDown)
    canvas.addEventListener("pointermove", onPointerMove)
    canvas.addEventListener("pointerup", onPointerUp)
    canvas.addEventListener("pointerleave", onPointerLeave)

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown)
      canvas.removeEventListener("pointermove", onPointerMove)
      canvas.removeEventListener("pointerup", onPointerUp)
      canvas.removeEventListener("pointerleave", onPointerLeave)
    }
  }, [gl, doRaycast, images, onImageClick])

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

    // Inertia
    const vel = velocityRef.current
    if (Math.abs(vel.x) > 0.5 || Math.abs(vel.y) > 0.5) {
      offsetRef.current.x += vel.x
      offsetRef.current.y += vel.y
      velocityRef.current = { x: vel.x * INERTIA_DECAY, y: vel.y * INERTIA_DECAY }
    } else if (vel.x !== 0 || vel.y !== 0) {
      velocityRef.current = { x: 0, y: 0 }
    }

    // Group position: modulo wrapping (Y flipped for Three.js coordinates)
    const { x, y } = offsetRef.current
    const wx = ((x % tileW) + tileW) % tileW
    const wy = ((y % tileH) + tileH) % tileH
    groupRef.current.position.set(wx, -wy, 0)

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
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ExplorativeGallery({ images, onImageClick }: ExplorativeGalleryProps) {
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    setIsTouch(isTouchDevice())
  }, [])

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
  const handleSceneReady = useCallback(() => setSceneReady(true), [])

  useEffect(() => {
    if (images.length === 0) {
      setImagesPreloaded(true)
      return
    }

    let stale = false
    let loaded = 0
    const total = images.length
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
            width: "100%",
            height: "100%",
            opacity: sceneReady ? 1 : 0,
            transition: "opacity 0.4s ease",
          }}
        >
          <Canvas
            orthographic
            camera={{ position: [0, 0, 100], zoom: 1, near: 0.1, far: 1000 }}
            gl={{ antialias: true, alpha: true }}
          >
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
    </div>
  )
}
