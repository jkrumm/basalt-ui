import { scaleLinear } from '@visx/scale'
import { useMemo } from 'react'
import { VX } from '../../tokens'

type BarSparklineProps = {
  data: number[]
  width: number
  height: number
  color?: string
  /** Accessible text alternative, applied as `aria-label` (+ `role="img"`) on the `<svg>`. */
  ariaLabel?: string
}

/** Quiet inline bar trend — defaults to `VX.faint`, matching the sparkline family's restrained
 * identity (docs/DESIGN-SPEC.md §5). */
export function BarSparkline({ data, width, height, color, ariaLabel }: BarSparklineProps) {
  const fillColor = color ?? VX.faint
  const a11yProps = ariaLabel !== undefined ? { role: 'img' as const, 'aria-label': ariaLabel } : {}

  const yScale = useMemo(() => {
    const max = Math.max(...data.filter((v) => isFinite(v)), 1)
    return scaleLinear<number>({ domain: [0, max], range: [0, height] })
  }, [data, height])

  if (!data.length) return <svg width={width} height={height} {...a11yProps} />

  const step = width / data.length
  const barWidth = Math.max(step - 1, 1)

  return (
    <svg width={width} height={height} {...a11yProps}>
      {data.map((v, i) => {
        const bh = Math.max(yScale(Math.max(v, 0)), 0)
        return (
          <rect
            key={i}
            x={i * step}
            y={height - bh}
            width={barWidth}
            height={bh}
            fill={fillColor}
            fillOpacity={0.75}
          />
        )
      })}
    </svg>
  )
}
