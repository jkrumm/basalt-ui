import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { BLOCK_FRAME, BlockHead } from './blocks'
import { Glyph } from './glyphs'
import type { Slot } from './types'

/** One compared product or option: a column of the table. `ours` marks the column the page is about. */
export type SiteComparisonColumn = {
  key: string
  label: string
  ours?: boolean
}

/** One cell: `true` and `false` draw a mark with the `yesLabel` or `noLabel` for a screen reader; a string is shown as written. */
export type SiteComparisonCell = boolean | string

/** One compared trait: a row, with a cell per column key. A missing key is an empty cell. */
export type SiteComparisonRow = {
  label: string
  values: Readonly<Record<string, SiteComparisonCell>>
}

export type SiteComparisonProps = {
  /** The section's `h2`. */
  title?: Slot
  description?: Slot
  /** The table's accessible name ("basalt-ui compared with …"); read by a screen reader, not shown. */
  caption: string
  /** The header of the row-label column ("Feature"). */
  rowHeader: string
  columns: readonly SiteComparisonColumn[]
  rows: readonly SiteComparisonRow[]
  /** What a `true` cell announces ("Yes"). */
  yesLabel: string
  /** What a `false` cell announces ("No"). */
  noLabel: string
  /** Under the table: the sources and the date they were checked, as your own markup (a `<time>` in it). */
  footnote?: Slot
  className?: string
}

/**
 * The tint band of the column the page is about: an ink wash that lifts it off the card in both
 * schemes (the inset fill sinks below the card in dark), with its text at full contrast.
 */
const ours = (column: SiteComparisonColumn): string | false =>
  column.ours === true && 'bg-selected text-foreground'

function Cell({
  value,
  yesLabel,
  noLabel,
}: {
  value: SiteComparisonCell | undefined
  yesLabel: string
  noLabel: string
}): ReactElement | null {
  if (value === undefined) return null
  if (typeof value === 'string') return <>{value}</>
  return (
    <span className={cn('inline-flex', value ? 'text-foreground' : 'text-faint')}>
      <Glyph name={value ? 'check' : 'dash'} />
      <span className="sr-only">{value ? yesLabel : noLabel}</span>
    </span>
  )
}

/**
 * A comparison table for a versus page: compared options as columns, traits as rows, a mark or a
 * short text per cell, and a footnote slot for the dated sources. The row labels are row headers and
 * stay pinned at the start edge while a narrow screen scrolls the columns.
 *
 * @useWhen a page weighs a product against its alternatives, trait by trait, with sources
 * @neverWhen the rows are records a reader sorts or filters (use `DataTable`)
 *
 * @example
 * <SiteComparison
 *   caption="Planning poker tools compared"
 *   rowHeader="Feature"
 *   yesLabel="Yes"
 *   noLabel="No"
 *   columns={[{ key: 'fpp', label: 'FPP', ours: true }, { key: 'other', label: 'Other' }]}
 *   rows={[{ label: 'Free', values: { fpp: true, other: false } }]}
 *   footnote={<>Checked <time datetime="2026-11-20">20 Nov 2026</time> on each vendor's pricing page.</>}
 * />
 */
export function SiteComparison({
  title,
  description,
  caption,
  rowHeader,
  columns,
  rows,
  yesLabel,
  noLabel,
  footnote,
  className,
}: SiteComparisonProps): ReactElement {
  return (
    <section data-slot="site-comparison" className={cn('@container', className)}>
      <div className={cn(BLOCK_FRAME, 'flex flex-col gap-8 py-12 @[64rem]:py-16')}>
        <BlockHead title={title} description={description} />
        <div className="flex min-w-0 flex-col gap-3">
          <section
            aria-label={caption}
            // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrolling region must be keyboard reachable (axe scrollable-region-focusable)
            tabIndex={0}
            className="focus-ring relative min-w-0 overflow-x-auto rounded-card border border-border bg-card"
          >
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{caption}</caption>
              <thead>
                <tr className="border-b border-border">
                  <th
                    scope="col"
                    className="sticky start-0 bg-card px-4 py-3 text-start font-mono text-micro font-normal tracking-wider text-faint uppercase"
                  >
                    {rowHeader}
                  </th>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className={cn(
                        'px-4 py-3 text-center font-head text-sm font-semibold whitespace-nowrap text-foreground',
                        ours(column),
                      )}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-b border-border last:border-b-0">
                    <th
                      scope="row"
                      className="sticky start-0 min-w-36 bg-card px-4 py-3 text-start font-normal text-foreground"
                    >
                      {row.label}
                    </th>
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          'min-w-28 px-4 py-3 text-center text-muted-foreground',
                          ours(column),
                        )}
                      >
                        <Cell
                          value={row.values[column.key]}
                          yesLabel={yesLabel}
                          noLabel={noLabel}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          {footnote !== undefined && <p className="text-xs text-muted-foreground">{footnote}</p>}
        </div>
      </div>
    </section>
  )
}
