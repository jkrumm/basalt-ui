/**
 * The chain's viewport: a native scroller (pan by wheel, trackpad, one finger, the arrow keys and a
 * mouse drag on empty canvas) over a graph drawn at a scale. It opens fitted to the frame's width,
 * never below `FIT_FLOOR`, and follows the width until the reader zooms. Ctrl or Cmd with the wheel
 * (a trackpad pinch arrives so), a two-finger pinch and the zoom steps keep the point under the
 * pointer (or the centre) where it was. The frame is never taller than the page's visible scroll
 * area, so its scrollbars and controls are on screen whenever its top is.
 */
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { scrollParentOf } from '../common/scroll-parent'

/** Below half size a 14 px title is 7 px: the shape, not the text. A larger graph is panned. */
export const FIT_FLOOR = 0.5
export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 2
/** One zoom step of the controls and the keys. */
export const ZOOM_STEP = 1.25
/** Wheel delta to zoom: a mouse notch (100) is about one step, a trackpad pinch a smooth ramp. */
const WHEEL_RATE = 0.0022
/** A box zoomed to keeps this much room to the frame's edge. */
const INSET = 16

export type ChainBox = { x: number; y: number; width: number; height: number }

const clamp = (value: number): number => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value))

/** Where a graph point (unscaled) should sit in the frame after the next scale is drawn. */
type Anchor = { gx: number; gy: number; fx: number; fy: number }

export type ChainViewport = {
  /** Attach to the scroll element (a callback ref). */
  frame: (node: HTMLDivElement | null) => void
  scale: number
  /** True while the scale follows the frame's width. */
  fitted: boolean
  /** The frame's height cap in px, or undefined before it is measured. */
  room: number | undefined
  /** True when the graph is larger than the frame: a drag on empty canvas pans. */
  pans: boolean
  zoomBy: (factor: number, at?: { x: number; y: number }) => void
  fit: () => void
  /** Zooms (never past 1) so the box fills the frame, its top left corner in view. */
  zoomTo: (box: ChainBox) => void
  drag: {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void
    onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void
  }
}

export function useChainViewport(graph: { width: number; height: number }): ChainViewport {
  // The element for writes (a ref: the compiler forbids writing through state), the state for effects.
  const el = useRef<HTMLDivElement | null>(null)
  const [frame, setFrame] = useState<HTMLDivElement | null>(null)
  const frameRef = useCallback((node: HTMLDivElement | null) => {
    el.current = node
    setFrame(node)
  }, [])
  const scrollTo = useCallback((left: number, top: number): void => {
    const node = el.current
    if (node === null) return
    node.scrollLeft = left
    node.scrollTop = top
  }, [])
  const [size, setSize] = useState({ width: 0, height: 0, room: 0 })
  const [zoom, setZoom] = useState<number | null>(null)
  const anchor = useRef<Anchor | null>(null)
  const dragFrom = useRef<{ id: number; x: number; y: number; left: number; top: number } | null>(
    null,
  )

  useEffect(() => {
    if (frame === null) return
    const port = scrollParentOf(frame)
    const measure = (): void =>
      setSize({
        width: frame.clientWidth,
        height: frame.clientHeight,
        room: port?.clientHeight ?? window.innerHeight,
      })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    if (port !== null) observer.observe(port)
    else window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [frame])

  const fitScale =
    graph.width === 0 || size.width === 0
      ? 1
      : Math.min(1, Math.max(FIT_FLOOR, size.width / graph.width))
  const scale = zoom ?? fitScale
  const scaleRef = useRef(scale)

  // A new scale is drawn first, then the scroll moves the anchor back under the pointer.
  useLayoutEffect(() => {
    scaleRef.current = scale
    const at = anchor.current
    if (at === null) return
    anchor.current = null
    scrollTo(at.gx * scale - at.fx, at.gy * scale - at.fy)
  })

  const zoomBy = useCallback(
    (factor: number, at?: { x: number; y: number }) => {
      if (frame === null) return
      const now = scaleRef.current
      const next = clamp(now * factor)
      if (next === now) return
      const fx = at?.x ?? frame.clientWidth / 2
      const fy = at?.y ?? frame.clientHeight / 2
      anchor.current = {
        gx: (frame.scrollLeft + fx) / now,
        gy: (frame.scrollTop + fy) / now,
        fx,
        fy,
      }
      setZoom(next)
    },
    [frame],
  )

  const fit = useCallback(() => {
    // Already fitted, the state set draws nothing: back to the origin now, with no anchor left over.
    if (zoom === null) {
      anchor.current = null
      scrollTo(0, 0)
      return
    }
    anchor.current = { gx: 0, gy: 0, fx: 0, fy: 0 }
    setZoom(null)
  }, [zoom, scrollTo])

  const zoomTo = useCallback(
    (box: ChainBox) => {
      if (frame === null) return
      const room = Math.max(size.room, frame.clientHeight)
      const next = clamp(
        Math.min(
          1,
          (frame.clientWidth - 2 * INSET) / Math.max(1, box.width),
          (room - 2 * INSET) / Math.max(1, box.height),
        ),
      )
      anchor.current = { gx: box.x, gy: box.y, fx: INSET, fy: INSET }
      setZoom(next)
      // The same scale draws nothing new: move now.
      if (next === scaleRef.current) {
        anchor.current = null
        scrollTo(box.x * next - INSET, box.y * next - INSET)
      }
    },
    [frame, size.room, scrollTo],
  )

  // Ctrl or Cmd with the wheel zooms; the plain wheel is the page's and the frame's own scroll.
  useEffect(() => {
    if (frame === null) return
    const onWheel = (event: WheelEvent): void => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const rect = frame.getBoundingClientRect()
      const delta = Math.max(-100, Math.min(100, event.deltaY))
      zoomBy(Math.exp(-delta * WHEEL_RATE), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      })
    }
    // Two fingers pinch; one finger stays the browser's own pan.
    let pinch: { distance: number; scale: number } | null = null
    const spread = (touches: TouchList): number => {
      const [a, b] = [touches[0], touches[1]]
      return a === undefined || b === undefined
        ? 0
        : Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    }
    const onTouchStart = (event: TouchEvent): void => {
      pinch =
        event.touches.length === 2
          ? { distance: spread(event.touches), scale: scaleRef.current }
          : null
    }
    const onTouchMove = (event: TouchEvent): void => {
      if (pinch === null || event.touches.length !== 2 || pinch.distance === 0) return
      event.preventDefault()
      const [a, b] = [event.touches[0], event.touches[1]]
      if (a === undefined || b === undefined) return
      const rect = frame.getBoundingClientRect()
      const target = pinch.scale * (spread(event.touches) / pinch.distance)
      zoomBy(target / scaleRef.current, {
        x: (a.clientX + b.clientX) / 2 - rect.left,
        y: (a.clientY + b.clientY) / 2 - rect.top,
      })
    }
    const onTouchEnd = (): void => {
      pinch = null
    }
    frame.addEventListener('wheel', onWheel, { passive: false })
    frame.addEventListener('touchstart', onTouchStart, { passive: true })
    frame.addEventListener('touchmove', onTouchMove, { passive: false })
    frame.addEventListener('touchend', onTouchEnd)
    return () => {
      frame.removeEventListener('wheel', onWheel)
      frame.removeEventListener('touchstart', onTouchStart)
      frame.removeEventListener('touchmove', onTouchMove)
      frame.removeEventListener('touchend', onTouchEnd)
    }
  }, [frame, zoomBy])

  const pans =
    size.width > 0 &&
    (graph.width * scale > size.width + 0.5 || graph.height * scale > size.height + 0.5)

  const end = (event: ReactPointerEvent<HTMLElement>): void => {
    if (dragFrom.current?.id !== event.pointerId) return
    dragFrom.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  return {
    frame: frameRef,
    scale,
    fitted: zoom === null,
    room: size.room === 0 ? undefined : size.room,
    pans,
    zoomBy,
    fit,
    zoomTo,
    drag: {
      onPointerDown: (event) => {
        if (frame === null || event.pointerType !== 'mouse' || event.button !== 0) return
        // A node is a target of its own: the drag starts on empty canvas only.
        if ((event.target as Element).closest('[data-slot="chain-node"]') !== null) return
        dragFrom.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          left: frame.scrollLeft,
          top: frame.scrollTop,
        }
        event.currentTarget.setPointerCapture?.(event.pointerId)
      },
      onPointerMove: (event) => {
        const from = dragFrom.current
        if (frame === null || from === null || from.id !== event.pointerId) return
        scrollTo(from.left - (event.clientX - from.x), from.top - (event.clientY - from.y))
      },
      onPointerUp: end,
      onPointerCancel: end,
    },
  }
}
