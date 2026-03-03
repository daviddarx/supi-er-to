/**
 * Ensures @react-three/fiber's JSX intrinsic element types (group, mesh,
 * boxGeometry, etc.) are available globally in strict TypeScript mode.
 *
 * R3F declares these via `declare global { namespace JSX { ... } }` inside its
 * three-types.d.ts, but Next.js 16 + Turbopack requires an explicit reference
 * to pull that global augmentation into scope for all project files.
 */
/// <reference types="@react-three/fiber" />
