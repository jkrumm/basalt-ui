import { text } from '@tanstack/charts/text'
import { useFormat } from 'basalt-ui'
import { CartesianChart, ChartCard, useChartFocus } from 'basalt-ui/charts'
import { CardGrid, Page, PageBar } from 'basalt-ui/page'
import { BASALT } from 'basalt-ui/tokens'
import { Slider } from 'basalt-ui/ui/slider'
import { useId, useMemo, useState } from 'react'
import type { ScenarioProps } from '../../shot-state'
import {
  BIN_WIDTH,
  CHUNK_COUNT,
  CUTOFF_STEP,
  RECENCY_BIN_WIDTH,
  binScores,
  buildChunks,
  initialCutoff,
  median,
  milli,
  resolveFixture,
  type Bin,
} from './fixture'

const KEPT = { light: BASALT.brand, dark: BASALT.brand }
const CUT = { light: BASALT.inkFaint, dark: BASALT.inkMuted }

const band = (b: Bin): string => `${b.lo.toFixed(2)} to ${b.hi.toFixed(2)}`
/** A bar is drawn over its whole band, so it is centred on the band's middle. */
const mid = (b: Bin): number => (b.lo + b.hi) / 2
// cycle-expression-3: refLines and engine rules on a band x take no value between bands, so no cut-off rule sits on a bar boundary; the colour split and a tag on the first kept bar say it, and the tags are engine marks because the kit has no label mark
// cycle-expression-3: a binned numeric x gets one tick per bar and no tick-count knob, so only the bands that start on a quarter print a label
const quarterLabel = (b: Bin): string => (milli(b.lo) % 250 === 0 ? b.lo.toFixed(2) : '')

export function ExprC11Scenario({ shotState, fixture }: ScenarioProps) {
  const name = resolveFixture(fixture)
  const format = useFormat()
  const labelId = useId()
  const chunks = useMemo(() => buildChunks(name), [name])
  const bins = useMemo(
    () =>
      binScores(
        chunks.map((c) => c.relevance),
        BIN_WIDTH,
      ),
    [chunks],
  )
  const [cutoff, setCutoff] = useState(() => initialCutoff(name))

  const cutMilli = milli(cutoff)
  const keptChunks = chunks.filter((c) => milli(c.relevance) >= cutMilli)
  const kept = keptChunks.length
  const isKept = (b: Bin): boolean => milli(b.lo) >= cutMilli
  const share = Math.round((kept / CHUNK_COUNT) * 100)

  const recencyBins = useMemo(() => {
    const keptBins = binScores(
      keptChunks.map((c) => c.recency),
      RECENCY_BIN_WIDTH,
    )
    const cutBins = binScores(
      chunks.filter((c) => milli(c.relevance) < cutMilli).map((c) => c.recency),
      RECENCY_BIN_WIDTH,
    )
    return keptBins.map((b, i) => ({ ...b, cut: cutBins[i]?.count ?? 0 }))
  }, [chunks, keptChunks, cutMilli])
  const medianRecency = median(keptChunks.map((c) => c.recency))
  const medianCutRecency = median(
    chunks.filter((c) => milli(c.relevance) < cutMilli).map((c) => c.recency),
  )

  const densest = bins.reduce(
    (top, b) => (b.count > top.count ? b : top),
    bins[0] ?? { lo: 0, hi: 0, count: 0 },
  )
  const ranked = bins.map((b) => b.count).toSorted((a, b) => b - a)
  const second = ranked[1] ?? 0
  const clipAt = densest.count > second * 2.5 ? Math.ceil((second * 1.25) / 10) * 10 : null
  const firstKept = bins.filter((b) => milli(b.lo) === cutMilli)
  const top = clipAt ?? Math.ceil((densest.count * 1.1) / 50) * 50

  // Keyboard focus walks the bands that hold chunks, so the first stop lights a mark and speaks a count.
  const focusBins = useMemo(() => bins.filter((b) => b.count > 0), [bins])
  const focus = useChartFocus(focusBins, {
    announce: (b) =>
      `Relevance ${band(b)}: ${format.number(b.count)} chunks, ${isKept(b) ? 'kept' : 'cut'}`,
  })
  const recencyFocus = useChartFocus(recencyBins, {
    announce: (b) =>
      `Recency ${band(b)}: ${format.number(b.count)} kept, ${format.number(b.cut)} cut`,
  })

  const phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? ({
            tag: 'error',
            message: 'The chunk index did not answer.',
            retry: () => undefined,
          } as const)
        : 'ready'
  const settled = shotState === undefined
  const bare = shotState === 'empty' || shotState === 'error'

  return (
    <Page>
      <PageBar title="Retrieval cut-off" />
      <div className="flex flex-col gap-4">
        {
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <span id={labelId} className="text-sm font-medium">
                Relevance cut-off
              </span>
              <span className="text-sm tabular-nums">
                {settled
                  ? format.number(cutoff, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : '–'}
              </span>
            </div>
            {/* oxlint-disable-next-line basalt/control-home -- the cut-off is one page-local scalar; FormField, FilterSet and ControlHome all need a field handle and a form or filter store this single slider has no use for */}
            <Slider
              aria-labelledby={labelId}
              min={0}
              max={1}
              step={CUTOFF_STEP}
              value={cutoff}
              disabled={!settled}
              onValueChange={(v) => setCutoff(typeof v === 'number' ? v : (v[0] ?? 0))}
            />
          </div>
        }
        <CardGrid min="regular">
          <ChartCard
            title="Relevance scores"
            subtitle={
              settled && clipAt !== null
                ? `Per ${BIN_WIDTH.toFixed(2)} of relevance; the top bar is cut at ${clipAt}`
                : `Chunks per ${BIN_WIDTH.toFixed(2)} of relevance score`
            }
            phase={phase}
            empty={
              shotState === 'empty'
                ? {
                    cause:
                      'No chunks are indexed for this collection. Run ingestion, then tune the cut-off.',
                  }
                : null
            }
            {...(bare
              ? {}
              : {
                  figure: {
                    value: settled
                      ? focus.readout(format.number(kept), (b) => format.number(b.count))
                      : null,
                    unit: focus.readout('kept', (b) => `chunks at ${band(b)}`),
                    period: focus.readout(
                      `${share}% of ${format.number(CHUNK_COUNT)} chunks`,
                      (b) => `${Math.round((b.count / CHUNK_COUNT) * 100)}% of all chunks`,
                    ),
                  },
                })}
            footer={[
              {
                label: 'Densest band',
                value: settled ? `${densest.lo.toFixed(2)} to ${densest.hi.toFixed(2)}` : '–',
              },
            ]}
            chart={() => (
              <CartesianChart
                data={bins}
                ariaLabel={`Chunks per relevance band, ${kept} kept at or above ${cutoff.toFixed(2)}`}
                x={{
                  value: mid,
                  format: (v) => {
                    const hit = bins.find((b) => mid(b) === v)
                    return hit === undefined ? '' : quarterLabel(hit)
                  },
                }}
                y={{
                  title: 'Chunks',
                  ...(clipAt === null ? {} : { domain: [0, clipAt] as [number, number] }),
                }}
                series={[
                  {
                    mark: 'bar',
                    key: 'kept',
                    label: 'Kept',
                    color: KEPT,
                    y: (b) => (isKept(b) ? b.count : null),
                  },
                  {
                    mark: 'bar',
                    key: 'cut',
                    label: 'Cut',
                    color: CUT,
                    y: (b) => (isKept(b) ? null : b.count),
                  },
                ]}
                selection={{
                  selected: null,
                  onSelect: (b) => {
                    if (b !== null) setCutoff(b.lo)
                  },
                }}
                marks={CartesianChart.custom<Bin>(() => [
                  text(firstKept, {
                    x: mid,
                    y: (b: Bin) => b.count,
                    text: () => `Kept from ${cutoff.toFixed(2)}`,
                    anchor: 'end',
                    dx: 8,
                    dy: -26,
                    fontSize: BASALT.text.nano,
                    fill: BASALT.ink,
                  }),
                  text([densest], {
                    x: mid,
                    y: (b: Bin) => Math.min(b.count, top),
                    text: (b: Bin) => format.number(b.count),
                    dy: clipAt === null ? -8 : 10,
                    fontSize: BASALT.text.nano,
                    fontWeight: 600,
                    fill: clipAt !== null && isKept(densest) ? BASALT.onBrand : BASALT.ink,
                  }),
                ])}
                focus={focus}
              />
            )}
          />
          <ChartCard
            title="Recency of the kept chunks"
            subtitle={`Chunks per ${RECENCY_BIN_WIDTH.toFixed(1)} of recency`}
            phase={phase}
            empty={
              shotState === 'empty' ? { cause: 'Nothing to date until chunks are indexed.' } : null
            }
            {...(bare
              ? {}
              : {
                  figure: {
                    value: settled
                      ? recencyFocus.readout(
                          medianRecency === null ? null : medianRecency.toFixed(2),
                          (b) => format.number(b.count),
                        )
                      : null,
                    unit: recencyFocus.readout('median recency, kept', (b) => `kept at ${band(b)}`),
                  },
                })}
            footer={[
              {
                label: 'Median recency, cut',
                value: settled && medianCutRecency !== null ? medianCutRecency.toFixed(2) : '–',
              },
            ]}
            chart={() => (
              <CartesianChart
                data={recencyBins}
                ariaLabel="Kept and cut chunks per recency band"
                x={{
                  value: mid,
                  format: (v) => {
                    const hit = recencyBins.find((b) => mid(b) === v)
                    return hit === undefined || milli(hit.lo) % 500 !== 0 ? '' : hit.lo.toFixed(1)
                  },
                }}
                y={{ title: 'Chunks' }}
                series={[
                  { mark: 'bar', key: 'kept', label: 'Kept', color: KEPT, y: (b) => b.count },
                  { mark: 'bar', key: 'cut', label: 'Cut', color: CUT, y: (b) => b.cut },
                ]}
                focus={recencyFocus}
              />
            )}
          />
        </CardGrid>
      </div>
    </Page>
  )
}
