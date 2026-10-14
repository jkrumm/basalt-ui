/**
 * The CSS-owned chart box (`chart-box.module.css`): the single element whose height the page lays
 * out around. A chart, its pending placeholder and a `ChartCard` fallback all render inside one, so a
 * `<Suspense>` fallback occupies exactly the box the chart will. Knows no engine, no legend, no card.
 */
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { cx } from '../common/props'
import classes from './chart-box.module.css'
import type { ResponsiveChartHeight } from './types'

/** `undefined` is the height law; a number is fixed; `'fill'` is the parent's height. */
export type ChartBoxHeight = number | ResponsiveChartHeight | 'fill' | undefined

/** Height = width × ratio, per container class, clamped to {@link HEIGHT_MIN}–{@link HEIGHT_MAX}. */
export const HEIGHT_RATIO = { micro: 0.5, compact: 0.62, regular: 0.5, wide: 0.4 } as const
export const HEIGHT_MIN = 160
export const HEIGHT_MAX = 420

/**
 * A stated height at or under this makes the enclosing `ChartCard` render its short header (the
 * subtitle folds, the KPI numeral drops to `lg`, the top inset trims): the card is then under
 * ~280 px once the header's own ~100 px is added. Written onto the box as `data-basalt-chart-short`,
 * from the prop, so the server HTML already says it and CSS (`:has`) applies it — no height
 * measurement, nothing to flip after hydration.
 */
export const SHORT_CHART_HEIGHT = 180

const statedMax = (height: ChartBoxHeight): number | undefined => {
  if (typeof height === 'number') return height
  if (typeof height !== 'object') return undefined
  return Math.max(height.base, height.regular ?? 0, height.wide ?? 0)
}

const px = (n: number): string => `${n}px`
const law = (ratio: number): string =>
  `clamp(${px(HEIGHT_MIN)}, ${ratio * 100}cqw, ${px(HEIGHT_MAX)})`

/** The four custom properties the stylesheet selects between by the frame's container class. */
export type ChartBoxVars = CSSProperties &
  Record<'--bc-micro' | '--bc-compact' | '--bc-regular' | '--bc-wide', string>

/** The four per-class heights (micro, compact, regular, wide) a height prop resolves to. */
function classHeights(height: Exclude<ChartBoxHeight, 'fill'>): [string, string, string, string] {
  if (height === undefined) {
    return [
      law(HEIGHT_RATIO.micro),
      law(HEIGHT_RATIO.compact),
      law(HEIGHT_RATIO.regular),
      law(HEIGHT_RATIO.wide),
    ]
  }
  if (typeof height === 'number') return [px(height), px(height), px(height), px(height)]
  const regular = height.regular ?? height.base
  return [px(height.base), px(height.base), px(regular), px(height.wide ?? regular)]
}

export function chartBoxVars(height: Exclude<ChartBoxHeight, 'fill'>): ChartBoxVars {
  const [micro, compact, regular, wide] = classHeights(height)
  return {
    '--bc-micro': micro,
    '--bc-compact': compact,
    '--bc-regular': regular,
    '--bc-wide': wide,
  }
}

/** `data-basalt-chart-short`: a stated height at or under {@link SHORT_CHART_HEIGHT}. */
export const isShortChart = (height: ChartBoxHeight): boolean =>
  (statedMax(height) ?? Number.POSITIVE_INFINITY) <= SHORT_CHART_HEIGHT

export function ChartBox(props: {
  height?: ChartBoxHeight
  className?: string
  children: ReactNode
}): ReactElement {
  const { height, className, children } = props
  const fill = height === 'fill'
  return (
    // `data-basalt-box` is the hook `ChartCard` uses to tell a chart body from a measured one; a
    // fill box states no height of its own, so it reads `fill` and the card still measures.
    <div
      className={cx(classes.frame, fill && classes.fillFrame)}
      data-basalt-box={fill ? 'fill' : ''}
      {...(isShortChart(height) && { 'data-basalt-chart-short': '' })}
    >
      <div
        className={cx(classes.box, fill && classes.fill, className)}
        {...(!fill && { style: chartBoxVars(height) })}
      >
        {children}
      </div>
    </div>
  )
}

export const stateClass = classes.state
