/**
 * The rich tooltip body: the engine's title and rows, each series row with its change over the period,
 * its status and, under it, its muted reference reading. Every field is the row's data
 * (`core/rich-tooltip.ts`); this module only lays it out. The host passes it to the engine's body seam
 * for a definition `compileCartesian` marked rich, so every other chart keeps the engine's own body.
 */
import type { ChartTooltipContent } from '@tanstack/charts/types/core'
import type { ReactElement } from 'react'
import type { RichRow } from './core/rich-tooltip'
import { CV, CV_STATUS } from './core/theme'
import type { Tone } from '../core/ports'

/** A status dot's fill: the tone's status color; `info` and `accent` take the brand. */
const toneFill = (tone: Tone): string =>
  tone === 'info' || tone === 'accent' ? CV.brand : CV_STATUS[tone]

/** The engine's own swatch box, so a rich row's swatch matches a plain one. */
const SWATCH = {
  display: 'block',
  width: '0.55rem',
  height: '0.55rem',
  borderRadius: '0.15rem',
} as const

const ARROW = { up: '\u25B2', down: '\u25BC', flat: '\u2013' } as const

function Swatch({ color }: { color: string | undefined }): ReactElement {
  return color === undefined ? (
    <span />
  ) : (
    <span
      className="ts-chart-tooltip__swatch"
      aria-hidden="true"
      style={{ ...SWATCH, background: color }}
    />
  )
}

function Row({ row }: { row: RichRow }): ReactElement {
  const { change, reference, status } = row.detail ?? {}
  return (
    <div className="ts-chart-tooltip__row basalt-tip-row" data-active={String(row.active === true)}>
      <Swatch color={row.color} />
      <span>{row.label}</span>
      <span className="basalt-tip-value">{row.value}</span>
      <span className="basalt-tip-change" data-direction={change?.direction}>
        {change === undefined ? null : `${ARROW[change.direction]} ${change.text}`}
      </span>
      {status === undefined ? null : (
        <span className="basalt-tip-status">
          <span
            className="basalt-tip-status-dot"
            aria-hidden="true"
            style={{ background: toneFill(status.tone) }}
          />
          {status.label}
        </span>
      )}
      {reference === undefined ? null : <span className="basalt-tip-ref">{reference}</span>}
    </div>
  )
}

/**
 * The body of a rich tooltip: the title, then a row per entry of `content.rows`. A custom body drops
 * the engine's shell styles, so `.basalt-tip` draws the same surface from the same variables.
 */
export function RichTooltipBody({
  content,
}: {
  content: ChartTooltipContent | string
}): ReactElement | string {
  if (typeof content === 'string') return content
  const rows = content.rows as readonly RichRow[]
  return (
    <div className="basalt-tip">
      {content.title ? (
        <div className="ts-chart-tooltip__title basalt-tip-title">{content.title}</div>
      ) : null}
      {rows.length > 0 ? (
        <div className="ts-chart-tooltip__rows basalt-tip-rows" aria-hidden="true">
          {rows.map((row, i) => (
            <Row key={`${row.label}\u0000${i}`} row={row} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
