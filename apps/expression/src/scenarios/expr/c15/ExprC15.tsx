import { rect } from '@tanstack/charts/rect'
import { text } from '@tanstack/charts/text'
import { useFormat } from 'basalt-ui'
import { CartesianChart, ChartCard, useChartFocus } from 'basalt-ui/charts'
import type { ChartFocus } from 'basalt-ui/charts'
import type { ChartFigure } from 'basalt-ui/charts'
import { DataPanel } from 'basalt-ui/cards'
import type { Delta, Phase, Empty, FootFacts } from 'basalt-ui/cards'
import { Page, PageBar } from 'basalt-ui/page'
import { alpha, BASALT } from 'basalt-ui/tokens'
import { Num } from 'basalt-ui/ui/num'
import { ScrollArea } from 'basalt-ui/ui/scroll-area'
import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { ScenarioProps } from '../../shot-state'
import { MAX_OPEN_PCT, MIN_PER_WEEK, mailbox } from './fixture'
import type { Sender } from './fixture'

const MUTE = { light: BASALT.brand, dark: BASALT.brand }
const KEEP = { light: BASALT.inkMuted, dark: BASALT.inkMuted }

const CARD_HEIGHT = 'h-128'
const BODY_HEIGHT = 444
const LABELLED = 3
const LABEL_TOP = 78
const LABEL_STEP = 9
const WEEK_TICKS = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500]
const MIN_WEEK = 0.4

const NONE: readonly Sender[] = []
const LIST_EMPTY: Empty = { cause: 'No senders to rank.' }

const EMPTY: Empty = {
  cause: 'No mail from the last 90 days yet. Senders appear here once a mailbox is connected.',
}

function Row({
  sender,
  focusProps,
}: {
  sender: Sender
  focusProps: ReturnType<ReturnType<typeof useChartFocus<Sender>>['item']>
}) {
  return (
    <div
      {...focusProps}
      className="flex items-center gap-2 px-3 py-1 text-sm data-focused:bg-selected"
    >
      <span className="min-w-0 flex-1 truncate font-mono text-xs">{sender.name}</span>
      <Num
        value={sender.perWeek}
        format={{ maximumFractionDigits: 1 }}
        className="w-16 text-right"
      />
      <Num
        value={sender.openPct / 100}
        format={{ style: 'percent', maximumFractionDigits: 0 }}
        className="w-16 text-right"
      />
    </div>
  )
}

function stepOnKey(focus: ChartFocus<Sender>) {
  return (event: KeyboardEvent<HTMLDivElement>) => {
    const next = focus.step(event.key)
    if (next === undefined) return
    event.preventDefault()
    event.stopPropagation()
    focus.set(next)
  }
}

export function ExprC15Scenario({ shotState, fixture }: ScenarioProps) {
  const fmt = useFormat()
  const [recovered, setRecovered] = useState(false)
  const failed = shotState === 'error' && !recovered
  const senders = shotState === 'empty' || failed ? NONE : mailbox(fixture)
  const muted = senders.filter((s) => s.mute)
  const saved = muted.reduce((sum, s) => sum + s.perWeek, 0)
  const total = senders.reduce((sum, s) => sum + s.perWeek, 0)
  const share = total === 0 ? 0 : saved / total

  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : failed
        ? {
            tag: 'error',
            message: 'The mailbox did not answer, so no senders loaded.',
            retry: () => setRecovered(true),
          }
        : 'ready'
  const hasData = phase === 'ready' && senders.length > 0
  const empty = senders.length === 0 ? EMPTY : null
  const maxWeek = senders.reduce((m, s) => Math.max(m, s.perWeek), MIN_PER_WEEK)
  const weekEnd = WEEK_TICKS.find((t) => t >= maxWeek * 1.1) ?? maxWeek
  const weekTicks = WEEK_TICKS.filter((t) => t >= MIN_WEEK && t <= weekEnd)
  const n = (v: number) => fmt.number(v, { maximumFractionDigits: 1 })

  const focus = useChartFocus(senders, {
    announce: (s) =>
      `${s.name}: ${n(s.perWeek)} mails a week, ${s.openPct}% opened, ${s.mute ? 'mute' : 'keep'}`,
  })
  const indexOf = new Map(senders.map((s, i) => [s.id, i]))
  const rows = (list: readonly Sender[]) =>
    list.map((s) => <Row key={s.id} sender={s} focusProps={focus.item(indexOf.get(s.id) ?? 0)} />)

  const rest = muted.length === 0 ? 'None to mute' : `${muted.length} senders`
  const headline = hasData
    ? {
        figure: {
          value: focus.readout<number | string>(saved, (s) => s.perWeek),
          unit: focus.readout('a week saved', () => 'a week'),
          delta: focus.readout<Delta>(
            {
              value: `${saved === 0 ? '' : '-'}${fmt.percent(share, { maximumFractionDigits: 0 })}`,
              polarity: saved === 0 ? 'neutral' : 'up-bad',
              label: 'of all mail',
            },
            (s) => ({ value: `${s.openPct}%`, polarity: 'neutral', label: 'opened' }),
          ),
          period: focus.readout(rest, (s) => s.name),
        } satisfies ChartFigure,
        footer: [{ label: 'All mail', value: `${n(total)} a week` }] satisfies FootFacts,
      }
    : null

  return (
    <Page area="mailbox">
      <PageBar title="Mailbox clean-up, last 90 days" />
      <div className="@container flex flex-col gap-3">
        <div className="grid gap-3 @wide:grid-cols-2">
          {/* cycle-expression-4: the host's arrow keys do not step forward past the first sender on a scatter, so the wrapper steps the shared focus itself */}
          <div className={CARD_HEIGHT} onKeyDownCapture={stepOnKey(focus)}>
            <ChartCard
              height="fill"
              title="Mail volume against open rate"
              subtitle={`${MIN_PER_WEEK}+ a week and under ${MAX_OPEN_PCT}% opened is a candidate`}
              phase={phase}
              empty={empty}
              {...headline}
              chart={(box) => (
                <CartesianChart<Sender>
                  height={box.height}
                  label="Open rate against mails a week for each sender"
                  summary={`${senders.length} senders; ${muted.length} mail ${MIN_PER_WEEK} or more a week and are opened under ${MAX_OPEN_PCT}%.`}
                  data={senders}
                  focus={focus}
                  x={{
                    value: (s) => s.perWeek,
                    scale: 'log',
                    title: 'Mails a week',
                    domain: [MIN_WEEK, weekEnd],
                    ticks: weekTicks,
                    format: (v) => String(v),
                  }}
                  y={{
                    title: 'Opened, %',
                    domain: { floor: 0, ceil: 100, pad: 0.04 },
                    format: (v) => String(v),
                  }}
                  refLines={[
                    { axis: 'x', value: MIN_PER_WEEK, color: KEEP, dashed: true },
                    { value: MAX_OPEN_PCT, color: KEEP, dashed: true },
                  ]}
                  series={[
                    {
                      mark: 'dot',
                      key: 'other',
                      label: 'Keep',
                      color: KEEP,
                      y: (s) => (s.mute ? null : s.openPct),
                    },
                    {
                      mark: 'dot',
                      key: 'mute',
                      label: 'Mute candidate',
                      color: MUTE,
                      y: (s) => (s.mute ? s.openPct : null),
                    },
                  ]}
                  // cycle-expression-4: the tooltip nearest-datum can differ from the focused datum the hero reads; the readout carries the sender, so the tooltip is off
                  tooltip={false}
                  marks={CartesianChart.custom<Sender>((plot) => {
                    const top = plot
                      .rows('mute')
                      .filter((s) => s.mute)
                      .slice(0, LABELLED)
                    return [
                      // cycle-expression-4: no x-bounded zone (zones are y bands), so the candidate box is an engine rect
                      rect([null], {
                        x1: () => MIN_PER_WEEK,
                        x2: () => weekEnd,
                        y1: () => 0,
                        y2: () => MAX_OPEN_PCT,
                        fill: alpha(BASALT.brand, 0.1),
                      }),
                      // cycle-expression-4: no pixel scale in custom marks for chartLabels.place, so the worst senders are labelled in a right-aligned data-space stack above the box (ranked, no leader line)
                      text(top, {
                        x: () => weekEnd,
                        y: (s: Sender) => LABEL_TOP - LABEL_STEP * top.indexOf(s),
                        text: (s: Sender) => s.name,
                        anchor: 'end',
                        fill: BASALT.ink,
                        fontSize: BASALT.text.micro,
                      }),
                    ]
                  })}
                />
              )}
            />
          </div>
          <DataPanel
            title="Senders"
            phase={phase}
            empty={senders.length === 0 ? LIST_EMPTY : null}
            bodySize={{ height: BODY_HEIGHT }}
            body={() => (
              <ScrollArea
                aria-label="Senders by mails a week"
                className="max-h-full"
                onPointerLeave={focus.target.onPointerLeave}
              >
                <div className="flex gap-2 px-3 py-1 text-xs text-muted-foreground">
                  <span className="flex-1">Sender</span>
                  <span className="w-16 text-right">A week</span>
                  <span className="w-16 text-right">Opened</span>
                </div>
                {rows(muted)}
                {muted.length > 0 && muted.length < senders.length && (
                  <div className="px-3 py-1 text-xs text-muted-foreground">Keep</div>
                )}
                {rows(senders.filter((s) => !s.mute))}
                {focus.live}
              </ScrollArea>
            )}
          />
        </div>
      </div>
    </Page>
  )
}
