/**
 * The pure sizing seam (`docs/V2-SPEC.md` § 9.2, § 9.6): measured width → container class →
 * height. `resolveChartSize` is the law; `useChartSize` only measures and feeds it. Neither knows
 * the engine, the legend or the card.
 */
import { useCallback, useRef, useState, useSyncExternalStore } from 'react'
import type { RefCallback } from 'react'
import { useIsomorphicLayoutEffect } from '../common/isomorphic-layout-effect'
import { useCoarsePointer } from '../common/use-media-query'
import { resolveContainerClass } from '../tokens/size-classes'
import type { ContainerClass } from '../tokens/size-classes'
import type { ResponsiveChartHeight } from './types'

/** Server and first-paint width before the host measures (TanStack `initialWidth`): the regular
 * class, so SSR markup and the first client frame agree. */
export const INITIAL_WIDTH = 640

/** Height = width × ratio, per container class. */
const HEIGHT_RATIO = { micro: 0.5, compact: 0.62, regular: 0.5, wide: 0.4 } as const
const HEIGHT_MIN = 160
const HEIGHT_MAX = 420
/** A coarse pointer never gets a chart taller than this share of the viewport. */
const COARSE_VIEWPORT_SHARE = 0.45

export type ChartSize = { width: number; containerClass: ContainerClass; height: number }

function statedHeight(
  height: number | ResponsiveChartHeight | undefined,
  containerClass: ContainerClass,
): number | undefined {
  if (height === undefined || typeof height === 'number') return height
  if (containerClass === 'wide') return height.wide ?? height.regular ?? height.base
  if (containerClass === 'regular') return height.regular ?? height.base
  return height.base
}

export function resolveChartSize(input: {
  width: number
  height?: number | ResponsiveChartHeight | undefined
  coarse: boolean
  /** Viewport height in px; `0` when unknown (the server). */
  viewportH: number
}): ChartSize {
  const width = input.width > 0 ? input.width : INITIAL_WIDTH
  const containerClass = resolveContainerClass(width)
  const derived =
    statedHeight(input.height, containerClass) ??
    Math.min(Math.max(Math.round(width * HEIGHT_RATIO[containerClass]), HEIGHT_MIN), HEIGHT_MAX)
  // A viewport safety cap, literal heights included: a fixed-height chart cannot overflow a short
  // landscape-phone viewport.
  const height =
    input.coarse && input.viewportH > 0
      ? Math.min(derived, Math.round(input.viewportH * COARSE_VIEWPORT_SHARE))
      : derived
  return { width, containerClass, height }
}

/** Viewport height is quantized, so a collapsing mobile URL bar does not relayout every chart. */
const VIEWPORT_H_STEP = 50
const viewportListeners = new Set<() => void>()
let viewportAttached = false

function subscribeViewport(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  if (!viewportAttached) {
    viewportAttached = true
    window.addEventListener('resize', () => {
      for (const listener of viewportListeners) listener()
    })
  }
  viewportListeners.add(onChange)
  return () => viewportListeners.delete(onChange)
}

const readViewport = (): number =>
  typeof window === 'undefined'
    ? 0
    : Math.round(window.innerHeight / VIEWPORT_H_STEP) * VIEWPORT_H_STEP

/** Measures the element `ref` lands on and resolves its size through {@link resolveChartSize}. */
export function useChartSize(height: number | ResponsiveChartHeight | undefined): {
  ref: RefCallback<HTMLElement>
  size: ChartSize
  coarse: boolean
} {
  const [width, setWidth] = useState(0)
  const [node, setNode] = useState<HTMLElement | null>(null)
  const coarse = useCoarsePointer()
  const viewportH = useSyncExternalStore(subscribeViewport, readViewport, () => 0)
  const last = useRef(0)

  useIsomorphicLayoutEffect(() => {
    if (!node) return
    const read = (w: number): void => {
      const rounded = Math.round(w)
      if (rounded === last.current) return
      last.current = rounded
      setWidth(rounded)
    }
    read(node.getBoundingClientRect().width)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) read(entry.contentRect.width)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])

  const ref = useCallback<RefCallback<HTMLElement>>((el) => setNode(el), [])
  return { ref, size: resolveChartSize({ width, height, coarse, viewportH }), coarse }
}
