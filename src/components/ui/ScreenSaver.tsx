"use client"

import { useCallback, useEffect, useRef } from "react"
import type { GalleryMode, ImageFilter } from "@/types"

// --- Idle Detection Hook ---

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

// --- Page Capture ---

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

// --- WebGL Shader ---

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

// --- ScreenSaver Component ---

const AMPLITUDE_TARGET = 0.03

interface ScreenSaverProps {
  enabled: boolean
  idleTimeout: number
  rampDuration: number
  mode: GalleryMode
  filter: ImageFilter
}

export function ScreenSaver({
  enabled,
  idleTimeout,
  rampDuration,
  mode,
  filter,
}: ScreenSaverProps) {
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
            rampStartAmplitude.current +
            (AMPLITUDE_TARGET - rampStartAmplitude.current) * rampProgress
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
    canvas.style.cssText =
      "position:fixed;inset:0;width:100%;height:100%;z-index:9997;pointer-events:none;"
    document.body.appendChild(canvas)
    canvasRef.current = canvas

    const resources = initWebGL(canvas, snapshot)
    if (!resources) {
      canvas.remove()
      canvasRef.current = null
      snapshotRef.current = null
      stateRef.current = "off"
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
