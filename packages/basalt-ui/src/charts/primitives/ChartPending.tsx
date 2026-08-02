import type { CSSProperties, ReactNode } from 'react'
import { VX } from '../../tokens'

export type ChartCenterProps = {
  width: number
  height: number
  children: ReactNode
}

const centerStyle = (width: number, height: number): CSSProperties => ({
  width,
  height,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
})

/**
 * Minimal layout primitive: centers `children` inside a `width` × `height` box. Exists because
 * `src/charts/**` cannot import Mantine's `Flex`/`Group`/`Center` (the Mantine-free boundary), so
 * there was previously nothing to reach for when a chart file needed to center something. Not a
 * general layout system — width, height, children, nothing else.
 */
export function ChartCenter({ width, height, children }: ChartCenterProps): ReactNode {
  return <div style={centerStyle(width, height)}>{children}</div>
}

export type ChartPendingProps = {
  width: number
  height: number
  /** Default `'Loading…'`. */
  label?: string
}

const labelStyle: CSSProperties = {
  color: VX.faint,
  fontSize: VX.text.sm,
}

/**
 * The placeholder for a chart whose data hasn't arrived yet — the third "nothing to draw" state
 * alongside measured-and-empty and measured-and-absent (a real gap in coverage). Collapsing an
 * in-flight query into either of those (the `data ?? []` idiom) densifies it into a fully-hatched
 * "not measured" window: a positive claim that the series WAS watched and carried nothing, when in
 * fact it was never asked. `ChartPending` makes "not asked yet" its own rendered state instead of
 * borrowing one of the other two.
 *
 * Reserves exactly the plot's footprint and draws NOTHING that could be mistaken for a
 * measurement — no axes, no gridlines, no hatching, no data marks — just a faint, static, centered
 * label. No animation: the package's motion doctrine bans looping/pulsing idle motion, so a static
 * reserved box is the correct answer here, not a compromise.
 */
export function ChartPending({ width, height, label = 'Loading…' }: ChartPendingProps): ReactNode {
  return (
    <ChartCenter width={width} height={height}>
      <span style={labelStyle}>{label}</span>
    </ChartCenter>
  )
}
