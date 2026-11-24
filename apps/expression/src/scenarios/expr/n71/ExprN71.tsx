import { useState } from 'react'
import { useFormat } from 'basalt-ui'
import { BarList, StatCard } from 'basalt-ui/cards'
import type { Phase } from 'basalt-ui/cards'
import { Bars, ChartCard, useChartFocus } from 'basalt-ui/charts'
import { EmptyState, Page, PageBar } from 'basalt-ui/page'
import { alpha, BASALT } from 'basalt-ui/tokens'
import { Meter } from 'basalt-ui/ui/meter'
import { N71_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { libraryOf, MIN_JUDGED, TARGET_PERCENT } from './fixture'
import type { FixtureName, GearRow, Library, RatingKey, RatingRow } from './fixture'

type BarListItem = Parameters<typeof BarList>[0]['items'][number]

const STARS: Partial<Record<RatingKey, number>> = { one: 1, two: 2, three: 3, four: 4, five: 5 }
const ratingKey = (x: number | Date | string): RatingKey => x as RatingKey
const ratingName = (key: RatingKey): string => {
  const stars = STARS[key]
  if (stars === undefined) return key === 'rejected' ? 'Rejected' : 'Unrated'
  return stars === 1 ? '1 star' : `${stars} stars`
}
const ratingTick = (key: RatingKey): string => {
  const stars = STARS[key]
  return stars === undefined ? ratingName(key) : `${stars}★`
}

const STORAGE_NAME = { staging: 'Staging', final: 'Final', trash: 'Trash' } as const

const METER_MAX = 50

// cycle-expression-15: useFormat has no byte formatter
const BYTE_UNITS = ['B', 'kB', 'MB', 'GB', 'TB'] as const
function bytesText(format: ReturnType<typeof useFormat>, bytes: number): string {
  let value = bytes
  let step = 0
  while (value >= 1000 && step < BYTE_UNITS.length - 1) {
    value /= 1000
    step += 1
  }
  return `${format.number(value, { maximumFractionDigits: step === 0 ? 0 : 1 })} ${BYTE_UNITS[step]}`
}

// cycle-expression-15: a chart cap that clamps one bar needs a rounded domain end, the kit rounds none for a fixed domain
function niceCeil(value: number): number {
  const step = 10 ** Math.floor(Math.log10(Math.max(value, 1)))
  return Math.ceil((value * 1.1) / step) * step
}

function fixtureOf(name: string | undefined): FixtureName {
  return name === 'reached' || name === 'few' ? name : 'season'
}

type Source = 'tally' | 'gear' | 'storage'

/** What the page prints for a library, every string empty before the data is in. */
type View = {
  rate: number | null
  rateText: string
  delta: string
  deltaLabel: string
  sub: string
  keptNow: string
  keptNeeded: string
  judged: string
  of: string
  median: string
}

const HELD: View = {
  rate: null,
  rateText: '',
  delta: '',
  deltaLabel: '',
  sub: '',
  keptNow: '',
  keptNeeded: '',
  judged: '',
  of: '',
  median: '',
}

/** The rating at the middle of the judged photos, in rating order. */
function medianOf(library: Library): RatingKey {
  const judged = library.ratings.filter((row) => row.judged)
  let seen = 0
  for (const row of judged) {
    seen += row.photos
    if (seen * 2 >= library.judged) return row.key
  }
  return 'rejected'
}

function viewOf(format: ReturnType<typeof useFormat>, library: Library): View {
  const rate = library.judged >= MIN_JUDGED ? (100 * library.kept) / library.judged : null
  const targetKept = Math.ceil((TARGET_PERCENT * library.judged) / 100)
  const gap = rate === null ? 0 : rate - TARGET_PERCENT
  const one = { minimumFractionDigits: 1, maximumFractionDigits: 1 }
  const more = targetKept - library.kept
  return {
    rate,
    rateText: rate === null ? '' : format.number(rate, one),
    delta: rate === null ? '' : `${gap < 0 ? '−' : '+'}${format.number(Math.abs(gap), one)} pts`,
    deltaLabel: `vs ${TARGET_PERCENT} % target`,
    sub:
      rate === null
        ? 'Not measured, a rate needs 20 or more'
        : more > 0
          ? `${format.number(more)} more keepers needed`
          : `${format.number(-more)} keepers to spare`,
    keptNow: format.number(library.kept),
    keptNeeded: rate === null ? '—' : format.number(targetKept),
    judged: format.number(library.judged),
    of: `of ${format.number(library.photos)} in the library`,
    median: ratingName(medianOf(library)),
  }
}

const NO_ITEMS: readonly BarListItem[] = []

function gearItems(format: ReturnType<typeof useFormat>, rows: readonly GearRow[]): BarListItem[] {
  return rows.map((row) => ({
    key: row.key,
    label: row.name,
    value: row.photos,
    secondary:
      row.judged >= MIN_JUDGED
        ? `${format.number((100 * row.kept) / row.judged, { maximumFractionDigits: 0 })} %`
        : `${row.judged} judged`,
  }))
}

export function ExprN71Scenario({ shotState, fixture }: ScenarioProps) {
  const format = useFormat()
  const library = libraryOf(fixtureOf(fixture))
  const [failed, setFailed] = useState<Record<Source, boolean>>({
    tally: shotState === 'error',
    gear: shotState === 'error',
    storage: shotState === 'error',
  })
  const retry = (source: Source) => () => setFailed((prev) => ({ ...prev, [source]: false }))
  const phaseOf = (source: Source, message: string): Phase => {
    if (shotState === 'loading') return 'loading'
    if (failed[source]) return { tag: 'error', message, retry: retry(source) }
    return 'ready'
  }
  const tallyPhase = phaseOf('tally', 'The tally of stars did not answer.')
  const gearPhase = phaseOf('gear', 'The camera index did not answer.')
  const storagePhase = phaseOf('storage', 'The storage scan did not answer.')

  const photosText = (n: number): string => `${format.number(n)} photos`
  const ratingFocus = useChartFocus<RatingRow>(library.ratings, {
    announce: (d) => `${ratingName(d.key)}: ${photosText(d.photos)}`,
  })
  const bodyFocus = useChartFocus<GearRow>(library.bodies, {
    announce: (d) => `${d.name}: ${photosText(d.photos)}`,
  })

  const tallyReady = tallyPhase === 'ready'
  const view = tallyReady ? viewOf(format, library) : HELD
  const gearReady = gearPhase === 'ready'
  const storageReady = storagePhase === 'ready'
  const totalBytes = library.storage.reduce((sum, row) => sum + row.bytes, 0)
  const topJudged = Math.max(...library.ratings.filter((r) => r.judged).map((r) => r.photos))
  const meterMax = view.rate !== null && view.rate > METER_MAX ? 100 : METER_MAX

  return (
    <Page area="expr-n71">
      <PageBar title="Library, season review" />
      {shotState === 'empty' ? (
        <EmptyState title="Nothing imported yet" cause="Import a shoot to start rating." />
      ) : (
        <>
          <div className="grid gap-3 @wide:grid-cols-3">
            <div className="grid">
              <StatCard
                title="Keeper rate"
                subtitle="4 stars or more, of judged"
                info="Higher is better."
                value={view.rate === null ? null : view.rateText}
                unit={view.rate === null ? undefined : '%'}
                delta={
                  tallyReady && view.rate === null
                    ? undefined
                    : { value: view.delta, polarity: 'neutral', label: view.deltaLabel }
                }
                sub={view.sub}
                phase={tallyPhase}
                // a Meter is 17 px (bar and readout line): the chart box takes its height, so the inset has no empty band
                chartHeight={17}
                chart={() => (
                  <Meter
                    label="Progress to target"
                    value={view.rate}
                    max={meterMax}
                    // cycle-expression-15: Meter always prints its value beside the verdict word, and the figure above already says it
                    format={() => ''}
                    zones={[
                      { to: TARGET_PERCENT, tone: 'warn', label: 'Behind' },
                      { to: meterMax, tone: 'neutral', label: 'Reached' },
                    ]}
                  />
                )}
                footer={[
                  { label: 'Now', value: view.keptNow },
                  { label: 'Needed', value: view.keptNeeded },
                ]}
              />
            </div>
            <div className="grid @wide:col-span-2 @wide:row-span-2">
              <ChartCard
                title="Star ratings"
                subtitle="Every photo in the library"
                phase={tallyPhase}
                height="short"
                figure={{
                  value: tallyReady ? view.judged : null,
                  unit: 'judged',
                  period: ratingFocus.readout(
                    view.of,
                    (d) => `${ratingName(d.key)}, ${photosText(d.photos)}`,
                  ),
                }}
                footer={[{ label: 'Median rating', value: view.median }]}
                chart={(box) => (
                  <Bars
                    label="Count by star rating, keeper bars highlighted"
                    data={library.ratings}
                    height={box.height}
                    focus={ratingFocus}
                    tooltip={false}
                    x={{
                      value: (d) => d.key,
                      format: (x) => ratingName(ratingKey(x)),
                      tickFormat: (x) => ratingTick(ratingKey(x)),
                    }}
                    y={{ title: 'Photos', domain: [0, niceCeil(topJudged)] }}
                    zones={[
                      {
                        axis: 'x',
                        from: 'four',
                        to: 'five',
                        fill: alpha(BASALT.brand, 0.1),
                        label: 'Keepers',
                      },
                      {
                        axis: 'x',
                        from: 'unrated',
                        to: 'unrated',
                        fill: alpha(BASALT.ink, 0.05),
                        label: 'Not counted',
                      },
                    ]}
                    series={[
                      {
                        mark: 'bar',
                        key: 'count',
                        label: 'Count',
                        color: N71_SERIES.photos,
                        y: (d) => d.photos,
                        values: true,
                        highlight: (d) => d.kept,
                        format: (n) => format.number(n),
                      },
                    ]}
                  />
                )}
              />
            </div>
            <div className="grid">
              <BarList
                title="Storage by folder"
                // cycle-expression-15: an empty subtitle drops the header line, so loading holds a blank one
                subtitle={storageReady ? `of ${bytesText(format, totalBytes)}` : '\u00a0'}
                phase={storagePhase}
                bodyRows={3}
                max={totalBytes}
                format={(bytes) => bytesText(format, bytes)}
                items={
                  storageReady
                    ? library.storage.map((row) => ({
                        key: row.key,
                        label: STORAGE_NAME[row.key],
                        value: row.bytes,
                      }))
                    : NO_ITEMS
                }
                focusItems={{
                  focus: ratingFocus,
                  holds: (row, d) =>
                    row.key === 'final' ? d.kept : row.key === 'staging' ? !d.kept : false,
                }}
              />
            </div>
          </div>
          <div className="grid gap-3 @wide:grid-cols-2">
            {bodyFocus.live}
            <BarList
              title="Camera bodies"
              subtitle="Photos, then the keeper share"
              phase={gearPhase}
              bodyRows={10}
              focus={bodyFocus}
              format={(n) => format.number(n)}
              items={gearReady ? gearItems(format, library.bodies) : NO_ITEMS}
            />
            <BarList
              title="Lenses"
              subtitle="Pointing at a body lights its lenses"
              phase={gearPhase}
              bodyRows={10}
              format={(n) => format.number(n)}
              items={gearReady ? gearItems(format, library.lenses) : NO_ITEMS}
              focusItems={{
                focus: bodyFocus,
                holds: (row, body) => body.with.includes(row.label),
              }}
            />
          </div>
        </>
      )}
    </Page>
  )
}
