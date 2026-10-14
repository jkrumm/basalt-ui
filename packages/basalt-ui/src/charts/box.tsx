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

/** Height = width × ratio, per container class, clamped (`resolveChartSize` mirrors this in px). */
export const HEIGHT_RATIO = { micro: 0.5, compact: 0.62, regular: 0.5, wide: 0.4 } as const
export const HEIGHT_MIN = 160
export const HEIGHT_MAX = 420

const px = (n: number): string => `${n}px`
const law = (ratio: number): string =>
  `clamp(${px(HEIGHT_MIN)}, ${ratio * 100}cqw, ${px(HEIGHT_MAX)})`

/** The four per-class heights, as the custom properties the stylesheet selects between. */
export function chartBoxVars(height: Exclude<ChartBoxHeight, 'fill'>): CSSProperties {
  const [micro, compact, regular, wide] =
    height === undefined
      ? [
          law(HEIGHT_RATIO.micro),
          law(HEIGHT_RATIO.compact),
          law(HEIGHT_RATIO.regular),
          law(HEIGHT_RATIO.wide),
        ]
      : typeof height === 'number'
        ? [px(height), px(height), px(height), px(height)]
        : [
            px(height.base),
            px(height.base),
            px(height.regular ?? height.base),
            px(height.wide ?? height.regular ?? height.base),
          ]
  return {
    '--bc-micro': micro,
    '--bc-compact': compact,
    '--bc-regular': regular,
    '--bc-wide': wide,
  } as CSSProperties
}

export function ChartBox(props: {
  height?: ChartBoxHeight
  className?: string
  children: ReactNode
}): ReactElement {
  const { height, className, children } = props
  const fill = height === 'fill'
  return (
    <div className={classes.frame}>
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
