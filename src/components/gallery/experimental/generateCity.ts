import * as THREE from "three"
import type { BuildingConfig, GraffitiTarget, GraffitiWall } from "./types"
import type { GalleryImage } from "@/types"

/** How far apart building grid cells are, in world units. */
const GRID_CELL_SIZE = 30

/**
 * Max random displacement applied to each building's X/Z position within its cell.
 * Keeps the grid readable while avoiding a perfectly rigid look.
 */
const JITTER = 5

/** Distance the camera is placed from the graffiti wall face when focusing on a piece. */
const CAMERA_DISTANCE = 18

/**
 * Generates a random procedural city layout for the given image set.
 *
 * Each image gets exactly one building with a rooftop stairhouse whose graffiti
 * wall displays that image as a texture. The grid is square-ish (ceil(sqrt(N)) columns).
 *
 * Call this once per image set (inside useMemo) — it uses Math.random() so the
 * city layout varies on each page load intentionally.
 *
 * @param images - Filtered + sorted gallery images to lay out
 * @returns buildings array and matching graffitiTargets array (same length, same order)
 */
export function generateCity(images: GalleryImage[]): {
  buildings: BuildingConfig[]
  graffitiTargets: GraffitiTarget[]
} {
  const N = images.length
  if (N === 0) return { buildings: [], graffitiTargets: [] }

  const gridCols = Math.ceil(Math.sqrt(N))
  const gridRows = Math.ceil(N / gridCols)
  const walls: GraffitiWall[] = ["north", "south", "east", "west"]

  const buildings: BuildingConfig[] = images.map((img, i) => {
    const col = i % gridCols
    const row = Math.floor(i / gridCols)

    // Center the grid around the world origin; add random jitter within each cell.
    const x =
      col * GRID_CELL_SIZE - (gridCols * GRID_CELL_SIZE) / 2 + (Math.random() - 0.5) * JITTER * 2
    const z =
      row * GRID_CELL_SIZE - (gridRows * GRID_CELL_SIZE) / 2 + (Math.random() - 0.5) * JITTER * 2

    // Randomise body dimensions: relatively wide range for visual variety.
    const bodyW = 3 + Math.random() * 7
    const bodyH = 5 + Math.random() * 25
    const bodyD = 3 + Math.random() * 7

    // Rooftop is slightly narrower/shallower than the body to look realistic.
    const rooftopW = Math.max(2, bodyW - 1)
    const rooftopH = 3 + Math.random() * 3
    const rooftopD = Math.max(2, bodyD - 1)

    const graffitiWall = walls[Math.floor(Math.random() * 4)]

    return {
      id: img.id,
      position: [x, 0, z],
      bodySize: [bodyW, bodyH, bodyD],
      rooftop: {
        size: [rooftopW, rooftopH, rooftopD],
        // offset reserved for future asymmetric rooftop placement
        offset: [0, 0, 0],
        graffitiWall,
      },
    }
  })

  /**
   * Compute camera positions for each building.
   *
   * The camera looks at the centre of the graffiti wall face.
   * It is elevated above the rooftop midpoint so the angle feels slightly
   * downward — natural for street/rooftop photography framing.
   */
  const graffitiTargets: GraffitiTarget[] = buildings.map((b) => {
    const [bx, , bz] = b.position
    const [rw, rh, rd] = b.rooftop.size

    // Y-centre of the rooftop structure in world space.
    const rooftopCenterY = b.bodySize[1] + rh / 2

    // Camera is placed above the rooftop height so it looks slightly down at the graffiti.
    const elevation = b.bodySize[1] + rh * 0.5 + 5

    let lookAt: THREE.Vector3
    let cameraPosition: THREE.Vector3

    switch (b.rooftop.graffitiWall) {
      case "north":
        lookAt = new THREE.Vector3(bx, rooftopCenterY, bz - rd / 2)
        cameraPosition = new THREE.Vector3(bx, elevation, bz - rd / 2 - CAMERA_DISTANCE)
        break
      case "south":
        lookAt = new THREE.Vector3(bx, rooftopCenterY, bz + rd / 2)
        cameraPosition = new THREE.Vector3(bx, elevation, bz + rd / 2 + CAMERA_DISTANCE)
        break
      case "east":
        lookAt = new THREE.Vector3(bx + rw / 2, rooftopCenterY, bz)
        cameraPosition = new THREE.Vector3(bx + rw / 2 + CAMERA_DISTANCE, elevation, bz)
        break
      case "west":
        lookAt = new THREE.Vector3(bx - rw / 2, rooftopCenterY, bz)
        cameraPosition = new THREE.Vector3(bx - rw / 2 - CAMERA_DISTANCE, elevation, bz)
        break
      default:
        // Exhaustive guard — TypeScript ensures GraffitiWall is always one of the four above.
        lookAt = new THREE.Vector3(bx, rooftopCenterY, bz - rd / 2)
        cameraPosition = new THREE.Vector3(bx, elevation, bz - rd / 2 - CAMERA_DISTANCE)
    }

    return { buildingId: b.id, cameraPosition, lookAt }
  })

  return { buildings, graffitiTargets }
}
