import { curveMonotoneX } from '@visx/curve'
import { Group } from '@visx/group'
import { scaleLinear } from '@visx/scale'
import { LinePath } from '@visx/shape'
import { useMemo } from 'react'
import { VX } from '../../tokens'

type LineSparklineProps = {
  data: number[]
  width: number
  height: number
  color?: string
  /** Accessible text alternative, applied as `aria-label` (+ `role="img"`) on the `<svg>`. */
  ariaLabel?: string
}

/**
 * Quiet single-hue trend line (docs/DESIGN-SPEC.md §5: "single 1.6px faint line, no fill, no
 * axes, no dots"). Sparklines default to `VX.faint`, not the bolder `VX.line` used by full charts.
 */
export function LineSparkline({ data, width, height, color, ariaLabel }: LineSparklineProps) {
  const strokeColor = color ?? VX.faint
  const a11yProps = ariaLabel !== undefined ? { role: 'img' as const, 'aria-label': ariaLabel } : {}

  const xScale = useMemo(
    () => scaleLinear<number>({ domain: [0, Math.max(data.length - 1, 1)], range: [0, width] }),
    [data.length, width],
  )

  const yScale = useMemo(() => {
    const vals = data.filter((v) => isFinite(v))
    if (!vals.length) return scaleLinear<number>({ domain: [0, 1], range: [height, 0] })
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const pad = (max - min) * 0.1 || 1
    return scaleLinear<number>({ domain: [min - pad, max + pad], range: [height, 0] })
  }, [data, height])

  if (data.length < 2) return <svg width={width} height={height} {...a11yProps} />

  const indexed = data.map((v, i) => ({ v, i }))

  return (
    <svg width={width} height={height} {...a11yProps}>
      <Group>
        <LinePath<{ v: number; i: number }>
          data={indexed}
          x={(d) => xScale(d.i)}
          y={(d) => yScale(d.v)}
          stroke={strokeColor}
          strokeWidth={1.6}
          curve={curveMonotoneX}
        />
      </Group>
    </svg>
  )
}
