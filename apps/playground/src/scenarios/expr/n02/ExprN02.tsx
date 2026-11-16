/**
 * Expression n02: the factory owner opens the console and asks where Issues are stuck and for how
 * long. One dot per open Issue on a stage axis, drawn as a multiple of that stage's typical time
 * (so a 2 h queue and a 10 h review share one scale), and the same Issues in a list beside it that
 * shares the chart's one focus.
 */
import { text } from '@tanstack/charts/text'
import { DataPanel } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar, PageSummary } from 'basalt-ui/page'
import { BASALT } from 'basalt-ui/tokens'
import { ScrollArea } from 'basalt-ui/ui/scroll-area'
import type { ReactElement } from 'react'
import type { ScenarioProps } from '../../shot-state'
import {
  STAGES,
  STAGE_LABEL,
  STUCK_AT,
  bandOf,
  buildIssues,
  fixtureName,
  formatAge,
} from './fixture'
import type { Issue, Stage } from './fixture'

const NEUTRAL = { light: BASALT.inkMuted, dark: BASALT.inkMuted }
const STUCK = { light: BASALT.bad, dark: BASALT.bad }

/** The y axis stops here; an Issue beyond it is drawn on the cap and labelled with its true multiple. */
const CAP = 6

// cycle-expression-3: no published subpath exports `Phase`, so the page restates the arms it uses.
type Phase = 'ready' | 'loading' | { tag: 'error'; message: string; retry: () => void }

const ERROR: Phase = {
  tag: 'error',
  message: 'The factory did not answer. Check the connection and retry.',
  retry: () => undefined,
}

const EMPTY = {
  cause: 'The pipeline is clear. New Issues appear here as they enter the queue.',
}

/** An Issue as the chart draws it: its x is spread within the stage so equal multiples do not hide each other. */
type Dot = Issue & { x: number; plotted: number }

// cycle-expression-3: the chart has no jitter or beeswarm, so the page spreads dots of one stage by hand.
function toDots(issues: readonly Issue[]): Dot[] {
  const sizes = new Map<Stage, number>()
  for (const issue of issues) sizes.set(issue.stage, (sizes.get(issue.stage) ?? 0) + 1)
  const seen = new Map<Stage, number>()
  return issues.map((issue) => {
    const rank = seen.get(issue.stage) ?? 0
    seen.set(issue.stage, rank + 1)
    const n = sizes.get(issue.stage) ?? 1
    // every dot gets its own x, so the focus ring can only land on the dot it names
    const step = n > 1 ? Math.min(0.12, 0.5 / (n - 1)) : 0
    return {
      ...issue,
      x: issue.at + (rank - (n - 1) / 2) * step,
      plotted: Math.min(issue.ratio, CAP),
    }
  })
}

const multiple = (ratio: number) => `${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}×`

function ListRows({ issues, focus }: { issues: readonly Dot[]; focus: Focus }): ReactElement {
  return (
    <ScrollArea
      aria-label="Open Issues, longest past typical first"
      className="max-h-125"
      onPointerLeave={focus.target.onPointerLeave}
    >
      {issues.map((issue, i) => (
        <div
          key={issue.id}
          {...focus.item(i)}
          className="flex items-baseline justify-between gap-3 border-b px-3 py-2 text-sm data-focused:bg-selected"
        >
          <div className="flex min-w-0 flex-col">
            <span className="flex items-baseline gap-2">
              <span className="font-mono">{issue.id}</span>
              <span className="text-muted-foreground">{STAGE_LABEL[issue.stage]}</span>
            </span>
            <span className="truncate text-muted-foreground">{issue.title}</span>
          </div>
          <div className="flex shrink-0 flex-col items-end tabular-nums">
            <span>{formatAge(issue.hours)}</span>
            <span className="text-muted-foreground">
              {multiple(issue.ratio)} of {formatAge(issue.typical)}
            </span>
          </div>
        </div>
      ))}
    </ScrollArea>
  )
}

type Focus = ReturnType<typeof useChartFocus<Dot>>

function topStuckStage(issues: readonly Issue[]): Stage | null {
  const counts = new Map<Stage, number>()
  for (const issue of issues) {
    if (bandOf(issue) !== 'stuck') continue
    counts.set(issue.stage, (counts.get(issue.stage) ?? 0) + 1)
  }
  return [...counts.entries()].toSorted(([, a], [, b]) => b - a)[0]?.[0] ?? null
}

function Loaded({ issues, phase }: { issues: readonly Issue[]; phase: Phase }): ReactElement {
  const dots = toDots(issues)
  const longest = dots[0]
  const stuck = dots.filter((d) => bandOf(d) === 'stuck')
  const topStage = topStuckStage(issues)
  const focus = useChartFocus(dots, {
    announce: (d) =>
      `${d.id} in ${STAGE_LABEL[d.stage]}: ${formatAge(d.hours)}, ${multiple(d.ratio)} the typical ${formatAge(d.typical)}`,
  })
  const shown = focus.datum ?? longest
  const empty = phase === 'ready' && issues.length === 0
  const failed = typeof phase === 'object'
  // a header band above the data holds the stage names
  const top = Math.max(1.2, ...dots.map((d) => d.plotted)) + 0.9
  const labelled = stuck.slice(0, 2)

  const sentence = failed
    ? 'Stage times are unavailable'
    : empty
      ? 'No open Issues'
      : stuck.length === 0
        ? `Nothing is stuck across ${issues.length} open Issues`
        : `${stuck.length} of ${issues.length} open Issues are stuck${topStage ? `, most in ${STAGE_LABEL[topStage].toLowerCase()}` : ''}`

  return (
    <Page area="issues">
      <PageBar title="Stuck Issues" />
      {phase === 'loading' ? (
        <PageSummary phase="loading" facts={[]} />
      ) : (
        <PageSummary sentence={sentence} facts={[]} />
      )}
      <div className="grid gap-4 @wide:grid-cols-2">
        <div className="flex h-140 flex-col">
          <ChartCard
            height="fill"
            title="Time in stage"
            phase={phase}
            empty={empty ? EMPTY : null}
            {...(shown
              ? {
                  figure: {
                    value: formatAge(shown.hours),
                    period: `${focus.datum ? '' : 'longest: '}${shown.id} in ${STAGE_LABEL[shown.stage].toLowerCase()}`,
                    delta: {
                      value: `${multiple(shown.ratio)} typical`,
                      polarity:
                        bandOf(shown) === 'stuck' ? ('up-bad' as const) : ('neutral' as const),
                    },
                  },
                }
              : {})}
            chart={(box) => (
              <CartesianChart<Dot>
                ariaLabel={`Open Issues by stage, each as a multiple of the stage's typical time; ${stuck.length} are past ${STUCK_AT} times`}
                data={dots}
                height={box.height}
                focus={focus}
                x={{
                  value: (d) => d.x,
                  domain: [0.5, STAGES.length + 0.5],
                  // cycle-expression-3: the axis drops category labels at 390, so the stage names are text marks in a header band.
                  format: () => '',
                }}
                y={{ domain: [-0.15, top], title: '× typical time' }}
                refLines={[
                  { value: 1, dashed: true, color: NEUTRAL },
                  { value: STUCK_AT, dashed: true, color: STUCK },
                ]}
                tooltip={{
                  formatHeader: (d) => `${d.id} in ${STAGE_LABEL[d.stage].toLowerCase()}`,
                  rows: (d) => [
                    { label: 'In stage', value: formatAge(d.hours) },
                    { label: 'Typical', value: formatAge(d.typical) },
                    { label: 'Multiple', value: multiple(d.ratio) },
                  ],
                }}
                series={[
                  {
                    mark: 'dot',
                    key: 'ok',
                    label: 'Not stuck',
                    color: NEUTRAL,
                    y: (d) => (bandOf(d) === 'stuck' ? null : d.plotted),
                  },
                  {
                    mark: 'dot',
                    key: 'stuck',
                    label: 'Stuck',
                    color: STUCK,
                    y: (d) => (bandOf(d) === 'stuck' ? d.plotted : null),
                  },
                ]}
                marks={CartesianChart.custom<Dot>(() => [
                  // cycle-expression-3: the kit has no stage header, rule label or datum label, so text marks name them.
                  text(STAGES, {
                    x: (s: Stage) => STAGES.indexOf(s) + 1,
                    y: () => top - 0.35,
                    text: (s: Stage) => STAGE_LABEL[s],
                    anchor: 'middle',
                    fill: BASALT.ink,
                    fontSize: BASALT.text.micro,
                  }),
                  text(
                    [
                      { y: 1, label: 'typical' },
                      { y: STUCK_AT, label: `stuck at ${STUCK_AT}×` },
                    ],
                    {
                      x: () => 4,
                      y: (r: { y: number }) => r.y,
                      text: (r: { label: string }) => r.label,
                      anchor: 'middle',
                      dy: -6,
                      fill: BASALT.ink,
                      fontSize: BASALT.text.micro,
                    },
                  ),
                  text(labelled, {
                    x: (d: Dot) => d.x,
                    y: (d: Dot) => d.plotted,
                    text: (d: Dot) =>
                      d.ratio > CAP
                        ? `${d.id} ${multiple(d.ratio)} (off scale)`
                        : `${d.id} ${multiple(d.ratio)}`,
                    anchor: (d: Dot) => (d.at >= 4 ? 'end' : 'start'),
                    dx: (d: Dot) => (d.at >= 4 ? -9 : 9),
                    dy: 4,
                    fill: BASALT.ink,
                    fontSize: BASALT.text.micro,
                  }),
                ])}
              />
            )}
          />
        </div>
        {failed || empty ? null : (
          <DataPanel
            title="Open Issues"
            subtitle="longest past typical first"
            phase={phase}
            bodySize={{ rows: 12 }}
            body={() => <ListRows issues={dots} focus={focus} />}
          />
        )}
      </div>
    </Page>
  )
}

export function ExprN02Scenario({ shotState, fixture }: ScenarioProps): ReactElement {
  const phase: Phase = shotState === 'loading' ? 'loading' : shotState === 'error' ? ERROR : 'ready'
  const issues =
    shotState === 'empty' || shotState === 'loading' || shotState === 'error'
      ? []
      : buildIssues(fixtureName(fixture))
  return <Loaded issues={issues} phase={phase} />
}
