"use client"

import { Suspense, useState, useEffect, useRef, useCallback } from "react"
import { Canvas } from "@react-three/fiber"
import { ThreeDScene, CAMERA_START_Z } from "./experimental/ThreeDScene"
import { IconArrowLeft, IconArrowRight, IconArrowDown } from "@/components/ui/icons"
import { getImageSrc } from "@/lib/images"
import type { GalleryImage } from "@/types"

interface ExperimentalGalleryProps {
  images: GalleryImage[]
  isDarkMode: boolean
}

function kbdStyle(isDark: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: "22px",
    minWidth: "22px",
    padding: "2px 4px",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"}`,
    borderRadius: "3px",
    background: isDark ? "#000" : "#fff",
    fontFamily: "inherit",
    lineHeight: 1,
  }
}

const SPINNER_SIZE = 80
const STROKE_WIDTH = 1
const RADIUS = (SPINNER_SIZE - STROKE_WIDTH) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function ExperimentalGallery({ images, isDarkMode }: ExperimentalGalleryProps) {
  const bgColor = isDarkMode ? "#0a0a0a" : "#ffffff"
  const [imagesPreloaded, setImagesPreloaded] = useState(false)
  const [sceneReady, setSceneReady] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const handleSceneReady = useCallback(() => setSceneReady(true), [])

  // Listen for focus/unfocus events from ThreeDScene
  useEffect(() => {
    const onZoomIn = () => setIsFocused(true)
    const onZoomOut = () => setIsFocused(false)
    window.addEventListener("image-zoomed-in", onZoomIn)
    window.addEventListener("image-zoomed-out", onZoomOut)
    return () => {
      window.removeEventListener("image-zoomed-in", onZoomIn)
      window.removeEventListener("image-zoomed-out", onZoomOut)
    }
  }, [])

  // Direct DOM refs — bypass React for smooth updates during heavy loading
  const ringRef = useRef<SVGCircleElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const loaderRef = useRef<HTMLDivElement>(null)
  const countRef = useRef(0)

  const color = isDarkMode ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)"
  const trackColor = isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"

  useEffect(() => {
    if (images.length === 0) {
      setImagesPreloaded(true)
      setSceneReady(true)
      return
    }

    let stale = false
    countRef.current = 0
    const total = images.length

    // Preload as vanilla Image objects — no Three.js overhead, keeps main thread free
    // for smooth loader UI updates. useTexture will then hit browser cache instantly.
    for (const image of images) {
      const url = getImageSrc(image.id, 1280)
      const img = new Image()
      img.onload = img.onerror = () => {
        if (stale) return
        countRef.current++
        const count = countRef.current

        if (textRef.current) {
          textRef.current.textContent = `${count}/${total}`
        }
        if (ringRef.current) {
          const progress = Math.min(count / total, 1)
          ringRef.current.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - progress))
        }

        if (count >= total) {
          setImagesPreloaded(true)
        }
      }
      img.src = url
    }

    return () => {
      stale = true
    }
  }, [images])

  return (
    <>
      <div style={{ position: "fixed", inset: 0 }}>
        <div
          ref={loaderRef}
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
            background: bgColor,
            opacity: sceneReady ? 0 : 1,
            pointerEvents: sceneReady ? "none" : "auto",
            transition: "opacity 0.6s ease",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <div style={{ position: "relative", width: SPINNER_SIZE, height: SPINNER_SIZE }}>
              <svg
                width={SPINNER_SIZE}
                height={SPINNER_SIZE}
                style={{ transform: "rotate(-90deg)" }}
              >
                <circle
                  cx={SPINNER_SIZE / 2}
                  cy={SPINNER_SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={trackColor}
                  strokeWidth={STROKE_WIDTH}
                />
                <circle
                  ref={ringRef}
                  cx={SPINNER_SIZE / 2}
                  cy={SPINNER_SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={color}
                  strokeWidth={STROKE_WIDTH}
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={CIRCUMFERENCE}
                  strokeLinecap="round"
                />
              </svg>
              <div
                ref={textRef}
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-dm-mono), monospace",
                  fontSize: "11px",
                  color,
                }}
              >
                0/{images.length}
              </div>
            </div>
            <div
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: "11px",
                color,
              }}
            >
              {imagesPreloaded ? "Initializing scene..." : "Loading images..."}
            </div>
          </div>
        </div>

        {imagesPreloaded && (
          <div
            style={{
              width: "100%",
              height: "100%",
              opacity: sceneReady ? 1 : 0,
              transition: "opacity 0.6s ease",
            }}
          >
            <Canvas
              camera={{ position: [0, 0, CAMERA_START_Z], fov: 50, near: 0.1, far: 5000 }}
              gl={{ antialias: true, alpha: false, logarithmicDepthBuffer: true }}
              style={{ background: bgColor }}
            >
              <Suspense fallback={null}>
                <ThreeDScene images={images} isDarkMode={isDarkMode} onReady={handleSceneReady} />
              </Suspense>
            </Canvas>
          </div>
        )}
      </div>

      {/* Keyboard shortcut legend — outside canvas container for proper stacking */}
      <div
        style={{
          position: "fixed",
          bottom: "calc(var(--header-height, 0px) + var(--gutter))",
          left: 0,
          paddingLeft: "var(--gutter)",
          fontFamily: "var(--font-dm-mono), monospace",
          fontSize: "10px",
          color: isDarkMode ? "rgba(255,255,255,1)" : "rgba(0,0,0,1)",
          pointerEvents: "none",
          opacity: isFocused ? 1 : 0,
          transition: "opacity 0.3s ease",
          zIndex: 9998,
          display: "flex",
          alignItems: "center",
          gap: "20px",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <kbd style={kbdStyle(isDarkMode)}>
            <IconArrowLeft className="size-3" />
          </kbd>
          <kbd style={kbdStyle(isDarkMode)}>
            <IconArrowRight className="size-3" />
          </kbd>
          <span style={{ marginLeft: "2px" }}>Navigate</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <kbd style={kbdStyle(isDarkMode)}>
            <IconArrowDown className="size-3" />
          </kbd>
          <span style={{ marginLeft: "2px" }}>Switch side</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <kbd style={{ ...kbdStyle(isDarkMode), fontSize: "10px", padding: "2px 6px" }}>Esc</kbd>
          <span style={{ marginLeft: "2px" }}>Close</span>
        </span>
      </div>
    </>
  )
}
