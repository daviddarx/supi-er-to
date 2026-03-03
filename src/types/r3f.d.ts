/**
 * Extend the global JSX namespace with React Three Fiber's Three.js element types.
 *
 * Without this, TypeScript does not recognise JSX tags like <mesh>, <group>,
 * <boxGeometry>, etc. in .tsx files, because they are not part of the standard
 * HTML/SVG element set. @react-three/fiber ships its own ThreeElements interface
 * that maps every Three.js class to its corresponding JSX intrinsic element.
 *
 * This file is picked up automatically via tsconfig.json's `include` glob.
 */
import type { ThreeElements } from "@react-three/fiber"

declare module "react" {
  // Merge R3F's Three.js element map into React's intrinsic element namespace
  // so <mesh>, <group>, <boxGeometry>, etc. are valid JSX without explicit casts.
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}
