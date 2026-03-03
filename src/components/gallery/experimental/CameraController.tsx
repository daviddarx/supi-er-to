"use client"

import { useRef, useEffect, forwardRef, useImperativeHandle } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"
import type { GraffitiTarget } from "./types"

interface CameraControllerProps {
  targets: GraffitiTarget[]
}

/** Public API surface exposed to the parent via ref. */
export interface CameraControllerHandle {
  /**
   * Immediately set the next auto-drift destination to the building with the
   * given ID. Clears the user-control flag so auto-drift resumes at once.
   * No-ops silently if the ID is not found in targets.
   */
  focusOnBuilding: (buildingId: string) => void
}

/** Fractional lerp/slerp speed per frame (applied as `current.lerp(target, LERP_SPEED)`). */
const LERP_SPEED = 0.004

/**
 * How long the camera lingers at each graffiti piece before advancing
 * to the next target (ms). Measured from when the camera arrives.
 */
const DWELL_TIME = 3000

/**
 * How long the user must stop interacting with OrbitControls before
 * auto-drift resumes (ms).
 */
const RESUME_DELAY = 4000

/**
 * World-unit distance threshold: once the camera is within this distance
 * of its target position, the dwell timer starts.
 */
const ARRIVAL_THRESHOLD = 1.5

/**
 * CameraController drives a slow auto-drift through all graffiti targets,
 * pausing at each one. OrbitControls remain fully interactive; any user
 * interaction pauses auto-drift for RESUME_DELAY ms.
 *
 * Exposed imperative handle: `focusOnBuilding(id)` lets a graffiti click
 * skip directly to a specific target.
 *
 * Timers are properly cleaned up on unmount to prevent memory leaks.
 */
export const CameraController = forwardRef<CameraControllerHandle, CameraControllerProps>(
  ({ targets }, ref) => {
    const { camera } = useThree()

    // OrbitControls ref typed as `any` — drei's types vary across patch versions.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const controlsRef = useRef<any>(null)

    /**
     * All mutable drift state lives in a single ref to avoid re-renders.
     * This is deliberately not React state — it needs to be read and written
     * every animation frame without triggering component updates.
     */
    const stateRef = useRef({
      targetIndex: 0,
      userControlling: false,
      dwellTimer: null as ReturnType<typeof setTimeout> | null,
      resumeTimer: null as ReturnType<typeof setTimeout> | null,
    })

    // Pre-allocate per-frame scratch objects to avoid GC pressure at 60fps+.
    const targetMatrixRef = useRef(new THREE.Matrix4())
    const targetQuatRef = useRef(new THREE.Quaternion())

    // Expose focusOnBuilding to the parent via forwarded ref.
    useImperativeHandle(ref, () => ({
      focusOnBuilding(buildingId: string) {
        const idx = targets.findIndex((t) => t.buildingId === buildingId)
        if (idx === -1) return
        const s = stateRef.current
        // Clear any pending dwell so the new target advances on arrival.
        if (s.dwellTimer) {
          clearTimeout(s.dwellTimer)
          s.dwellTimer = null
        }
        s.targetIndex = idx
        s.userControlling = false
      },
    }))

    // Place the camera at the first target's position on mount / targets change.
    useEffect(() => {
      if (targets.length === 0) return
      const first = targets[0]
      camera.position.copy(first.cameraPosition)
      camera.lookAt(first.lookAt)
    }, [targets, camera])

    /**
     * Called by OrbitControls' onChange event on every user interaction frame.
     * Marks user as controlling; schedules a resume after RESUME_DELAY.
     */
    const handleControlsChange = () => {
      const s = stateRef.current
      s.userControlling = true

      // Cancel any previous dwell so we don't advance mid-interaction.
      if (s.dwellTimer) {
        clearTimeout(s.dwellTimer)
        s.dwellTimer = null
      }

      // Debounce: reset the resume countdown on each interaction event.
      if (s.resumeTimer) clearTimeout(s.resumeTimer)
      s.resumeTimer = setTimeout(() => {
        s.userControlling = false
        // Advance to the next target when auto-drift resumes.
        s.targetIndex = (s.targetIndex + 1) % targets.length
      }, RESUME_DELAY)
    }

    // Clean up timers on unmount to prevent state updates on dead components.
    useEffect(() => {
      return () => {
        const s = stateRef.current
        if (s.dwellTimer) clearTimeout(s.dwellTimer)
        if (s.resumeTimer) clearTimeout(s.resumeTimer)
      }
    }, [])

    useFrame((_, delta) => {
      const s = stateRef.current
      if (s.userControlling || targets.length === 0) return

      const target = targets[s.targetIndex]

      // Smoothly translate the camera toward the target position.
      camera.position.lerp(target.cameraPosition, LERP_SPEED)

      // Smoothly rotate the camera to look at the graffiti wall.
      // We derive the target quaternion from a lookAt matrix to avoid gimbal lock.
      // Reuse pre-allocated scratch objects rather than allocating each frame.
      const targetMatrix = targetMatrixRef.current
      const targetQuat = targetQuatRef.current
      targetMatrix.lookAt(camera.position, target.lookAt, camera.up)
      targetQuat.setFromRotationMatrix(targetMatrix)
      camera.quaternion.slerp(targetQuat, LERP_SPEED * 3)

      // Once close enough, start the dwell countdown before moving to the next piece.
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
