import { DataPanel } from 'basalt-ui/cards'
import type { Empty, Phase } from 'basalt-ui/cards'
import type { ChartFocus } from 'basalt-ui/charts'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import { Meter } from 'basalt-ui/ui/meter'
import type { Data, Reason } from './fixture'
import { REASON_COUNT, signed } from './summary'

const c = col<Reason>()

const meterTone = (r: Reason, riserId: string | undefined): 'accent' | 'good' | 'neutral' =>
  r.change < 0 ? 'good' : r.id === riserId ? 'accent' : 'neutral'

/** A rise beyond this fills the bar; the number keeps the true change. */
const RISE_CAP = 30

/** The twelve friction reasons, the biggest rise first; a row joins the page's reason focus by id. */
export function FrictionPanel({
  data,
  phase,
  focus,
}: {
  data: Data | undefined
  phase: Phase
  focus: ChartFocus<Reason>
}) {
  const biggest = Math.max(1, ...(data?.reasons.map((r) => Math.abs(r.change)) ?? []))
  const rise = Math.min(RISE_CAP, biggest)
  const table = useDataTable({
    id: 'friction',
    label: 'Rows by change',
    columns: [
      c.entity('name', {
        header: 'Reason',
        priority: 1,
        sub: (r) => (r.isNew ? 'New' : undefined),
      }),
      // cycle-expression-14: no table kind draws a signed bar, so the Change cell is a Meter of the size of the change beside its number; a fall takes the good tint.
      c.custom('change', {
        header: 'Change',
        priority: 1,
        card: 'value',
        width: 11,
        sortValue: (r) => r.change,
        render: (r) => (
          <span className="flex items-center gap-2">
            <Meter
              label={`${r.name} change`}
              value={Math.abs(r.change)}
              max={rise}
              tone={meterTone(r, data?.reasons[0]?.id)}
              format={() => ''}
              className="w-12"
            />
            <span className="tabular-nums">{signed(r.change)}</span>
          </span>
        ),
      }),
      // cycle-expression-14: two number columns plus the Change cell leave the headers clipped beside their sort controls, so both counts share one column.
      c.custom('counts', {
        header: 'Count',
        priority: 1,
        card: 'meta',
        width: 10,
        sortValue: (r) => r.now,
        render: (r) => <span className="tabular-nums">{`${r.prev} \u2192 ${r.now}`}</span>,
      }),
    ],
    data: data?.reasons,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase,
    bodyRows: REASON_COUNT,
  })
  const empty: Empty | null =
    data?.reasons.length === 0
      ? {
          cause:
            'No agent has logged friction yet. Reasons are listed when a run reports it was blocked.',
        }
      : null
  return (
    <DataPanel
      title="Friction reasons"
      subtitle="Reports, biggest rise first"
      phase={phase}
      empty={empty}
      bodySize={{ rows: REASON_COUNT + 1 }}
      body={() => <DataTable table={table} focus={focus} height="fill" />}
    />
  )
}
