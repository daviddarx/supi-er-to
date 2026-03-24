# Screen Saver Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an idle-activated screen saver overlay that captures the page and applies an evolving sine-wave horizontal displacement shader with toroidal pixel wrapping.

**Architecture:** Self-contained `ScreenSaver.tsx` component with internal idle detection hook and raw WebGL shader. Captures page via `html2canvas` (with WebGL canvas compositing for Explorative mode), renders through a fragment shader with three overlapping sine waves and `fract()` wrapping. Amplitude ramps in/out over 1.5s.

**Tech Stack:** html2canvas, raw WebGL (GLSL), React hooks

---

## Chunk 1: Dependencies, Idle Hook, and ScreenSaver Component

### File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/components/ui/ScreenSaver.tsx` | Idle detection hook + WebGL screensaver overlay component |
| Modify | `src/components/gallery/ExplorativeGallery.tsx:476` | Add `preserveDrawingBuffer: true` to R3F Canvas gl prop |
| Modify | `src/app/[[...path]]/GalleryPageClient.tsx:383` | Mount ScreenSaver component |
| Modify | `package.json:14` | Add `html2canvas` dependency |

---

### Task 1: Install html2canvas

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install html2canvas**

```bash
npm install html2canvas
```

- [ ] **Step 2: Verify installation**

```bash
node -e "require('html2canvas'); console.log('ok')"
```
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add html2canvas dependency for screensaver feature"
```

---

### Task 2: Add preserveDrawingBuffer to Explorative Canvas

**Files:**
- Modify: `src/components/gallery/ExplorativeGallery.tsx:476`

- [ ] **Step 1: Modify the Canvas gl prop**

In `src/components/gallery/ExplorativeGallery.tsx`, find line 476:

```tsx
gl={{ antialias: true, alpha: true }}
```

Change to:

```tsx
gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
```

This allows `canvas.toDataURL()` to read the WebGL framebuffer for screensaver capture.

- [ ] **Step 2: Verify dev server still works**

```bash
npm run dev
```

Open Explorative mode in browser, confirm images still render and drag works.

- [ ] **Step 3: Commit**

```bash
git add src/components/gallery/ExplorativeGallery.tsx
git commit -m "feat: enable preserveDrawingBuffer on Explorative Canvas for screensaver capture"
```

---

### Task 3: Create ScreenSaver component — idle detection hook

**Files:**
- Create: `src/components/ui/ScreenSaver.tsx`

- [ ] **Step 1: Create the file with the useIdleDetection hook**

Create `src/components/ui/ScreenSaver.tsx` with the idle detection hook. This hook:
- Listens for `mousemove`, `mousedown`, `touchstart`, `touchmove`, `keydown`, `scroll`, `wheel`, `resize` on `window` (passive)
- Throttles event handling (~100ms) to avoid excessive timer resets
- Calls `onIdle()` when timeout elapses with no interaction
- Calls `onActive()` on first interaction after idle, then restarts timer
- Resets timer when `timeout` or any `resetDeps` value changes
- Cleans up all listeners and timers on unmount or when `enabled=false`

```typescript
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { GalleryMode, ImageFilter } from "@/types"

const INTERACTION_EVENTS = [
  "mousemove",
  "mousedown",
  "touchstart",
  "touchmove",
  "keydown",
  "scroll",
  "wheel",
  "resize",
] as const

function useIdleDetection(
  timeout: number,
  enabled: boolean,
  resetDeps: unknown[],
  onIdle: () => void,
  onActive: () => void
) {
  const isIdle = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastEventTime = useRef(0)
  const onIdleRef = useRef(onIdle)
  const onActiveRef = useRef(onActive)

  onIdleRef.current = onIdle
  onActiveRef.current = onActive

  useEffect(() => {
    if (!enabled) return

    const resetTimer = () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
      timerRef.current = setTimeout(() => {
        isIdle.current = true
        onIdleRef.current()
      }, timeout)
    }

    const handleEvent = () => {
      const now = Date.now()
      if (now - lastEventTime.current < 100) return
      lastEventTime.current = now

      if (isIdle.current) {
        isIdle.current = false
        onActiveRef.current()
      }
      resetTimer()
    }

    for (const event of INTERACTION_EVENTS) {
      window.addEventListener(event, handleEvent, { passive: true })
    }

    resetTimer()

    return () => {
      for (const event of INTERACTION_EVENTS) {
        window.removeEventListener(event, handleEvent)
      }
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      isIdle.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeout, enabled, ...resetDeps])
}
```

Leave the file with just this hook for now. The component will be added in the next task.

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```
Expected: No errors related to ScreenSaver.tsx

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/ScreenSaver.tsx
git commit -m "feat: add useIdleDetection hook for screensaver"
```

---

### Task 4: Create ScreenSaver component — WebGL shader and capture logic

**Files:**
- Modify: `src/components/ui/ScreenSaver.tsx`

- [ ] **Step 1: Add the page capture function**

Add this function below the `useIdleDetection` hook in `ScreenSaver.tsx`. It handles both regular DOM capture and WebGL canvas compositing for Explorative mode:

```typescript
async function capturePageSnapshot(): Promise<HTMLCanvasElement | null> {
  const html2canvas = (await import("html2canvas")).default

  // Collect all visible canvas elements before capture (for WebGL compositing)
  const canvasElements = Array.from(document.querySelectorAll("canvas")).filter(
    (c) => c.offsetWidth > 0 && c.offsetHeight > 0
  )

  const result = await html2canvas(document.body, {
    scale: window.devicePixelRatio,
    useCORS: true,
    ignoreElements: (el) => el instanceof HTMLCanvasElement,
  })

  // Composite any canvas elements (e.g. R3F in Explorative mode) onto the snapshot.
  // html2canvas can't capture WebGL content, so we draw them manually.
  // For non-WebGL canvases or canvases without preserveDrawingBuffer, drawImage
  // will draw transparent — which is harmless.
  if (canvasElements.length > 0) {
    const ctx = result.getContext("2d")
    if (ctx) {
      for (const canvasEl of canvasElements) {
        const rect = canvasEl.getBoundingClientRect()
        ctx.drawImage(
          canvasEl,
          rect.left * window.devicePixelRatio,
          rect.top * window.devicePixelRatio,
          rect.width * window.devicePixelRatio,
          rect.height * window.devicePixelRatio
        )
      }
    }
  }

  return result
}
```

- [ ] **Step 2: Add the WebGL setup and shader code**

Add these functions below `capturePageSnapshot`. The vertex shader renders a fullscreen quad, the fragment shader applies the evolving sine-wave displacement with toroidal wrapping via `fract()`:

```typescript
const VERTEX_SHADER = `
  attribute vec2 aPosition;
  varying vec2 vUv;
  void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`

const FRAGMENT_SHADER = `
  precision highp float;
  uniform sampler2D uTexture;
  uniform float uTime;
  uniform float uAmplitude;
  varying vec2 vUv;
  void main() {
    float wave1 = sin(vUv.y * 8.0 + uTime * 0.3) * 0.6;
    float wave2 = sin(vUv.y * 15.0 + uTime * 0.17) * 0.3;
    float wave3 = sin(vUv.y * 3.0 + uTime * 0.07) * 0.1;
    float displacement = (wave1 + wave2 + wave3) * uAmplitude;
    vec2 uv = vec2(fract(vUv.x + displacement), vUv.y);
    gl_FragColor = texture2D(uTexture, uv);
  }
`

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function initWebGL(canvas: HTMLCanvasElement, snapshot: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl")
  if (!gl) return null
  gl.viewport(0, 0, canvas.width, canvas.height)

  const vertShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fragShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  if (!vertShader || !fragShader) return null

  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vertShader)
  gl.attachShader(program, fragShader)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program))
    return null
  }
  gl.useProgram(program)

  // Fullscreen quad
  const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)
  const aPosition = gl.getAttribLocation(program, "aPosition")
  gl.enableVertexAttribArray(aPosition)
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0)

  // Texture from snapshot
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, snapshot)

  const uTime = gl.getUniformLocation(program, "uTime")
  const uAmplitude = gl.getUniformLocation(program, "uAmplitude")

  return { gl, program, texture, buffer, vertShader, fragShader, uTime, uAmplitude }
}

function cleanupWebGL(resources: NonNullable<ReturnType<typeof initWebGL>>) {
  const { gl, program, texture, buffer, vertShader, fragShader } = resources
  gl.deleteTexture(texture)
  gl.deleteBuffer(buffer)
  gl.deleteShader(vertShader)
  gl.deleteShader(fragShader)
  gl.deleteProgram(program)
  gl.getExtension("WEBGL_lose_context")?.loseContext()
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/ScreenSaver.tsx
git commit -m "feat: add WebGL shader and page capture for screensaver"
```

---

### Task 5: Create ScreenSaver component — React component with ramp animation

**Files:**
- Modify: `src/components/ui/ScreenSaver.tsx`

- [ ] **Step 1: Add the ScreenSaver React component**

Add the main component export at the bottom of `ScreenSaver.tsx`. This component:
- Uses `useIdleDetection` to detect idle/active state
- On idle: captures snapshot, creates WebGL canvas, starts rAF loop ramping amplitude up
- On active: ramps amplitude down, then cleans up WebGL and removes canvas
- Canvas is `position: fixed, inset: 0, z-index: 9997`

```typescript
const AMPLITUDE_TARGET = 0.03

interface ScreenSaverProps {
  enabled: boolean
  idleTimeout: number
  rampDuration: number
  mode: GalleryMode
  filter: ImageFilter
}

export function ScreenSaver({ enabled, idleTimeout, rampDuration, mode, filter }: ScreenSaverProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const glResources = useRef<ReturnType<typeof initWebGL>>(null)
  const rafRef = useRef<number | null>(null)
  const snapshotRef = useRef<HTMLCanvasElement | null>(null)
  const stateRef = useRef<"capturing" | "ramping-in" | "active" | "ramping-out" | "off">("off")
  const amplitudeRef = useRef(0)
  const rampStartTime = useRef(0)
  const rampStartAmplitude = useRef(0)
  const startTimeRef = useRef(0)

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (glResources.current) {
      cleanupWebGL(glResources.current)
      glResources.current = null
    }
    if (canvasRef.current) {
      canvasRef.current.remove()
      canvasRef.current = null
    }
    snapshotRef.current = null
    amplitudeRef.current = 0
    stateRef.current = "off"
  }, [])

  const startRenderLoop = useCallback(() => {
    const resources = glResources.current
    if (!resources) return

    const { gl, uTime, uAmplitude } = resources

    const tick = () => {
      const now = performance.now()
      const elapsed = (now - startTimeRef.current) / 1000

      // Handle amplitude ramping
      if (stateRef.current === "ramping-in" || stateRef.current === "ramping-out") {
        const rampElapsed = now - rampStartTime.current
        const rampProgress = Math.min(rampElapsed / rampDuration, 1)

        if (stateRef.current === "ramping-in") {
          amplitudeRef.current =
            rampStartAmplitude.current + (AMPLITUDE_TARGET - rampStartAmplitude.current) * rampProgress
          if (rampProgress >= 1) stateRef.current = "active"
        } else {
          amplitudeRef.current = rampStartAmplitude.current * (1 - rampProgress)
          if (rampProgress >= 1) {
            cleanup()
            return
          }
        }
      }

      gl.uniform1f(uTime, elapsed)
      gl.uniform1f(uAmplitude, amplitudeRef.current)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [rampDuration, cleanup])

  const onIdle = useCallback(async () => {
    if (stateRef.current !== "off") return
    stateRef.current = "capturing"

    const snapshot = await capturePageSnapshot()
    if (!snapshot || stateRef.current !== "capturing") {
      // User became active during capture, or capture failed
      if (stateRef.current === "capturing") stateRef.current = "off"
      return
    }

    snapshotRef.current = snapshot

    const canvas = document.createElement("canvas")
    canvas.width = window.innerWidth * window.devicePixelRatio
    canvas.height = window.innerHeight * window.devicePixelRatio
    canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:9997;pointer-events:none;"
    document.body.appendChild(canvas)
    canvasRef.current = canvas

    const resources = initWebGL(canvas, snapshot)
    if (!resources) {
      canvas.remove()
      canvasRef.current = null
      snapshotRef.current = null
      return
    }

    glResources.current = resources
    stateRef.current = "ramping-in"
    amplitudeRef.current = 0
    rampStartAmplitude.current = 0
    rampStartTime.current = performance.now()
    startTimeRef.current = performance.now()

    startRenderLoop()
  }, [startRenderLoop])

  const onActive = useCallback(() => {
    if (stateRef.current === "off") return

    // Cancel if still capturing (async html2canvas in progress)
    if (stateRef.current === "capturing") {
      stateRef.current = "off"
      return
    }

    if (stateRef.current === "ramping-in" || stateRef.current === "active") {
      stateRef.current = "ramping-out"
      rampStartAmplitude.current = amplitudeRef.current
      rampStartTime.current = performance.now()
      // rAF loop already running, it will handle the ramp-out and cleanup
    }
  }, [])

  useIdleDetection(idleTimeout, enabled, [mode, filter], onIdle, onActive)

  // Cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  // No JSX — canvas is created imperatively
  return null
}
```

- [ ] **Step 2: Run format and type check**

```bash
npm run format && npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/ScreenSaver.tsx
git commit -m "feat: add ScreenSaver React component with ramp animation"
```

---

### Task 6: Integrate ScreenSaver in GalleryPageClient

**Files:**
- Modify: `src/app/[[...path]]/GalleryPageClient.tsx`

- [ ] **Step 1: Add import**

At the top of `GalleryPageClient.tsx`, add the import alongside other component imports (near line 12):

```typescript
import { ScreenSaver } from "@/components/ui/ScreenSaver"
```

- [ ] **Step 2: Mount the component**

After the `CarouselOverlay` block (after line 383), before the admin `NewPieceSheet` block, add:

```tsx
{/* Screen saver — idle-activated displacement shader overlay */}
<ScreenSaver
  enabled={mode !== "experimental"}
  idleTimeout={carouselOpen ? 10000 : 5000}
  rampDuration={1500}
  mode={mode}
  filter={filter}
/>
```

- [ ] **Step 3: Run format and type check**

```bash
npm run format && npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 4: Manual test**

```bash
npm run dev
```

Test in browser:
1. **Classic mode:** Wait 5 seconds idle → screensaver should gradually appear with wavy displacement. Move mouse → should gradually fade out.
2. **Grid mode:** Same test.
3. **Explorative mode:** Same test. Verify the R3F canvas content is captured (not blank).
4. **Experimental mode:** Verify screensaver does NOT activate.
5. **Carousel:** Open an image, wait 10 seconds → screensaver should activate over carousel. Interact → dismiss.
6. **Mode switching:** Switch modes → verify idle timer resets (no immediate activation).
7. **Toroidal wrapping:** Verify no blank edges — pixels shifted off one side appear on the other.

- [ ] **Step 5: Commit**

```bash
git add src/app/\[\[...path\]\]/GalleryPageClient.tsx
git commit -m "feat: integrate ScreenSaver component in gallery page"
```

- [ ] **Step 6: Run format on all changed files**

```bash
npm run format
```
