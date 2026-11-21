/**
 * Photo culling (expression n97): in which period did rating fall furthest behind shooting, and how
 * many photos have no capture time. One card: the bars are shots per period split into kept,
 * rejected and still unrated, the run that fell furthest behind carries the accent, and the undated
 * photos, which sit in no period, are the footer's first fact.
 */
import type { Delta } from 'basalt-ui/cards'
import { Bars, ChartCard, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { useFormat } from 'basalt-ui'
import { N97_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { furthestBehind, libraryOf } from './fixture'
import type { Period } from './fixture'

const HELD_DELTA: Delta = { value: '', polarity: 'neutral', label: '' }
const noop = (): void => undefined

export function ExprN97Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const library = libraryOf(fixture)
  const ready = shotState === undefined
  const periods: readonly Period[] = shotState === 'empty' ? [] : library.periods
  const run = furthestBehind(periods)
  const inRun = (p: Period): boolean => run?.periods.includes(p) ?? false

  const short = (at: Period['at']): string =>
    library.grain === 'month'
      ? f.date(at, 'month', { month: 'short', year: undefined })
      : f.date(at, 'day')
  const long = (at: Period['at']): string =>
    library.grain === 'month' ? f.date(at, 'month') : f.date(at, 'short')
  const partialAt = periods.find((p) => p.partial)?.at

  const focus = useChartFocus(periods, {
    announce: (p) => `${long(p.at)}: ${p.shots} shots, ${p.rated} rated, ${p.unrated} unrated`,
  })

  const usualShare = (() => {
    const others = periods.filter((p) => !p.partial && !inRun(p))
    const shots = others.reduce((total, p) => total + p.shots, 0)
    return shots === 0 ? 0 : others.reduce((total, p) => total + p.rated, 0) / shots
  })()
  const runShare = run === null ? 0 : (run.shots - run.unrated) / run.shots
  const points = Math.round((runShare - usualShare) * 100)

  const figure = (() => {
    if (!ready || run === null)
      return { value: null, period: '', delta: HELD_DELTA, unit: undefined }
    const first = run.periods[0]
    const last = run.periods.at(-1)
    return {
      value:
        first === last || last === undefined
          ? short(first?.at ?? '2026-01-01')
          : `${short(first?.at ?? '2026-01-01')}\u2013${short(last.at)}`,
      period: focus.readout(
        `${run.unrated} of ${run.shots} shots unrated`,
        (p) => `${short(p.at)}: ${p.unrated} of ${p.shots} unrated`,
      ),
      delta: {
        value: `${points < 0 ? '\u2212' : '+'}${Math.abs(points)} pts`,
        polarity: 'up-good' as const,
        label: `vs ${f.percent(usualShare)} usual`,
      },
    }
  })()

  return (
    <Page area="expr-n97">
      <PageBar
        title={
          library.grain === 'month'
            ? 'Photo culling, last 12 months'
            : 'Photo culling, last 30 days'
        }
      />
      <ChartCard
        title="Rating behind shooting"
        subtitle={ready && partialAt !== undefined ? `Lighter bar: ${library.partialNote}` : ''}
        info="Shots per period by decision. The accent marks the run that fell furthest behind. Photos with no capture time sit in no period."
        phase={
          shotState === 'loading'
            ? 'loading'
            : shotState === 'error'
              ? { tag: 'error', message: 'The photo library did not answer.', retry: noop }
              : 'ready'
        }
        empty={
          shotState === 'empty'
            ? {
                cause:
                  'No photo was shot in this window. Import a shoot to see how far rating keeps up.',
              }
            : null
        }
        height="tall"
        figure={figure}
        footer={[
          { label: 'Undated', value: ready ? `${f.number(library.undated)} photos` : '' },
          {
            label: 'Prior window',
            value: ready ? f.number(library.priorUndated) : '',
          },
        ]}
        chart={(box) => (
          <Bars
            label={`Shots per ${library.grain}, split into kept, rejected and unrated`}
            data={periods}
            height={box.height}
            focus={focus}
            tooltip={false}
            x={{
              value: (p) => p.at,
              format: (at) =>
                `${long(String(at) as Period['at'])}${at === partialAt ? ', so far' : ''}`,
              tickFormat: (at) => short(String(at) as Period['at']),
            }}
            y={{ title: `Shots per ${library.grain}` }}
            series={[
              {
                mark: 'bar',
                key: 'kept',
                label: 'Kept',
                color: N97_SERIES.kept,
                y: (p) => p.kept,
                opacity: (p) => (p.partial ? 0.55 : 1),
              },
              {
                mark: 'bar',
                key: 'rejected',
                label: 'Rejected',
                color: N97_SERIES.rejected,
                y: (p) => p.rejected,
                opacity: (p) => (p.partial ? 0.55 : 1),
              },
              {
                mark: 'bar',
                key: 'unrated',
                label: 'Unrated',
                color: N97_SERIES.unrated,
                y: (p) => p.unrated,
                opacity: (p) => (p.partial ? 0.55 : 1),
                highlight: inRun,
                values: (_total, p) => (inRun(p) ? String(p.unrated) : ''),
              },
            ]}
          />
        )}
      />
    </Page>
  )
}
