# Screen Saver Feature — Design Spec

## Overview

A screen saver overlay that activates after user inactivity. It captures a snapshot of the current page and applies an evolving horizontal sine-wave displacement effect via a WebGL shader. Pixels wrapping off one side of the screen reappear on the other (toroidal wrapping). Available in Classic, Grid, and Explorative modes — not Experimental.

## Behavior

### Activation
- **Gallery modes** (Classic, Grid, Explorative): activates after **5 seconds** of inactivity
- **Carousel overlay open**: activates after **10 seconds** of inactivity
- **Experimental mode**: disabled entirely
- **Both desktop and mobile/touch devices**
- **Idle timer resets** on mode or filter changes (prevents capturing mid-transition)

### Interaction Events (reset idle timer / dismiss)
`mousemove`, `mousedown`, `touchstart`, `touchmove`, `keydown`, `scroll`, `wheel` — all on `window`, passive listeners, throttled ~100ms.

### Transitions
- **In:** Amplitude ramps from 0 to target over **1.5 seconds** (gradual build)
- **Out:** Amplitude ramps from current to 0 over **1.5 seconds** (gradual fade), then canvas + GL context destroyed
- **Window resize during screensaver:** treated as interaction, triggers dismiss

## Architecture

### New File
`src/components/ui/ScreenSaver.tsx` — single self-contained component + internal `useIdleDetection` hook.

### Props
```typescript
interface ScreenSaverProps {
  enabled: boolean        // false when mode === "experimental"
  idleTimeout: number     // ms — 5000 (gallery) or 10000 (carousel)
  rampDuration: number    // ms — default 1500
  mode: GalleryMode       // current gallery mode (for idle timer reset on change)
  filter: ImageFilter     // current filter (for idle timer reset on change)
}
```

### Integration Point
In `GalleryPageClient.tsx`, after `CarouselOverlay` (render order in file: `ZoomCursor` → `CarouselOverlay` → `ScreenSaver`). Since all use `position: fixed`, render order is irrelevant — z-index controls layering:

```tsx
<ZoomCursor mode={mode} />

<CarouselOverlay ... />

<ScreenSaver
  enabled={mode !== "experimental"}
  idleTimeout={carouselOpen ? 10000 : 5000}
  rampDuration={1500}
  mode={mode}
  filter={filter}
/>
```

No other changes needed in the gallery page, except one: `ExplorativeGallery.tsx` must set `preserveDrawingBuffer: true` on its R3F `<Canvas>` (see Page Capture section).

### Z-Index
**9997** — above carousel (z-100 set via `.yarl__root` in `globals.css`), below experimental keyboard hints (z-9998) and ZoomCursor (z-9999).

## Idle Detection Hook

```typescript
function useIdleDetection(
  timeout: number,
  enabled: boolean,
  resetDeps: unknown[],   // e.g. [mode, filter] — resets timer on change
  onIdle: () => void,
  onActive: () => void
)
```

- Sets `setTimeout` on mount, resets on each interaction event
- Timer fires → `onIdle()`
- Next interaction after idle → `onActive()`, restarts timer
- Events throttled (~100ms) to avoid excessive timer resets
- `enabled=false` → clears timer, removes listeners
- `timeout` change while running → resets timer with new duration
- `resetDeps` change → resets timer (prevents capture during Framer Motion transitions)

## Page Capture

### Strategy
- **Library:** `html2canvas` (~40KB minified, ~15KB gzipped)
- **Trigger:** Single capture on idle activation
- **Latency:** ~200-500ms, masked by the 1.5s amplitude ramp-up (amplitude starts at 0 during capture)
- **Static snapshot:** No repeated captures — screensaver shows frozen page, which is acceptable since user isn't interacting

### WebGL Canvas Capture (Explorative Mode)
`html2canvas` cannot capture WebGL canvas content — it produces a blank rectangle. Since Explorative mode renders entirely inside an R3F `<Canvas>`, special handling is required:

1. **`ExplorativeGallery.tsx`:** Add `gl={{ preserveDrawingBuffer: true }}` to the R3F `<Canvas>` element. This allows `canvas.toDataURL()` to read the WebGL framebuffer. Minor performance cost but necessary.
2. **Capture flow:**
   - Run `html2canvas(document.body, { scale: devicePixelRatio, useCORS: true, ignoreElements: (el) => el.tagName === 'CANVAS' })` to capture all non-canvas DOM content
   - Find any visible `<canvas>` elements in the page, call `canvas.toDataURL()` on each
   - Composite the canvas snapshots onto the `html2canvas` result at their correct viewport positions using `resultCanvas.getContext('2d').drawImage()`
3. **Classic/Grid modes:** No WebGL canvases visible, so `html2canvas` works as-is. The composite step is a no-op.

### WebGL Texture Upload
Upload the final composited canvas element directly to `texImage2D` (WebGL accepts canvas elements natively — no `getImageData()` extraction needed).

### WebGL Unavailable Fallback
If `canvas.getContext('webgl')` returns null, skip the screensaver entirely (do not activate). The feature is decorative, not functional.

## WebGL Shader

### Setup
- Raw WebGL (no Three.js / R3F) to avoid conflicts with Explorative/Experimental Three.js contexts and keep bundle lightweight
- Full-viewport `<canvas>` element (`position: fixed, inset: 0`)
- Canvas sized to `window.innerWidth * devicePixelRatio` x `window.innerHeight * devicePixelRatio`
- Fullscreen quad (2 triangles), snapshot uploaded as texture

### Vertex Shader
Standard fullscreen quad passing UV coordinates.

### Fragment Shader
```glsl
uniform sampler2D uTexture;
uniform float uTime;
uniform float uAmplitude;  // 0.0 → ~0.03 (fraction of screen width)
varying vec2 vUv;

void main() {
  // Evolving wave: multiple sine waves with different frequencies/speeds
  float wave1 = sin(vUv.y * 8.0 + uTime * 0.3) * 0.6;
  float wave2 = sin(vUv.y * 15.0 + uTime * 0.17) * 0.3;
  float wave3 = sin(vUv.y * 3.0 + uTime * 0.07) * 0.1;

  float displacement = (wave1 + wave2 + wave3) * uAmplitude;

  // Toroidal wrap: fract() wraps 0→1 seamlessly
  vec2 uv = vec2(fract(vUv.x + displacement), vUv.y);

  gl_FragColor = texture2D(uTexture, uv);
}
```

### Wave Characteristics
- Three overlapping sine waves at different frequencies (3, 8, 15 cycles) and speeds (0.07, 0.17, 0.3)
- Creates evolving, never-repeating patterns
- `fract()` provides seamless horizontal wrapping — pixels shifted off one edge reappear on the other
- **Amplitude target:** ~0.03 UV = ~3% screen width (~57px on 1920px). Tunable.

### Uniforms Updated per Frame
- `uTime`: monotonically increasing (from `performance.now()`)
- `uAmplitude`: animated 0→target (ramp in) or current→0 (ramp out) via linear interpolation over `rampDuration`

### Cleanup on Dismiss
When amplitude reaches 0: delete texture, delete shader program, lose GL context, remove `<canvas>` from DOM. Also null the reference to the `html2canvas` result canvas to free the full-viewport bitmap from memory.

## Dependency
- **`html2canvas`** — add to `package.json` dependencies
- **`preserveDrawingBuffer: true`** on `ExplorativeGallery.tsx` R3F Canvas — minor change to existing file
- No other new dependencies
