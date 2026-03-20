"use client"

import { Suspense, useState, useEffect, useRef, useCallback, useMemo, type MouseEvent } from "react"
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

function simulateKey(key: string) {
  return (e: MouseEvent) => {
    e.stopPropagation()
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }))
  }
}

const kbdClickStyle: React.CSSProperties = {
  cursor: "pointer",
  pointerEvents: "auto",
}

const SPINNER_SIZE = 80
const STROKE_WIDTH = 1
const RADIUS = (SPINNER_SIZE - STROKE_WIDTH) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** Detect mobile/low-memory device for texture size + preload count. */
const isMobileDevice = () =>
  typeof window !== "undefined" &&
  (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768)

export default function ExperimentalGallery({ images, isDarkMode }: ExperimentalGalleryProps) {
  const bgColor = isDarkMode ? "#0a0a0a" : "#ffffff"
  const isMobile = useMemo(() => isMobileDevice(), [])
  const textureSize: 500 | 1280 = isMobile ? 500 : 1280
  const preloadCount = isMobile ? 30 : images.length
  const [imagesPreloaded, setImagesPreloaded] = useState(false)
  const [sceneReady, setSceneReady] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [focusedIsLeft, setFocusedIsLeft] = useState(true)
  const [hasScrolled, setHasScrolled] = useState(false)
  const handleSceneReady = useCallback(() => setSceneReady(true), [])

  // Prevent page scrollbar while experimental gallery is mounted
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  // Listen for focus/unfocus events from ThreeDScene
  useEffect(() => {
    const onZoomIn = (e: Event) => {
      setIsFocused(true)
      const detail = (e as CustomEvent).detail
      if (detail) setFocusedIsLeft(detail.isLeft)
    }
    const onZoomOut = () => setIsFocused(false)
    window.addEventListener("image-zoomed-in", onZoomIn)
    window.addEventListener("image-zoomed-out", onZoomOut)
    const onScroll = () => setHasScrolled(true)
    window.addEventListener("wheel", onScroll, { once: true })
    window.addEventListener("touchmove", onScroll, { once: true })
    return () => {
      window.removeEventListener("image-zoomed-in", onZoomIn)
      window.removeEventListener("image-zoomed-out", onZoomOut)
      window.removeEventListener("wheel", onScroll)
      window.removeEventListener("touchmove", onScroll)
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
    // On mobile, only preload first batch to avoid GPU memory crash
    const imagesToPreload = images.slice(0, preloadCount)
    const total = imagesToPreload.length

    // Preload as vanilla Image objects — no Three.js overhead, keeps main thread free
    // for smooth loader UI updates. useTexture will then hit browser cache instantly.
    for (const image of imagesToPreload) {
      const url = getImageSrc(image.id, textureSize)
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
                <ThreeDScene
                  images={images}
                  isDarkMode={isDarkMode}
                  textureSize={textureSize}
                  onReady={handleSceneReady}
                />
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
          <kbd
            style={{ ...kbdStyle(isDarkMode), ...kbdClickStyle }}
            onClick={simulateKey("ArrowLeft")}
          >
            <IconArrowLeft className="size-3" />
          </kbd>
          <kbd
            style={{ ...kbdStyle(isDarkMode), ...kbdClickStyle }}
            onClick={simulateKey("ArrowRight")}
          >
            <IconArrowRight className="size-3" />
          </kbd>
          <span
            style={{ marginLeft: "6px", ...kbdClickStyle }}
            onClick={simulateKey(focusedIsLeft ? "ArrowRight" : "ArrowLeft")}
          >
            Navigate
          </span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <kbd
            style={{ ...kbdStyle(isDarkMode), ...kbdClickStyle }}
            onClick={simulateKey("ArrowDown")}
          >
            <IconArrowDown className="size-3" />
          </kbd>
          <span style={{ marginLeft: "6px", ...kbdClickStyle }} onClick={simulateKey("ArrowDown")}>
            Switch side
          </span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <kbd
            style={{
              ...kbdStyle(isDarkMode),
              ...kbdClickStyle,
              fontSize: "10px",
              padding: "2px 6px",
            }}
            onClick={simulateKey("Escape")}
          >
            Esc
          </kbd>
          <span style={{ marginLeft: "6px", ...kbdClickStyle }} onClick={simulateKey("Escape")}>
            Close
          </span>
        </span>
      </div>

      {/* Scroll hint — visible when no picture is focused */}
      <div
        style={{
          position: "fixed",
          bottom: "calc(var(--header-height, 0px) + var(--gutter))",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          fontFamily: "var(--font-dm-mono), monospace",
          fontSize: "10px",
          color: isDarkMode ? "rgba(255,255,255,1)" : "rgba(0,0,0,1)",
          pointerEvents: "none",
          opacity: sceneReady && !isFocused && !hasScrolled ? 1 : 0,
          transition: "opacity 0.3s ease",
          zIndex: 9998,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <kbd style={{ ...kbdStyle(isDarkMode), fontSize: "10px", padding: "2px 6px" }}>
            {isMobile ? "Swipe" : "Scroll"}
          </kbd>
          <span style={{ marginLeft: "6px" }}>Advance in the corridor</span>
        </span>
      </div>
    </>
  )
}
