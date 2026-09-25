import { createContext, useContext, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import type { ContainerClass } from '../../tokens/size-classes'
import { chartTierMetrics, resolveChartTier, tierOfContainerClass } from './chart-frame-layout'
import type { ChartTier, ChartTierMetrics } from './chart-frame-layout'

/**
 * Ambient container class. `ChartFrame` publishes the class it resolved (`resolveChartLayout`:
 * its own MEASURED width, or the viewport-implied class before the first measurement); the axes,
 * the legend, the crosshair dots and the tooltip read their metrics back without every kind
 * threading a prop it does not otherwise care about.
 *
 * Default `'regular'` (desktop metrics), so a primitive rendered outside a `ChartFrame` (a
 * hand-composed plot, a `TooltipRow` in a consumer's own tooltip) keeps today's sizes.
 */
const ChartContainerClassContext = createContext<ContainerClass>('regular')

export type ChartTierProviderProps = {
  containerClass: ContainerClass
  children: ReactNode
}

/** Publishes a resolved container class to the subtree. Mounted once, by `ChartFrame`. */
export function ChartTierProvider({ containerClass, children }: ChartTierProviderProps): ReactNode {
  return (
    <ChartContainerClassContext.Provider value={containerClass}>
      {children}
    </ChartContainerClassContext.Provider>
  )
}

/** @deprecated Removed in 1.31.0 — the container class replaces the tier (`'phone'` = `micro`/`compact`). */
export function useChartTier(): ChartTier {
  return tierOfContainerClass(useContext(ChartContainerClassContext))
}

/** The resolved sizes for the ambient container class — what every primitive actually wants. */
export function useChartTierMetrics(): ChartTierMetrics {
  return chartTierMetrics(useChartTier())
}

const subscribeNothing = (): (() => void) => () => {}

function subscribeCoarse(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const list = window.matchMedia('(pointer: coarse)')
  list.addEventListener('change', onChange)
  return () => list.removeEventListener('change', onChange)
}

function readCoarse(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(pointer: coarse)').matches
}

/** Whether the primary pointer is coarse. Server snapshot `false`: hydration agrees, then updates. */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribeCoarse, readCoarse, () => false)
}

/** Viewport height is quantized so a mobile URL bar collapsing does not re-lay-out every chart. */
const VIEWPORT_H_STEP = 50

function subscribeViewportH(onChange: () => void): () => void {
  if (typeof window === 'undefined') return subscribeNothing()
  window.addEventListener('resize', onChange)
  return () => window.removeEventListener('resize', onChange)
}

function readViewportH(): number {
  if (typeof window === 'undefined') return 0
  return Math.round(window.innerHeight / VIEWPORT_H_STEP) * VIEWPORT_H_STEP
}

/** Viewport height in px (`0` on the server). Only the coarse-pointer height clamp reads it. */
export function useViewportHeight(): number {
  return useSyncExternalStore(subscribeViewportH, readViewportH, () => 0)
}

export { chartTierMetrics, resolveChartTier }
export type { ChartTier, ChartTierMetrics }
