import { Group } from '@visx/group'
import { Pie } from '@visx/shape'
import { memo, useMemo } from 'react'
import { ChartTooltip, TooltipBody, TooltipRow, useTooltipStyles } from '../primitives/ChartTooltip'
import { useChartTooltip } from '../hooks/useChartTooltip'
import { useVxTheme } from '../theme'
import { VX } from '../../tokens'
import type { SeriesKey } from '../../register'

export type DonutDatum = { key: SeriesKey; value: number }

export type DonutProps = {
  data: DonutDatum[]
  width: number
  height: number
  colorForKey: (key: SeriesKey) => string
  formatValue: (v: number) => string
  seriesLabel?: (key: string) => string
  centerLabel?: string
  centerSubLabel?: string
  innerRatio?: number
  padAngle?: number
}

function DonutInner(props: DonutProps) {
  const {
    data,
    width,
    height,
    colorForKey,
    formatValue,
    seriesLabel = (k) => k,
    centerLabel,
    centerSubLabel,
    innerRatio = 0.6,
    padAngle = 0.01,
  } = props

  const theme = useVxTheme()
  const tooltipStyles = useTooltipStyles()

  const { tip, show, hide, tooltipRef } = useChartTooltip<DonutDatum>()
  const hoveredKey = tip?.data.key ?? null

  const radius = Math.min(width, height) / 2 - 4
  const innerRadius = radius * innerRatio
  const centerX = width / 2
  const centerY = height / 2

  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data])

  return (
    <div style={{ position: 'relative' }}>
      <svg width={width} height={height}>
        <Group left={centerX} top={centerY}>
          <Pie<DonutDatum>
            data={data}
            pieValue={(d) => d.value}
            pieSortValues={() => 0}
            outerRadius={radius}
            innerRadius={innerRadius}
            padAngle={padAngle}
            cornerRadius={2}
          >
            {(pie) =>
              pie.arcs.map((arc) => {
                const key = arc.data.key
                return (
                  <g
                    key={key}
                    onMouseEnter={(event) => {
                      show(arc.data, event)
                    }}
                    onMouseMove={(event) => {
                      show(arc.data, event)
                    }}
                    onMouseLeave={() => {
                      hide()
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <path
                      d={pie.path(arc) || ''}
                      fill={colorForKey(key)}
                      stroke={theme.tooltipBg}
                      strokeWidth={1.5}
                      opacity={hoveredKey === null || hoveredKey === key ? 1 : 0.4}
                    />
                  </g>
                )
              })
            }
          </Pie>

          {centerLabel && (
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              y={centerSubLabel ? -8 : 0}
              fill={theme.tooltipText}
              fontSize={14}
              fontWeight={600}
            >
              {centerLabel}
            </text>
          )}
          {centerSubLabel && (
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              y={centerLabel ? 10 : 0}
              fill={theme.tooltipText}
              fontSize={11}
              opacity={0.75}
            >
              {centerSubLabel}
            </text>
          )}
        </Group>
      </svg>

      <ChartTooltip tip={tip} tooltipRef={tooltipRef} styles={tooltipStyles}>
        {tip && (
          <TooltipBody>
            <TooltipRow
              color={colorForKey(tip.data.key)}
              label={seriesLabel(tip.data.key)}
              value={formatValue(tip.data.value)}
              shape="bar"
            />
            <TooltipRow
              color={VX.grid}
              label="Share"
              value={`${total > 0 ? Math.round((tip.data.value / total) * 100) : 0}%`}
              shape="bar"
            />
          </TooltipBody>
        )}
      </ChartTooltip>
    </div>
  )
}

/**
 * Hand-memoized: React Compiler does not process the shipped dist, so we wrap the
 * hot donut kind in `React.memo` to retain the auto-memoization it had as source.
 */
export const Donut = memo(DonutInner) as typeof DonutInner
