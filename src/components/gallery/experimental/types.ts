import * as THREE from "three"

/** Which face of the rooftop stairhouse carries the graffiti texture. */
export type GraffitiWall = "north" | "south" | "east" | "west"

/**
 * Describes a rooftop stairhouse / parapet structure that sits on top of a building body.
 * Graffiti is painted on one vertical face of this structure.
 */
export interface RooftopStructure {
  /** [width, height, depth] in world units */
  size: [number, number, number]
  /** Local XYZ offset from the building center (currently unused, reserved for asymmetric placement) */
  offset: [number, number, number]
  /** Which face of the rooftop structure carries the graffiti */
  graffitiWall: GraffitiWall
}

/**
 * Full configuration for a single building in the procedural city.
 * Each building hosts exactly one graffiti piece via its rooftop structure.
 */
export interface BuildingConfig {
  /** Matches GalleryImage.id — used to look up the texture and graffiti target */
  id: string
  /** World-space XZ position (Y is always 0 / ground) */
  position: [number, number, number]
  /** [width, height, depth] of the main building body */
  bodySize: [number, number, number]
  /** Rooftop stairhouse that displays the graffiti */
  rooftop: RooftopStructure
}

/**
 * Camera destination for focusing on a specific graffiti piece.
 * Generated once per city layout alongside BuildingConfig.
 */
export interface GraffitiTarget {
  /** Matches BuildingConfig.id */
  buildingId: string
  /** Where the camera should be positioned to frame the graffiti */
  cameraPosition: THREE.Vector3
  /** The world-space point the camera should look at */
  lookAt: THREE.Vector3
}
