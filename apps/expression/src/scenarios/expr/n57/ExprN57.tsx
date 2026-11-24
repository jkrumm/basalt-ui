import type { Phase } from 'basalt-ui/cards'
import { Heatmap, ChartCard, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { BASALT, alpha } from 'basalt-ui/tokens'
import type { ScenarioProps } from '../../shot-state'
import { NightCard } from './NightCard'
import { SitesPanel } from './SitesPanel'
import { NIGHTS, SITES } from './fixture'
import { cellName, hoursText, nightLabel } from './format'
import { CLEAR, WORTH, cellsOf, topCell } from './summary'
import type { Cell } from './summary'

type Dataset = { cells: readonly Cell[]; top: Cell | null; annotate: (c: Cell) => string | null }

function datasetOf(fixture: string | undefined): Dataset {
  const cells = cellsOf(fixture)
  const top = topCell(cells)
  return {
    cells,
    top,
    annotate: (c) => {
      if (!c.forecast) return '-'
      if (c.moonlit) return 'moon'
      const hours = hoursText(c.usable)
      return c.id === top?.id && c.usable >= WORTH ? `${hours} best` : hours
    },
  }
}

const DATASETS = {
  rest: datasetOf(undefined),
  overcast: datasetOf('overcast'),
  clear: datasetOf('clear'),
}
const NO_CELLS: readonly Cell[] = []
const ROWS = NIGHTS.map((n) => n.id)
const COLS = SITES.map((s) => s.id)
const SITE_NAME = new Map<string, string>(SITES.map((s) => [s.id, s.name]))
const STATES = [
  { key: 'moon', label: 'Clear, moon up', color: alpha(BASALT.inkMuted, 0.7) },
  { key: 'none', label: 'No forecast', color: alpha(BASALT.line, 0.25) },
] as const

const NO_FORECAST =
  'No site has sent a forecast for these nights. Forecasts refresh at the next model run.'
// cycle-expression-13: the kit flips a cell label to white from about 45 % of the scale and keeps it white when the cell dims, so the scale runs past the data and every label stays in ink
const SCALE_MAX = 15
const noop = (): void => undefined
const stateOf = (c: Cell): 'moon' | 'none' | undefined =>
  !c.forecast ? 'none' : c.moonlit ? 'moon' : undefined

export function ExprN57Scenario({ shotState, fixture }: ScenarioProps) {
  const data =
    fixture === 'overcast'
      ? DATASETS.overcast
      : fixture === 'clear'
        ? DATASETS.clear
        : DATASETS.rest
  const empty = shotState === 'empty' ? NO_FORECAST : null
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', retry: noop, message: 'The service did not answer.' }
        : 'ready'
  /** The parts beside the heatmap fail quietly: the heatmap card says why and holds the one Retry. */
  const beside: Phase = typeof phase === 'object' ? { tag: 'error' } : phase
  const ready = phase === 'ready' && empty === null
  const cells = empty === null ? data.cells : NO_CELLS
  const reading = (d: Cell): string => (d.forecast ? `${hoursText(d.usable)} h` : 'no forecast')
  const focus = useChartFocus(cells, {
    announce: (d) => `${cellName(d.site.name, d.night.id)}: ${reading(d)}`,
  })
  const held = focus.span.length > 1 ? topCell(focus.span) : focus.datum
  const shown = held ?? data.top
  /** The detail card and the hero readout name one item: the best of a held run. */
  const readOf = (d: Cell): string => {
    const one = focus.span.length > 1 ? (topCell(focus.span) ?? d) : d
    return `${cellName(one.site.name, one.night.id)}: ${reading(one)}`
  }
  const top = data.top
  const nearest =
    top === null ? null : cells.find((c) => c.night === top.night && c.site === SITES[0])
  const worthy = top !== null && top.usable >= WORTH
  const worthNights = NIGHTS.filter((n) =>
    cells.some((c) => c.night === n && c.usable >= WORTH),
  ).length
  const nightEmpty =
    empty !== null
      ? NO_FORECAST
      : ready && shown !== null && !shown.forecast
        ? `Nothing to draw for ${cellName(shown.site.name, shown.night.id)}. Pick another cell.`
        : null
  const missing = cells.filter((c) => !c.forecast)
  const gap =
    nearest === undefined || nearest === null || top === null ? 0 : top.usable - nearest.usable
  return (
    <Page area="darksite">
      <PageBar title="Astronomy nights, next ten" />
      <div className="grid gap-3 p-3 @wide:grid-cols-2">
        <div className="grid min-h-140 @wide:row-span-2">
          <ChartCard
            title="Usable dark hours"
            subtitle={`Moon down, cloud under ${CLEAR} %`}
            phase={phase}
            empty={empty === null ? null : { cause: empty }}
            height="fill"
            figure={{
              value: ready && top !== null ? (worthy ? nightLabel(top.night.id) : 'None') : null,
              unit: ready && top !== null ? (worthy ? `at ${top.site.name}` : 'qualifies') : '',
              delta:
                !ready || !worthy
                  ? undefined
                  : gap > 0
                    ? {
                        value: `+${hoursText(gap)} h`,
                        polarity: 'up-good',
                        label: `vs ${SITES[0]?.name ?? ''}, nearest`,
                      }
                    : { value: '0 h', polarity: 'neutral', label: 'nearest site is best' },
              period: ready
                ? focus.readout(
                    top !== null && worthy
                      ? `${top.site.drive} min drive`
                      : 'Clouds or moonlight spoil all ten',
                    readOf,
                  )
                : '',
            }}
            footer={[
              {
                label: 'Worth the drive',
                value: ready ? `${worthNights} of ${NIGHTS.length}` : '',
              },
              {
                label: 'Missing',
                value: ready ? (missing.length === 0 ? 'none' : (missing[0]?.site.name ?? '')) : '',
              },
            ]}
            chart={() => (
              <Heatmap
                label="Hours of clear moonless darkness, by night and place"
                data={cells}
                rows={ROWS}
                cols={COLS}
                getRow={(c) => c.night.id}
                getCol={(c) => c.site.id}
                getValue={(c) => (c.forecast ? c.usable : null)}
                getState={stateOf}
                states={STATES}
                formatRow={nightLabel}
                formatCol={(id) => SITE_NAME.get(id) ?? id}
                tickCols={COLS}
                color={BASALT.brand}
                domain={[0, SCALE_MAX]}
                formatValue={(v) => `${hoursText(v)} h`}
                formatLegend={(v) => `${hoursText(v)} h`}
                annotate={data.annotate}
                focus={focus}
                tooltip={false}
                matchHeight
              />
            )}
          />
        </div>
        <NightCard
          cell={ready && shown?.forecast ? shown : null}
          phase={beside}
          empty={nightEmpty}
          best={shown === top}
        />
        <SitesPanel
          cells={cells}
          focus={focus}
          phase={beside}
          empty={
            empty === null
              ? null
              : `No forecast for ${SITES.map((s) => s.name).join(', ')} yet; rows appear when new data lands.`
          }
        />
      </div>
      {focus.live}
    </Page>
  )
}
