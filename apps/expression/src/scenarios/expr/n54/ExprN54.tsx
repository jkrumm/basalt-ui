import { useFormat } from 'basalt-ui'
import { BarList } from 'basalt-ui/cards'
import type { Delta, Empty, Fact, Phase, Verdict } from 'basalt-ui/cards'
import { ChartCard, Heatmap, useChartFocus } from 'basalt-ui/charts'
import { CardGrid, Page, PageBar } from 'basalt-ui/page'
import { BASALT } from 'basalt-ui/tokens'
import { INBOX_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { DAY_MS, SURGE_DAY, WEEK_START, WINDOW_END, WINDOW_START, messagesNamed } from './fixture'
import { ageDays, dayKey, summarize } from './summary'
import type { Cell, Row, Summary } from './summary'

const noop = (): void => undefined
const MESSAGES = messagesNamed(undefined)
const SERIES = [
  { key: 'tagged', label: 'Tagged', color: INBOX_SERIES.tagged },
  { key: 'untagged', label: 'Untagged', color: INBOX_SERIES.untagged },
] as const
const EMPTY_CAUSE: Empty = {
  cause: 'No mail arrived in 14 days. New messages appear here as they land.',
}
const TICK_DAYS = [WINDOW_START, WEEK_START, SURGE_DAY, WINDOW_END - DAY_MS].map(dayKey)

const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `\u2212${Math.abs(n)}` : '0')

type View = {
  value: number | null
  period: string
  delta: Delta
  status: Verdict
  footer: readonly [Fact, Fact]
  mono: boolean
}

/** The figure and footer for the focused span: the week (nothing focused), one source or one cell. */
function viewOf({
  span,
  s,
  day,
  number,
}: {
  span: readonly Cell[]
  s: Summary
  day: (at: number) => string
  number: (n: number) => string
}): View {
  const oldest = (at: number | null): Fact => ({
    label: 'Oldest',
    value: at === null ? 'None' : `${ageDays(at)} days`,
  })
  const untaggedOf = (untagged: number, of: number): Fact => ({
    label: 'Untagged',
    value: `${number(untagged)} of ${number(of)}`,
  })
  const older = (n: number, untagged: number, recentLabel: string): Verdict =>
    n > 0
      ? { tone: 'warn', label: `${number(n)} untagged 7+ days` }
      : { tone: 'neutral', label: untagged > 0 ? recentLabel : 'All mail tagged' }
  const change = (week: number, previous: number): Delta => ({
    value:
      previous === 0 ? `+${number(week)}` : `${signed(Math.round((week / previous - 1) * 100))}%`,
    polarity: 'neutral',
    label: 'vs prior 7 days',
  })
  const first = span[0]
  if (first === undefined) {
    return {
      value: s.week,
      period: 'messages, last 7 days',
      delta: change(s.week, s.previous),
      status: older(s.older, s.untagged, `${number(s.untagged)} untagged`),
      footer: [untaggedOf(s.untagged, s.week), oldest(s.oldestUntagged)],
      mono: false,
    }
  }
  if (span.length === 1) {
    return {
      value: first.count,
      period: `messages from ${first.name}, ${day(first.at)}`,
      delta: {
        value: signed(first.count - Math.round(first.usual)),
        polarity: 'neutral',
        label: 'vs usual day',
      },
      status:
        first.untagged > 0
          ? first.older
            ? { tone: 'warn', label: `${number(first.untagged)} untagged 7+ days` }
            : {
                tone: 'neutral',
                label: `${number(first.untagged)} untagged, ${number(first.unread)} unread`,
              }
          : { tone: 'neutral', label: 'All tagged' },
      footer: [untaggedOf(first.untagged, first.count), oldest(first.oldestUntagged)],
      mono: true,
    }
  }
  const row = s.rows.find((r) => r.id === first.source)
  if (row === undefined) throw new Error(`no row for source ${first.source}`)
  return {
    value: row.week,
    period: `messages from ${row.name}, last 7 days`,
    delta: change(row.week, row.previous),
    status: older(row.older, row.untagged, `${number(row.untagged)} untagged`),
    footer: [untaggedOf(row.untagged, row.week), oldest(row.oldestUntagged)],
    mono: false,
  }
}

export function ExprN54Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const s = summarize(
    shotState === 'empty' ? [] : fixture === undefined ? MESSAGES : messagesNamed(fixture),
  )
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', retry: noop, message: 'The mail service did not answer.' }
        : 'ready'
  const ready = phase === 'ready'
  const dayName = (at: number): string => `${f.date(at, 'weekday')} ${new Date(at).getUTCDate()}`
  const dayLong = (at: number): string => `${f.date(at, 'weekday')} ${f.date(at, 'short')}`
  const rowOf = (id: string): Row | undefined => s.rows.find((r) => r.id === id)
  const focus = useChartFocus(s.cells, {
    announce: (c) =>
      `${c.name}, ${dayLong(c.at)}: ${f.number(c.count)} messages, ${f.number(c.untagged)} untagged, ${f.number(c.unread)} unread`,
    announceSpan: (items) => {
      const row = rowOf(items[0]?.source ?? '')
      return row === undefined
        ? ''
        : `${row.name}: ${f.number(row.week)} messages in 7 days, ${f.number(row.untagged)} untagged, ${f.number(row.older)} older than 7 days`
    },
  })
  const v = ready ? viewOf({ span: focus.span, s, day: dayName, number: f.number }) : undefined
  const held: Fact = { label: '', value: '' }
  return (
    <Page area="expr-n54">
      <PageBar title="Work inbox, last 14 days" />
      <CardGrid min="regular">
        <ChartCard
          title="Mail by source and day"
          subtitle="Messages per source, UTC"
          phase={phase}
          empty={s.messages === 0 ? EMPTY_CAUSE : null}
          height="tall"
          figure={{
            value: v?.value ?? null,
            period: v?.period,
            periodMono: v?.mono,
            delta: v?.delta,
            status: v?.status,
          }}
          footer={
            v?.footer ?? [
              { ...held, label: 'Untagged' },
              { ...held, label: 'Oldest' },
            ]
          }
          chart={(box) => (
            <Heatmap
              label="Messages received per source and day over the last 14 days"
              data={s.cells}
              height={box.height}
              focus={focus}
              tooltip={false}
              getRow={(c) => c.name}
              getCol={(c) => c.day}
              getValue={(c) => c.count}
              rows={s.rows.map((r) => r.name)}
              cols={s.cells.filter((c) => c.source === s.rows[0]?.id).map((c) => c.day)}
              color={BASALT.ink}
              domain={[0, Math.max(s.max, 1)]}
              formatCol={(day) => dayName(Date.parse(day))}
              tickCols={TICK_DAYS}
              annotate={(c) =>
                c.usual > 0 && c.count >= 10 && c.count >= 2.5 * c.usual
                  ? `${Math.round(c.count / c.usual)}x`
                  : null
              }
              legend={{ label: 'Messages per day' }}
            />
          )}
        />
        <BarList
          title="Most mail, tagged or not"
          subtitle="Last 7 days; older is untagged mail past 7 days"
          phase={phase}
          empty={null}
          bodyRows={8}
          format={f.number}
          series={SERIES}
          focusItems={{ focus, holds: (row, c) => c.source === row.key }}
          items={s.rows.map((r) => ({
            key: r.id,
            label: r.name,
            value: r.week,
            secondary: r.older > 0 ? `${f.number(r.older)} older` : '',
            parts: { tagged: r.tagged, untagged: r.untagged },
          }))}
        />
      </CardGrid>
      {focus.live}
    </Page>
  )
}
