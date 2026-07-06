import { curveMonotoneX } from '@visx/curve'
import { Group } from '@visx/group'
import { scaleLinear } from '@visx/scale'
import { LinePath } from '@visx/shape'
import { useMemo } from 'react'
import { useVxTheme } from '../theme'

type LineSparklineProps = {
  data: number[]
  width: number
  height: number
  color?: string
  /** Accessible text alternative, applied as `aria-label` (+ `role="img"`) on the `<svg>`. */
  ariaLabel?: string
}

export function LineSparkline({ data, width, height, color, ariaLabel }: LineSparklineProps) {
  const { line } = useVxTheme()
  const strokeColor = color ?? line
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
  const last = indexed[indexed.length - 1]

  return (
    <svg width={width} height={height} {...a11yProps}>
      <Group>
        <LinePath<{ v: number; i: number }>
          data={indexed}
          x={(d) => xScale(d.i)}
          y={(d) => yScale(d.v)}
          stroke={strokeColor}
          strokeWidth={1.5}
          curve={curveMonotoneX}
        />
        {last !== undefined && (
          <circle cx={xScale(last.i)} cy={yScale(last.v)} r={2.5} fill={strokeColor} />
        )}
      </Group>
    </svg>
  )
}
