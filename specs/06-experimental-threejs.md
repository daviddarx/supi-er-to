# Phase 6: Experimental Mode (Three.js)

## Overview

A Three.js scene rendered via React Three Fiber showing an abstract city skyline viewed from above. Each building has a rooftop structure (stairhouse, parapet, AC box) with one vertical face displaying a graffiti image. Camera auto-pilots slowly between graffiti pieces. User can take over with orbital controls; auto-pilot resumes 4 seconds after user stops.

---

## 6.1 Dependencies

```bash
npm install three @react-three/fiber @react-three/drei
npm install @types/three
```

---

## 6.2 Component Structure

```
<ExperimentalGallery>
  └── <Canvas>                   R3F canvas, full viewport
       └── <CityScene>
            ├── <ambientLight>
            ├── <directionalLight>
            ├── <Building> × N   One per image
            └── <CameraController>
```

---

## 6.3 Types

```typescript
// In src/components/gallery/experimental/types.ts

export type GraffitiWall = "north" | "south" | "east" | "west"

export interface RooftopStructure {
  size: [number, number, number]      // width, height, depth
  offset: [number, number, number]    // offset from building top center
  graffitiWall: GraffitiWall
}

export interface BuildingConfig {
  id: string                           // matches GalleryImage.id
  position: [number, number, number]   // world position (y=0 = ground)
  bodySize: [number, number, number]   // width, height, depth of main body
  rooftop: RooftopStructure
}

export interface GraffitiTarget {
  buildingId: string
  cameraPosition: THREE.Vector3
  lookAt: THREE.Vector3
}
```

---

## 6.4 City Layout Generation

```typescript
// In src/components/gallery/experimental/generateCity.ts

import * as THREE from "three"
import type { BuildingConfig, GraffitiTarget } from "./types"
import type { GalleryImage } from "@/types"

const GRID_CELL_SIZE = 30     // units between building centers
const JITTER = 5              // random offset from grid center
const CAMERA_DISTANCE = 18    // how far camera sits from graffiti wall

export function generateCity(images: GalleryImage[]): {
  buildings: BuildingConfig[]
  graffitiTargets: GraffitiTarget[]
} {
  const N = images.length
  const gridCols = Math.ceil(Math.sqrt(N))
  const walls: GraffitiWall[] = ["north", "south", "east", "west"]

  const buildings: BuildingConfig[] = images.map((img, i) => {
    const col = i % gridCols
    const row = Math.floor(i / gridCols)

    // Grid position with random jitter
    const x = col * GRID_CELL_SIZE - (gridCols * GRID_CELL_SIZE) / 2 + (Math.random() - 0.5) * JITTER * 2
    const z = row * GRID_CELL_SIZE - (Math.ceil(N / gridCols) * GRID_CELL_SIZE) / 2 + (Math.random() - 0.5) * JITTER * 2

    const bodyW = 3 + Math.random() * 7       // 3–10
    const bodyH = 5 + Math.random() * 25      // 5–30
    const bodyD = 3 + Math.random() * 7       // 3–10

    const rooftopW = Math.max(2, bodyW - 1)
    const rooftopH = 3 + Math.random() * 3    // 3–6
    const rooftopD = Math.max(2, bodyD - 1)

    const graffitiWall = walls[Math.floor(Math.random() * 4)]

    return {
      id: img.id,
      position: [x, 0, z],
      bodySize: [bodyW, bodyH, bodyD],
      rooftop: {
        size: [rooftopW, rooftopH, rooftopD],
        offset: [0, 0, 0],   // centered on top of building body
        graffitiWall,
      },
    }
  })

  // Pre-compute camera targets for auto-pilot
  const graffitiTargets: GraffitiTarget[] = buildings.map((b) => {
    const bodyTopY = b.bodySize[1]
    const rooftopCenterY = bodyTopY + b.rooftop.size[1] / 2
    const [bx, , bz] = b.position
    const [rw, rh, rd] = b.rooftop.size

    // Calculate graffiti wall center and camera position
    let lookAtPos: THREE.Vector3
    let cameraPos: THREE.Vector3
    const elevation = bodyTopY + rh * 0.5 + 5 // slight above graffiti center

    switch (b.rooftop.graffitiWall) {
      case "north":
        lookAtPos = new THREE.Vector3(bx, rooftopCenterY, bz - rd / 2)
        cameraPos = new THREE.Vector3(bx, elevation, bz - rd / 2 - CAMERA_DISTANCE)
        break
      case "south":
        lookAtPos = new THREE.Vector3(bx, rooftopCenterY, bz + rd / 2)
        cameraPos = new THREE.Vector3(bx, elevation, bz + rd / 2 + CAMERA_DISTANCE)
        break
      case "east":
        lookAtPos = new THREE.Vector3(bx + rw / 2, rooftopCenterY, bz)
        cameraPos = new THREE.Vector3(bx + rw / 2 + CAMERA_DISTANCE, elevation, bz)
        break
      case "west":
        lookAtPos = new THREE.Vector3(bx - rw / 2, rooftopCenterY, bz)
        cameraPos = new THREE.Vector3(bx - rw / 2 - CAMERA_DISTANCE, elevation, bz)
        break
    }

    return {
      buildingId: b.id,
      cameraPosition: cameraPos!,
      lookAt: lookAtPos!,
    }
  })

  return { buildings, graffitiTargets }
}
```

---

## 6.5 Building Component

```typescript
// src/components/gallery/experimental/Building.tsx

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
  onGraffitiClick: () => void
  cameraPosition: THREE.Vector3 // passed from parent for distance culling
}

export function Building({ config, isDarkMode, onGraffitiClick, cameraPosition }: BuildingProps) {
  const { position, bodySize, rooftop } = config
  const bodyMeshRef = useRef<THREE.Mesh>(null)
  const rooftopMeshRef = useRef<THREE.Mesh>(null)
  const opacityRef = useRef(0)

  // Load graffiti texture
  const texture = useTexture(getImageSrc(config.id, 1280))

  // Material colors
  const bodyColor = isDarkMode ? "#2A2A2A" : "#F0F0F0"
  const rooftopColor = isDarkMode ? "#333333" : "#E8E8E8"

  // Fade in on mount
  useFrame((_, delta) => {
    if (opacityRef.current < 1) {
      opacityRef.current = Math.min(1, opacityRef.current + delta * 0.8) // ~1.25s fade
      if (bodyMeshRef.current) {
        ;(bodyMeshRef.current.material as THREE.MeshStandardMaterial).opacity = opacityRef.current
      }
      if (rooftopMeshRef.current) {
        ;(rooftopMeshRef.current.material as THREE.MeshStandardMaterial).opacity = opacityRef.current
      }
    }
  })

  // Update material color when dark mode changes
  useEffect(() => {
    if (bodyMeshRef.current) {
      ;(bodyMeshRef.current.material as THREE.MeshStandardMaterial).color.set(bodyColor)
    }
    if (rooftopMeshRef.current) {
      ;(rooftopMeshRef.current.material as THREE.MeshStandardMaterial).color.set(rooftopColor)
    }
  }, [isDarkMode])

  // Rooftop center Y position
  const bodyTopY = bodySize[1] / 2
  const rooftopCenterY = bodySize[1] + rooftop.size[1] / 2

  // Graffiti plane position and rotation
  const { size: [rw, rh, rd], graffitiWall } = rooftop
  const graffitiPosition: [number, number, number] = (() => {
    switch (graffitiWall) {
      case "north": return [0, rooftopCenterY - bodyTopY, -rd / 2 - 0.01]
      case "south": return [0, rooftopCenterY - bodyTopY, rd / 2 + 0.01]
      case "east":  return [rw / 2 + 0.01, rooftopCenterY - bodyTopY, 0]
      case "west":  return [-rw / 2 - 0.01, rooftopCenterY - bodyTopY, 0]
    }
  })()
  const graffitiRotation: [number, number, number] = (() => {
    switch (graffitiWall) {
      case "north": return [0, 0, 0]
      case "south": return [0, Math.PI, 0]
      case "east":  return [0, Math.PI / 2, 0]
      case "west":  return [0, -Math.PI / 2, 0]
    }
  })()

  return (
    <group position={position}>
      {/* Building body */}
      <mesh ref={bodyMeshRef} position={[0, bodySize[1] / 2, 0]}>
        <boxGeometry args={bodySize} />
        <meshStandardMaterial color={bodyColor} transparent opacity={0} />
      </mesh>

      {/* Rooftop structure */}
      <mesh ref={rooftopMeshRef} position={[0, rooftopCenterY, 0]}>
        <boxGeometry args={rooftop.size} />
        <meshStandardMaterial color={rooftopColor} transparent opacity={0} />
      </mesh>

      {/* Graffiti plane */}
      <mesh
        position={graffitiPosition}
        rotation={graffitiRotation}
        onClick={onGraffitiClick}
      >
        <planeGeometry args={[rw * 0.9, rh * 0.9]} />
        <meshBasicMaterial map={texture} transparent />
      </mesh>
    </group>
  )
}
```

---

## 6.6 Camera Controller

```typescript
// src/components/gallery/experimental/CameraController.tsx

"use client"

import { useRef, useEffect, forwardRef, useImperativeHandle } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"
import type { GraffitiTarget } from "./types"

interface CameraControllerProps {
  targets: GraffitiTarget[]
}

export interface CameraControllerHandle {
  focusOnBuilding: (buildingId: string) => void
}

const LERP_SPEED = 0.004            // controls travel speed (~10s to reach target at this rate)
const DWELL_TIME = 3000             // ms to wait at each graffiti before moving on
const RESUME_DELAY = 4000           // ms of inactivity before auto-pilot resumes
const ARRIVAL_THRESHOLD = 1.5       // units — close enough to consider "arrived"

export const CameraController = forwardRef<CameraControllerHandle, CameraControllerProps>(
  ({ targets }, ref) => {
    const { camera } = useThree()
    const controlsRef = useRef<any>(null)

    const stateRef = useRef({
      targetIndex: 0,
      userControlling: false,
      dwellTimer: null as ReturnType<typeof setTimeout> | null,
      resumeTimer: null as ReturnType<typeof setTimeout> | null,
      focusedBuildingId: null as string | null,
    })

    // Expose focusOnBuilding for parent (graffiti click)
    useImperativeHandle(ref, () => ({
      focusOnBuilding(buildingId: string) {
        const idx = targets.findIndex((t) => t.buildingId === buildingId)
        if (idx === -1) return
        stateRef.current.targetIndex = idx
        stateRef.current.userControlling = false
      },
    }))

    // Set initial camera position
    useEffect(() => {
      if (targets.length === 0) return
      const first = targets[0]
      camera.position.copy(first.cameraPosition)
      camera.lookAt(first.lookAt)
    }, [targets])

    // Handle orbital controls interaction
    const handleControlsChange = () => {
      const s = stateRef.current

      if (!s.userControlling) {
        s.userControlling = true
        if (s.dwellTimer) clearTimeout(s.dwellTimer)
      }

      // Reset resume timer on each interaction
      if (s.resumeTimer) clearTimeout(s.resumeTimer)
      s.resumeTimer = setTimeout(() => {
        s.userControlling = false
        // Advance to next target when auto-pilot resumes
        s.targetIndex = (s.targetIndex + 1) % targets.length
      }, RESUME_DELAY)
    }

    useFrame((_, delta) => {
      const s = stateRef.current
      if (s.userControlling || targets.length === 0) return

      const target = targets[s.targetIndex]

      // Smoothly lerp camera position
      camera.position.lerp(target.cameraPosition, LERP_SPEED)

      // Smoothly rotate camera toward lookAt
      const targetQuat = new THREE.Quaternion()
      const targetMatrix = new THREE.Matrix4()
      targetMatrix.lookAt(camera.position, target.lookAt, camera.up)
      targetQuat.setFromRotationMatrix(targetMatrix)
      camera.quaternion.slerp(targetQuat, LERP_SPEED * 3)

      // Check if arrived
      const distance = camera.position.distanceTo(target.cameraPosition)
      if (distance < ARRIVAL_THRESHOLD && !s.dwellTimer) {
        s.dwellTimer = setTimeout(() => {
          s.targetIndex = (s.targetIndex + 1) % targets.length
          s.dwellTimer = null
        }, DWELL_TIME)
      }
    })

    return (
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        onChange={handleControlsChange}
      />
    )
  }
)

CameraController.displayName = "CameraController"
```

---

## 6.7 CityScene Component

```typescript
// src/components/gallery/experimental/CityScene.tsx

"use client"

import { useMemo, useRef } from "react"
import { useThree } from "@react-three/fiber"
import { Building } from "./Building"
import { CameraController, type CameraControllerHandle } from "./CameraController"
import { generateCity } from "./generateCity"
import type { GalleryImage } from "@/types"

interface CitySceneProps {
  images: GalleryImage[]
  isDarkMode: boolean
}

export function CityScene({ images, isDarkMode }: CitySceneProps) {
  const cameraControllerRef = useRef<CameraControllerHandle>(null)
  const { camera } = useThree()

  // Generate city layout once per mount (random per session)
  const { buildings, graffitiTargets } = useMemo(
    () => generateCity(images),
    [images]
  )

  const handleGraffitiClick = (buildingId: string) => {
    cameraControllerRef.current?.focusOnBuilding(buildingId)
  }

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[50, 100, 50]} intensity={0.8} />

      {buildings.map((config) => (
        <Building
          key={config.id}
          config={config}
          isDarkMode={isDarkMode}
          onGraffitiClick={() => handleGraffitiClick(config.id)}
          cameraPosition={camera.position}
        />
      ))}

      <CameraController ref={cameraControllerRef} targets={graffitiTargets} />
    </>
  )
}
```

---

## 6.8 ExperimentalGallery Root

```typescript
// src/components/gallery/ExperimentalGallery.tsx

"use client"

import { Suspense, useEffect } from "react"
import { Canvas } from "@react-three/fiber"
import { CityScene } from "./experimental/CityScene"
import type { GalleryImage } from "@/types"

interface ExperimentalGalleryProps {
  images: GalleryImage[]
  isDarkMode: boolean
}

export default function ExperimentalGallery({ images, isDarkMode }: ExperimentalGalleryProps) {
  const bgColor = isDarkMode ? "#0a0a0a" : "#f8f8f8"

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Canvas
        camera={{ position: [0, 80, 80], fov: 50, near: 0.1, far: 2000 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: bgColor }}
      >
        <Suspense fallback={null}>
          <CityScene images={images} isDarkMode={isDarkMode} />
        </Suspense>
      </Canvas>
    </div>
  )
}
```

---

## 6.9 Memory Cleanup

The R3F Canvas disposes the WebGL context automatically when unmounted. However, we must also dispose geometries, materials, and textures:

```typescript
// Add to CityScene.tsx useEffect cleanup:
useEffect(() => {
  return () => {
    // R3F handles WebGL context cleanup
    // Individual geometries/materials dispose via their mesh lifecycle
    // useTexture caches are handled by R3F's internal asset manager
  }
}, [])
```

For complete cleanup, R3F's `useLoader` and `useTexture` hooks cache assets. On unmount of the Canvas, R3F's internal cleanup handles this. If textures need explicit disposal, use `useEffect` with `texture.dispose()` in each `Building` component.

---

## 6.10 Performance Considerations

| Factor | Approach |
|---|---|
| 200–500 buildings | R3F renders efficiently; Three.js frustum culling removes off-screen objects |
| 200–500 textures | Use `useTexture` which caches; set `texture.minFilter = LinearFilter` to avoid mipmaps for photos |
| Camera LERP | Low `LERP_SPEED = 0.004` means smooth CPU-friendly animation |
| OrbitControls `enableDamping` | Smooth but adds a small frame cost; acceptable |
| `Suspense fallback={null}` | Scene appears progressively as textures load (no blank screen) |

---

## 6.11 Dark Mode Integration

`isDarkMode` is passed as a prop from `page.tsx` where the dark mode state lives. The background color of the Canvas is updated directly via the `style` prop. Building material colors update via `useEffect` in each `Building` component when `isDarkMode` changes.
