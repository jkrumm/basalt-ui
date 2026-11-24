import type { ReactElement } from 'react'
import { useFormat } from 'basalt-ui'
import { DataPanel } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { BASALT } from 'basalt-ui/tokens'
import { ScrollArea } from 'basalt-ui/ui/scroll-area'
import { text } from '@tanstack/charts/text'
import { WAIT_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { reasonRows, waitsFor, type ReasonRow } from './fixture'

const ERROR = {
  tag: 'error',
  message: 'The queue log did not answer.',
  retry: () => undefined,
} as const

// cycle-expression-5: the kit lacked a short axis label for a band key, so the axis maps each reason to one word to keep all five at 390.
const SHORT: Record<string, string> = {
  'Owner answer': 'Owner',
  'Another Issue': 'Issue',
  'Host slot': 'Slot',
  'Account quota': 'Quota',
  'Merge window': 'Merge',
}

export function ExprN18Scenario({ shotState, fixture }: ScenarioProps): ReactElement {
  const fmt = useFormat()
  const hours = (h: number): string => fmt.number(h, { maximumFractionDigits: h < 10 ? 1 : 0 })
  const waits = shotState === 'empty' ? [] : waitsFor(fixture)
  const rows = reasonRows(waits)
  const focus = useChartFocus(rows, {
    announce: (r) => `${r.label}: ${hours(r.totalHours)} h over ${r.waits} waits`,
  })

  const total = rows.reduce((sum, r) => sum + r.totalHours, 0)
  const lead = total > 0 ? rows[0] : undefined
  const stillOpen = rows.reduce((sum, r) => sum + r.stillOpen, 0)
  const longest = rows
    .flatMap((r) => (r.longest === null ? [] : [{ ...r.longest, label: r.label }]))
    .sort((a, b) => b.hours - a.hours)[0]
  const share = (r: ReasonRow): string => fmt.percent(total === 0 ? 0 : r.totalHours / total)

  const figure = lead
    ? {
        figure: {
          value: focus.readout(lead.label, (r) => r.label),
          period: focus.readout(
            `${hours(lead.totalHours)} h of ${hours(total)} h`,
            (r) => `${hours(r.totalHours)} h, ${share(r)} of wait hours`,
          ),
        },
      }
    : {}

  const ready = shotState === undefined && waits.length > 0
  const phase = shotState === 'loading' ? 'loading' : shotState === 'error' ? ERROR : 'ready'
  const empty =
    waits.length === 0
      ? {
          cause:
            'No Issue waited this week. Waits appear once an Issue queues for a slot or an answer.',
        }
      : null

  return (
    <Page area="expr-n18">
      <PageBar title="Queue waits, last 7 days" />
      <div className="@container">
        <div className="grid gap-4 @regular:grid-cols-2">
          <ChartCard
            title="Hours waited by reason"
            subtitle={
              waits.length === 0 ? 'last 7 days' : `${waits.length} waits, open ones counted to now`
            }
            phase={phase}
            empty={empty}
            {...figure}
            footer={
              ready
                ? [
                    longest
                      ? {
                          label: 'Longest wait',
                          value: `#${longest.issue}, ${hours(longest.hours)} h`,
                        }
                      : null,
                    { label: 'Still waiting', value: stillOpen },
                  ]
                : [
                    { label: 'Longest wait', value: '–' },
                    { label: 'Still waiting', value: '–' },
                  ]
            }
            chart={() => (
              <CartesianChart
                label="Hours waited this week for each of five reasons, finished and still open"
                data={rows}
                focus={focus}
                x={{ value: (r) => r.label, format: (k) => SHORT[String(k)] ?? String(k) }}
                y={{ title: 'Hours', format: (v) => hours(v) }}
                series={[
                  {
                    mark: 'bar',
                    key: 'done',
                    label: 'Finished',
                    color: WAIT_SERIES.done,
                    y: (r) => r.doneHours,
                  },
                  {
                    mark: 'bar',
                    key: 'open',
                    label: 'Still waiting',
                    color: WAIT_SERIES.open,
                    y: (r) => (r.openHours > 0 ? r.openHours : null),
                  },
                ]}
                marks={CartesianChart.custom<ReasonRow>((plot) => [
                  // cycle-expression-5: the kit lacked a stack-total label on a bar; a text mark over each bar carries the hours.
                  text(plot.data, {
                    x: (r) => r.label,
                    y: (r) => r.totalHours,
                    text: (r) => `${hours(r.totalHours)} h`,
                    dy: -8,
                    anchor: 'middle',
                    fill: BASALT.ink,
                    fontSize: BASALT.text.micro,
                  }),
                ])}
              />
            )}
          />
          <DataPanel
            title="What each reason waited on"
            phase={phase}
            empty={waits.length === 0 ? { cause: 'Nothing to rank yet.' } : null}
            bodySize={{ rows: 7 }}
            body={() => (
              <ScrollArea
                aria-label="Wait reasons"
                className="max-h-96"
                onPointerLeave={focus.target.onPointerLeave}
              >
                {rows.map((r, i) => (
                  <div
                    key={r.reason}
                    {...focus.item(i)}
                    className="flex min-w-0 flex-col px-3 py-2 text-sm data-focused:bg-selected"
                  >
                    <span className="truncate">{r.label}</span>
                    <span className="truncate font-mono text-xs tabular-nums text-muted-foreground">
                      {r.waits === 0
                        ? 'no waits'
                        : `${r.waits} waits, ${r.stillOpen} open, longest #${r.longest?.issue} ${hours(r.longest?.hours ?? 0)} h`}
                    </span>
                  </div>
                ))}
              </ScrollArea>
            )}
          />
        </div>
      </div>
    </Page>
  )
}
