import { text } from '@tanstack/charts/text'
import type { ReactElement } from 'react'
import { CartesianChart, ChartCard, chartLabels, useChartFocus } from 'basalt-ui/charts'
import type { ChartFocus } from 'basalt-ui/charts'
import { DataPanel } from 'basalt-ui/cards'
import type { Empty, Phase } from 'basalt-ui/cards'
import { Page } from 'basalt-ui/page'
import { BASALT } from 'basalt-ui/tokens'
import { ScrollArea } from 'basalt-ui/ui/scroll-area'
import { Status } from 'basalt-ui/ui/status'
import { NIGHT_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { bestNight, nightsFor } from './fixture'
import type { Night } from './fixture'

type Kind = 'best' | 'go' | 'marginal' | 'out'

const KINDS: readonly Kind[] = ['best', 'go', 'marginal', 'out']

/** The legend word, and the list's verdict word. */
const KIND_LABEL: Record<Kind, string> = {
  best: 'Best',
  go: 'Go',
  marginal: 'Marginal',
  out: 'Out',
}

const EMPTY: Empty = {
  cause: 'No forecast for the next ten nights. Choose an observing site to load one.',
}

const LIST_EMPTY: Empty = { cause: 'Nights appear here once a forecast loads.' }

const ERROR: Phase = {
  tag: 'error',
  message: 'The forecast service did not answer.',
  retry: () => undefined,
}

const hoursText = (hours: number): string => `${hours} h`

function phaseFor(shotState: ScenarioProps['shotState']): Phase {
  if (shotState === 'loading') return 'loading'
  if (shotState === 'error') return ERROR
  return 'ready'
}

const CELL = 'min-w-0'

function NightList({
  nights,
  focus,
  kindOf,
}: {
  nights: readonly Night[]
  focus: ChartFocus<Night>
  kindOf: (n: Night) => Kind
}): ReactElement {
  return (
    <ScrollArea
      aria-label="Verdict for each night"
      className="@container max-h-full"
      onPointerLeave={focus.target.onPointerLeave}
    >
      <div className="grid grid-cols-3 gap-x-3 px-3 py-1 text-xs text-muted-foreground @regular:grid-cols-4">
        <span>Night</span>
        <span>Verdict</span>
        <span className="hidden @regular:block">Ruled out by</span>
        <span className="text-right">Peak altitude</span>
      </div>
      {nights.map((n, i) => {
        const kind = kindOf(n)
        return (
          <div
            key={n.id}
            {...focus.item(i)}
            className="grid grid-cols-3 items-baseline gap-x-3 gap-y-0.5 px-3 py-2 text-sm data-focused:bg-selected @regular:grid-cols-4"
          >
            <span className={`${CELL} font-mono`}>{n.label}</span>
            <span className={CELL}>
              {/* cycle-expression-5: Swatch takes only a series group the provider registers, so the list cannot reuse the bar colors; the best night's accent dot and a neutral dot for the grey steps stand in. */}
              <Status tone={kind === 'best' ? 'accent' : 'neutral'}>{KIND_LABEL[kind]}</Status>
            </span>
            <span
              className={`${CELL} order-last col-span-3 text-muted-foreground @regular:order-none @regular:col-span-1`}
            >
              {n.factor}
            </span>
            <span className={`${CELL} text-right tabular-nums`}>{n.altitude}°</span>
          </div>
        )
      })}
    </ScrollArea>
  )
}

export function ExprN07Scenario({ shotState, fixture }: ScenarioProps): ReactElement {
  const nights = shotState === 'empty' ? [] : nightsFor(fixture)
  const best = bestNight(nights)
  const kindOf = (n: Night): Kind => (n.id === best?.id ? 'best' : n.verdict)
  const outNights = nights.filter((n) => n.verdict === 'out')
  const focus = useChartFocus(nights, {
    announce: (n) =>
      `${n.label}: ${hoursText(n.hours)} dark, ${n.verdict}${n.factor === null ? '' : `, ${n.factor}`}`,
  })
  const phase = phaseFor(shotState)
  const settled = phase === 'ready' && nights.length > 0
  const present = KINDS.filter((k) => nights.some((n) => kindOf(n) === k))
  const byId = new Map(nights.map((n) => [n.id, n]))

  // The baseline at rest: the best night against the longest other night, signed, in every fixture that has a best.
  const other = nights
    .filter((n) => n.id !== best?.id)
    .reduce<Night | null>((a, n) => (a === null || n.hours > a.hours ? n : a), null)
  const gap = best !== null && other !== null ? best.hours - other.hours : 0
  const restDelta =
    best !== null && other !== null
      ? {
          value: `${gap < 0 ? '−' : '+'}${Math.abs(gap).toFixed(1)} h`,
          polarity: 'neutral' as const,
          label: `vs ${other.short}`,
        }
      : null

  return (
    <Page area="expr-n07">
      <div className="grid items-stretch gap-3 @wide:grid-cols-2">
        <ChartCard
          title="Best observing night"
          subtitle="Next ten nights"
          info="Dark hours are the hours with the sun and the moon both below the horizon. The best night is the go night with the most of them."
          phase={phase}
          empty={shotState === 'empty' ? EMPTY : null}
          figure={{
            // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n07, kept as its builder left it: its figure follows focus, built before figure-readout
            value: focus.readout(
              shotState === 'empty' ? null : (best?.label ?? 'None'),
              (n) => n.label,
            ),
            period: focus.readout(
              best === null
                ? nights.length === 0
                  ? ''
                  : 'no night is go'
                : `${hoursText(best.hours)} dark, target ${best.altitude}°`,
              (n) => `${hoursText(n.hours)} dark, target ${n.altitude}°, ${n.factor ?? n.verdict}`,
            ),
            ...(focus.datum === null && restDelta !== null ? { delta: restDelta } : {}),
          }}
          footer={[
            {
              label: 'Ruled out',
              value: settled ? `${outNights.length} of ${nights.length}` : '—',
            },
          ]}
          chart={(box) => (
            <CartesianChart<Night>
              height={box.height}
              label="Dark hours for each of the next ten nights, by verdict"
              data={nights}
              focus={focus}
              x={{
                value: (n) => n.id,
                format: (id) => byId.get(String(id))?.day ?? '',
                ticks: nights.length,
                title: 'November',
              }}
              y={{ title: 'Dark hours', domain: { floor: 0, pad: 0.12 } }}
              // cycle-expression-5: the tooltip card covers the neighbouring bars being compared and the hero already reads the focused night, so it is off.
              tooltip={false}
              series={present.map((k) => ({
                mark: 'bar' as const,
                key: k,
                label: KIND_LABEL[k],
                color: NIGHT_SERIES[k],
                y: (n: Night) => (kindOf(n) === k ? n.hours : null),
              }))}
              marks={CartesianChart.custom<Night>((plot) => {
                // cycle-expression-5: the kit has no bar-end annotation, so the best bar, each ruled-out night and the near-empty nights are labelled with chartLabels and a text mark.
                const roomy = plot.plotWidth / Math.max(plot.data.length, 1) >= 40
                const words = (n: Night): { text: string; priority: number } | null => {
                  if (n.id === best?.id) return { text: 'Best', priority: 3 }
                  const rare = n.hours < 0.5 ? hoursText(n.hours) : null
                  if (n.reason !== null)
                    return {
                      text: rare !== null && roomy ? `${n.reason} ${rare}` : (rare ?? n.reason),
                      priority: 2,
                    }
                  return rare === null ? null : { text: rare, priority: 1 }
                }
                const marked = plot.data.filter((n) =>
                  plot.visible.some((s) => s.key === kindOf(n)),
                )
                const { placed } = chartLabels.place(
                  marked.flatMap((n) => {
                    const w = words(n)
                    return w === null
                      ? []
                      : [
                          {
                            key: n.id,
                            text: w.text,
                            priority: w.priority,
                            spots: ['above'] as const,
                            x: plot.x(n.id) ?? 0,
                            y: plot.y(n.hours),
                          },
                        ]
                  }),
                  { width: plot.plotWidth, height: plot.plotHeight },
                  { gap: 4 },
                )
                return [
                  text(placed, {
                    x: (l) => l.key,
                    y: (l) => byId.get(l.key)?.hours ?? 0,
                    text: (l) => l.text,
                    dx: (l) => l.dx,
                    dy: (l) => l.dy,
                    anchor: (l) => l.textAnchor,
                    fill: BASALT.ink,
                    fontSize: BASALT.text.micro,
                  }),
                ]
              })}
            />
          )}
        />
        <DataPanel
          title="Verdict by night"
          subtitle="Reason and peak altitude"
          phase={phase}
          empty={shotState === 'empty' ? LIST_EMPTY : null}
          bodySize={{ rows: 10 }}
          body={() => <NightList nights={nights} focus={focus} kindOf={kindOf} />}
        />
      </div>
    </Page>
  )
}
