import type { ReactElement, ReactNode } from 'react'

/** One entry of `Facts`: the label and its value. */
export type FactRow = {
  label: string
  value: ReactNode
}

export type FactsProps = {
  /** One row per entry, in order; labels are unique within one list. */
  rows: readonly FactRow[]
}

/**
 * A labelled list of facts about one record: a `dl` of `{ label, value }` rows. The columns follow
 * the list's own width, never the viewport: two label-and-value columns from the `regular`
 * container tier, one below it, so the same list reads right in a 360 px aside and in a page column.
 *
 * @useWhen the properties of one record are listed as label and value, such as the body of an inspector in a `PageAside`
 * @neverWhen the values are numbers to compare at a glance (use `StatGroup`) or the rows are records of their own (use `DataTable`)
 *
 * @example
 * <Facts
 *   rows={[
 *     { label: 'Version', value: deploy.version },
 *     { label: 'Duration', value: `${deploy.durationS} s` },
 *   ]}
 * />
 */
export function Facts({ rows }: FactsProps): ReactElement {
  return (
    <div data-slot="facts" className="@container min-w-0">
      <dl className="m-0 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm @regular:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
        {rows.map((row) => (
          <div key={row.label} data-slot="facts-row" className="contents">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="m-0 min-w-0 [overflow-wrap:anywhere] text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
