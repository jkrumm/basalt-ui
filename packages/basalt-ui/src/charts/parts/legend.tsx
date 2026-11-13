/**
 * The v3 legend: entries as data (`LegendEntry`), drawn by the chart so it is in the server HTML. A
 * failed entry keeps its swatch and name and reads `charts.unavailable`; it draws nothing in the
 * plot (that is the series', see `toEngineSeries`) and never moves the phase off ready.
 *
 * The row itself (container-class swatches, wrapping, toggles, hit areas) is the one the engine
 * kinds already draw (`../legend`); this module is its v3 input and its one string.
 */
import type { ReactElement } from 'react'
import { charts } from '../../core/messages/charts'
import { useMessages } from '../../core/messages/use-messages'
import type { LegendEntry } from '../contract'
import { ChartLegend } from '../legend'
import type { ChartSeries } from '../types'
import { cssColor } from './cartesian-adapt'

const none = (): void => {}
const empty: ReadonlySet<string> = new Set()

export type LegendProps = {
  entries: readonly LegendEntry[]
  /** Keys the viewer toggled off. */
  hidden?: ReadonlySet<string>
  /** Entries become buttons that call this with their key. Omitted, they are inert labels. */
  onToggle?: (key: string) => void
  onHighlight?: (key: string | null) => void
  /** Keeps the box and shows nothing: a chart with no marks names no series. */
  concealed?: boolean
}

/** A legend entry as the flat series the row reads: legend-only, so its value is always absent. */
function asSeries(entry: LegendEntry, unavailable: string): ChartSeries<never> {
  return {
    key: entry.key,
    label: entry.label,
    color: cssColor(entry.color),
    getValue: () => null,
    mark: entry.swatch === 'dot' || entry.swatch === 'ring' ? entry.swatch : 'line',
    ...(entry.swatch === 'dashed' && { dash: 'dashed' as const }),
    ...(entry.failed === true && { note: unavailable }),
  }
}

/**
 * The legend row of a chart or a data panel.
 *
 * @useWhen a chart or panel names its series and must read the same in the server HTML
 * @neverWhen a fake series would be added only to get an entry (pass an entry instead)
 *
 * @example
 * <Legend entries={[{ key: 'p95', label: 'p95', color: SERIES.p95, failed: true }]} />
 */
export function Legend({
  entries,
  hidden = empty,
  onToggle,
  onHighlight = none,
  concealed = false,
}: LegendProps): ReactElement | null {
  const t = useMessages(charts)
  const series = entries.map((e) => asSeries(e, t('charts.unavailable')))
  return (
    <ChartLegend
      series={series}
      hidden={hidden}
      mode="auto"
      groups={false}
      toggle={onToggle !== undefined}
      onToggle={onToggle ?? none}
      onHighlight={onHighlight}
      concealed={concealed}
    />
  )
}
