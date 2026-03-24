"use client"

import { useRef, useEffect, useMemo, forwardRef, useImperativeHandle } from "react"
import { useFrame } from "@react-three/fiber"
import { useTexture } from "@react-three/drei"
import * as THREE from "three"
import type { GalleryImage } from "@/types"
import { getImageSrc } from "@/lib/images"

/** Border width around the image on the wall face, in world units. */
export const BORDER = 1.2

/** Target height of the wall in world units (width is derived from image aspect ratio). */
export const WALL_HEIGHT = 8

/** Depth of the wall cube in world units. */
export const WALL_DEPTH = 1.5

/** Fade-in speed (opacity units per second). */
const FADE_IN_SPEED = 1.5

/** Fade-out speed — 3× faster so occluding walls disappear quickly. */
const FADE_OUT_SPEED = FADE_IN_SPEED * 3

/** Delay (seconds) before fade-in starts after un-occluding. */
const FADE_IN_DELAY = 0.3

export interface WallHandle {
  /** Set visibility imperatively — no React re-render. */
  setVisible: (v: boolean) => void
  /** Reposition the wall along Z for infinite looping — no React re-render. */
  setPositionZ: (z: number) => void
  /** Fade out and disable clicks when occluded by focused wall. */
  setOccluded: (v: boolean) => void
}

interface WallProps {
  image: GalleryImage
  isDarkMode: boolean
  textureSize?: 500 | 1280
  position?: [number, number, number]
  rotation?: [number, number, number]
  border?: number
  depth?: number
  onClick?: () => void
  onReady?: () => void
}

export const Wall = forwardRef<WallHandle, WallProps>(function Wall(
  {
    image,
    isDarkMode,
    textureSize = 1280,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    border = BORDER,
    depth = WALL_DEPTH,
    onClick,
    onReady,
  },
  ref
) {
  const texture = useTexture(getImageSrc(image.id, textureSize))
  const groupRef = useRef<THREE.Group>(null)
  const opacityRef = useRef(1)
  const targetOpacityRef = useRef(1)
  const visibleRef = useRef(true)
  const wasVisibleRef = useRef(true)
  const occludedRef = useRef(false)
  const fadeInDelayRef = useRef(0)

  useEffect(() => {
    onReady?.()
    return () => {
      texture.dispose()
    }
  }, [texture])

  useImperativeHandle(ref, () => ({
    setVisible(v: boolean) {
      visibleRef.current = v
      if (groupRef.current) {
        groupRef.current.visible = v
      }
      if (v && !wasVisibleRef.current) {
        opacityRef.current = 0
      }
      wasVisibleRef.current = v
    },
    setPositionZ(z: number) {
      if (groupRef.current) {
        groupRef.current.position.z = z
      }
    },
    setOccluded(v: boolean) {
      const wasOccluded = occludedRef.current
      occludedRef.current = v
      targetOpacityRef.current = v ? 0 : 1
      // Only start delay on the transition from occluded → not occluded
      if (wasOccluded && !v) {
        fadeInDelayRef.current = FADE_IN_DELAY
      }
    },
  }))

  useFrame((_, delta) => {
    if (!visibleRef.current) return
    const group = groupRef.current
    if (!group) return

    const target = targetOpacityRef.current
    const settled = Math.abs(opacityRef.current - target) < 0.001

    if (!settled) {
      // Fade toward target opacity
      if (opacityRef.current < target) {
        // Fade-in: wait for delay to elapse first
        if (fadeInDelayRef.current > 0) {
          fadeInDelayRef.current -= delta
        } else {
          opacityRef.current = Math.min(target, opacityRef.current + delta * FADE_IN_SPEED)
        }
      } else {
        opacityRef.current = Math.max(target, opacityRef.current - delta * FADE_OUT_SPEED)
      }
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.Material
          mat.transparent = true
          mat.opacity = opacityRef.current
        }
      })
    }

    // Once fully faded out, hide from scene (removes from raycasting)
    group.visible = !(occludedRef.current && opacityRef.current <= 0.01)
  })

  const aspect = image.width / image.height
  const imgHeight = WALL_HEIGHT
  const imgWidth = imgHeight * aspect
  const wallWidth = imgWidth + border * 2
  const wallHeight = imgHeight + border * 2
  // Dark mode: MeshStandardMaterial reacts to scene lighting for face shading
  // Light mode: flat MeshBasicMaterial, no lighting — plain grey (~black 5% opacity on white)
  const wallMaterial = useMemo(() => {
    if (isDarkMode) {
      const mat = new THREE.MeshBasicMaterial({ color: "#161616", transparent: true })
      mat.toneMapped = false
      return mat
    }
    const mat = new THREE.MeshBasicMaterial({ color: "#f7f7f7", transparent: true })
    mat.toneMapped = false
    return mat
  }, [isDarkMode])

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Wall border — invisible to raycasting so it doesn't block the image plane */}
      <mesh raycast={() => null} material={wallMaterial as any}>
        <boxGeometry args={[wallWidth, wallHeight, depth]} />
      </mesh>
      <mesh
        position={[0, 0, depth / 2 + 0.15]}
        onClick={(e) => {
          e.stopPropagation()
          if (!occludedRef.current) onClick?.()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          window.dispatchEvent(new Event("image-hover-start"))
        }}
        onPointerOut={(e) => {
          e.stopPropagation()
          window.dispatchEvent(new Event("image-hover-end"))
        }}
      >
        <planeGeometry args={[imgWidth, imgHeight]} />
        <meshBasicMaterial map={texture} transparent opacity={1} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
})
