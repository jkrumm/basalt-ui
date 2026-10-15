/**
 * The one place a `PlotContext` is built (`docs/V2-SPEC.md` § 9.2) and the plot-size feedback loop
 * around it. The engine lays a plot out AFTER `marks` runs, so `plotWidth`/`plotHeight` cannot be
 * known when `marks(plot)` is called: the first pass reports the frame, the host measures the laid-out
 * plot per pane and hands it back, and a definition that READ the size is recompiled with it.
 * `compileCartesian` and every composed kind (`panelDefinition`) build their context here, so all
 * of them report the plot area the same way.
 */
import type { ChartX, PlotContext } from './types'

/** A plot area in px. */
export type PlotSize = { width: number; height: number }

/** The laid-out plot area of every pane, by pane id. A single chart is one pane, {@link MAIN_PANE}. */
export type PlotSizes = Readonly<Record<string, PlotSize>>

export const MAIN_PANE = 'main'

/** Two measurements closer than this are the same plot: layout jitter must not trigger a recompile. */
export const PLOT_EPSILON_PX = 0.01

export const samePlot = (a: PlotSize, b: PlotSize): boolean =>
  Math.abs(a.width - b.width) < PLOT_EPSILON_PX && Math.abs(a.height - b.height) < PLOT_EPSILON_PX

export function samePlots(a: PlotSizes | null, b: PlotSizes): boolean {
  if (a === null) return false
  const keys = Object.keys(b)
  return (
    keys.length === Object.keys(a).length &&
    keys.every((k) => {
      const prev = a[k]
      const next = b[k]
      return prev !== undefined && next !== undefined && samePlot(prev, next)
    })
  )
}

/** Per definition: did any `marks` read the plot size, and who to tell when that read comes late. */
type PlotReads = {
  read: boolean
  onLateRead: (() => void) | undefined
  measured: PlotSizes | null
}
const READS = new WeakMap<object, PlotReads>()
const readsOf = (definition: object): PlotReads => {
  const found = READS.get(definition)
  if (found) return found
  const created: PlotReads = { read: false, onLateRead: undefined, measured: null }
  READS.set(definition, created)
  return created
}

/** Whether `marks` read `plotWidth`/`plotHeight` while building this definition: only such a chart
 * recompiles on the measured plot. A read is registered when the getter runs, so a branch-only read,
 * a destructure and a lazy channel accessor all count. */
export const readsPlot = (definition: object): boolean => READS.get(definition)?.read === true

/** The host's hook for a read that happens AFTER it measured (an accessor the engine calls later):
 * it fires once, on the first read, so the host can report what it already measured. */
export function watchPlotReads(definition: object, onLateRead: (() => void) | undefined): void {
  readsOf(definition).onLateRead = onLateRead
}

/** The host records what it measured for a definition, so a late read can be answered at once. */
export const recordPlots = (definition: object, sizes: PlotSizes): void => {
  readsOf(definition).measured = sizes
}
export const measuredPlots = (definition: object): PlotSizes | null =>
  READS.get(definition)?.measured ?? null

/** What a pane's `PlotContext` reads its plot size through: the measurement and the read hook. */
export type PlotAccess = { size: () => PlotSize | null; read: () => void }

export function plotAccess(
  definition: object,
  sizes: PlotSizes | null | undefined,
  pane: string,
): PlotAccess {
  return {
    size: () => sizes?.[pane] ?? null,
    read: () => {
      const reads = readsOf(definition)
      if (reads.read) return
      reads.read = true
      reads.onLateRead?.()
    },
  }
}

export type PlotBase<T, X extends ChartX> = Omit<PlotContext<T, X>, 'plotWidth' | 'plotHeight'>

/** A `PlotContext`: `base` plus `plotWidth`/`plotHeight` as read-registering getters, the frame
 * (`base.width`/`height`) until the pane has been measured. */
export function plotContext<T, X extends ChartX>(
  base: PlotBase<T, X>,
  access: PlotAccess,
): PlotContext<T, X> {
  const measured = (side: keyof PlotSize): number => {
    access.read()
    return access.size()?.[side] ?? (side === 'width' ? base.width : base.height)
  }
  return Object.defineProperties(
    { ...base },
    {
      plotWidth: { enumerable: true, get: () => measured('width') },
      plotHeight: { enumerable: true, get: () => measured('height') },
    },
  ) as PlotContext<T, X>
}
