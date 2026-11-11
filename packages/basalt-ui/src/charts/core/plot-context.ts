/**
 * The plot-size loop of `PlotContext` (S4): the first pass reports the frame, the host reads the
 * laid-out plot of every pane off the engine's `onRender` scene ({@link plotSizesOf}) and a
 * definition whose `marks` read the size is recompiled with it. No DOM is read.
 *
 * The read registry stays in `../plot-context`: the 2.x kinds and this core share one host, so they
 * must share one registry. When the 2.x kinds go, that module's body moves here.
 */
import type { ChartScene, SceneNode } from '@tanstack/charts/types/core'
import { MAIN_PANE } from '../plot-context'
import type { PlotSize, PlotSizes } from '../plot-context'

export {
  MAIN_PANE,
  PLOT_EPSILON_PX,
  measuredPlots,
  plotAccess,
  plotContext,
  readsPlot,
  recordPlots,
  samePlot,
  samePlots,
  watchPlotReads,
} from '../plot-context'
export type { PlotAccess, PlotBase, PlotSize, PlotSizes } from '../plot-context'

type Group = Extract<SceneNode, { kind: 'group' }>

const VIEW = 'ts-chart__view'
const isGroup = (node: SceneNode): node is Group => node.kind === 'group'

function find(nodes: readonly SceneNode[], hit: (g: Group) => boolean, out: Group[] = []): Group[] {
  for (const node of nodes) {
    if (!isGroup(node)) continue
    if (hit(node)) out.push(node)
    else find(node.children, hit, out)
  }
  return out
}

/**
 * The laid-out plot of each pane. A single chart is the scene's own `chart` bounds. A composed
 * chart lays its panes out as `ts-chart__view` groups keyed `<owner>:<pane>:view`; each pane's
 * plot is its `<owner>:<pane>:marks` group's clip, which the rung's `clip: true` makes the plot.
 */
export function plotSizesOf(scene: Pick<ChartScene, 'chart' | 'nodes'>): PlotSizes {
  const views = find(scene.nodes, (g) => g.className === VIEW)
  if (views.length === 0) return { [MAIN_PANE]: size(scene.chart.width, scene.chart.height) }
  const sizes: Record<string, PlotSize> = {}
  for (const view of views) {
    const base = view.key.replace(/view$/, '')
    const pane = base.split(':').at(-2)
    const [marks] = find(view.children, (g) => g.key === `${base}marks` && g.clip !== undefined)
    if (!pane || !marks?.clip) continue
    sizes[pane] = size(marks.clip.width, marks.clip.height)
  }
  return sizes
}

const size = (width: number, height: number): PlotSize => ({ width, height })
