import { scaleLinear } from '@visx/scale'
import { useMemo } from 'react'
import type { BasaltProps } from '../../common/props'
import { VX } from '../../tokens'

export type BarSparklineProps = BasaltProps & {
  data: number[]
  width: number
  height: number
  color?: string
  /**
   * Gap between two bars, in px. `1` is the shipped look; `2` at ~10 bars reads as a discrete series
   * rather than a histogram, which is the KPI-card treatment.
   *
   * @default 1
   */
  barGap?: number
  /**
   * Bar corner radius, in px. `0` is the shipped look.
   *
   * @default 0
   */
  barRadius?: number
  /**
   * Paints the LAST bar in `emphasisColor` at full opacity — "this is where the series ends", the
   * one reading a trend beside a KPI value is actually for. Off by default: a chart that means
   * something by its final point must say so.
   *
   * @default false
   */
  emphasizeLast?: boolean
  /** The emphasised bar's fill. @default `VX.accent` */
  emphasisColor?: string
  /** Accessible text alternative, applied as `aria-label` (+ `role="img"`) on the `<svg>`. */
  ariaLabel?: string
}

/** Quiet inline bar trend — defaults to `VX.faint`, matching the sparkline family's restrained
 * identity (docs/DESIGN-SPEC.md §5). Every geometry option below defaults to the shipped look, so
 * an existing call site renders byte-identically. */
export function BarSparkline({
  data,
  width,
  height,
  color,
  barGap = 1,
  barRadius = 0,
  emphasizeLast = false,
  emphasisColor,
  ariaLabel,
  className,
  style,
}: BarSparklineProps) {
  const fillColor = color ?? VX.faint
  const lastColor = emphasisColor ?? VX.accent
  const a11yProps = ariaLabel !== undefined ? { role: 'img' as const, 'aria-label': ariaLabel } : {}

  const yScale = useMemo(() => {
    const max = Math.max(...data.filter((v) => isFinite(v)), 1)
    return scaleLinear<number>({ domain: [0, max], range: [0, height] })
  }, [data, height])

  const rootProps = {
    ...(className !== undefined && { className }),
    ...(style !== undefined && { style }),
  }

  if (!data.length) return <svg width={width} height={height} {...rootProps} {...a11yProps} />

  const step = width / data.length
  const barWidth = Math.max(step - barGap, 1)
  const lastIndex = data.length - 1

  return (
    <svg width={width} height={height} {...rootProps} {...a11yProps}>
      {data.map((v, i) => {
        const bh = Math.max(yScale(Math.max(v, 0)), 0)
        const isLast = emphasizeLast && i === lastIndex
        return (
          <rect
            key={i}
            x={i * step}
            y={height - bh}
            width={barWidth}
            height={bh}
            {...(barRadius > 0 && { rx: barRadius })}
            fill={isLast ? lastColor : fillColor}
            fillOpacity={isLast ? 1 : 0.75}
          />
        )
      })}
    </svg>
  )
}
