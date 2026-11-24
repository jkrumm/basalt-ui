import { ChartCard, useChartFocus } from 'basalt-ui/charts'
import { DataPanel, StatCell, StatGroup } from 'basalt-ui/cards'
import type { DataPanelProps } from 'basalt-ui/cards'
import { Page, PageBar } from 'basalt-ui/page'
import { BASALT } from 'basalt-ui/tokens'
import { ScrollArea } from 'basalt-ui/ui/scroll-area'
import { Status } from 'basalt-ui/ui/status'
import type { ScenarioProps } from '../../shot-state'
import { KIND_LABEL, graphFor, reach } from './fixture'
import type { Reach } from './fixture'
import { ReachRings } from './ReachRings'

type Phase = NonNullable<DataPanelProps['phase']>

const LIST_SKELETON_ROWS = 10

const retry = () => undefined

const hopWord = (hop: number): string => `${hop} ${hop === 1 ? 'hop' : 'hops'}`

function phaseFor(shotState: ScenarioProps['shotState'], message: string): Phase {
  if (shotState === 'loading') return 'loading'
  if (shotState === 'error') return { tag: 'error', message, retry }
  return 'ready'
}

const reachLine = (r: Reach): string => (r.hop === null ? 'out of reach' : hopWord(r.hop))

const pair = (color: string) => ({ light: color, dark: color })

const LEGEND = [
  { key: 'origin', label: 'Leaked key', color: pair(BASALT.ink), swatch: 'dot' },
  { key: 'affected', label: 'Affected', color: pair(BASALT.bad), swatch: 'dot' },
  { key: 'reachable', label: 'Reachable', color: pair(BASALT.inkMuted), swatch: 'dot' },
] as const

export function ExprC10Scenario({ shotState, fixture }: ScenarioProps) {
  const graph = graphFor(fixture)
  const settled = shotState !== 'empty' && shotState !== 'error'
  const rows = settled ? reach(graph) : []
  const phase = phaseFor(shotState, 'The inventory service did not answer.')
  const ringPhase = phaseFor(shotState, 'The reach could not be drawn.')

  const reached = rows.filter((r) => r.hop !== null && r.hop > 0)
  const affected = reached.filter((r) => r.affected).length
  const farthest = Math.max(0, ...reached.map((r) => r.hop ?? 0))
  const peers = (hop: number): number => rows.filter((r) => r.hop === hop).length

  const read = (r: Reach): string => {
    if (r.hop === null) return `${r.id}: out of reach`
    if (r.via === null) return `${r.id}: the leaked key`
    return `${r.id}: ${hopWord(r.hop)} away via ${r.via}; ${peers(r.hop)} at this distance`
  }
  const focus = useChartFocus(rows, { announce: read })

  const emptyCause =
    'No resources are indexed for this key yet. Run an inventory scan, then reload.'

  const list = (
    <DataPanel
      title="Resources by distance"
      subtitle="Nearest first, along the shortest path"
      phase={phase}
      empty={shotState === 'empty' ? { cause: emptyCause } : null}
      bodySize={{ rows: LIST_SKELETON_ROWS }}
      body={() => (
        <ScrollArea aria-label="Resources by hop" className="max-h-full">
          <ol className="m-0 flex list-none flex-col p-0">
            {rows.map((r, i) => (
              // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle c10, kept as its builder left it: its rows predate RowList
              <li
                key={r.id}
                {...focus.item(i)}
                className="flex items-center gap-2 border-b border-grid px-3 py-2 data-focused:bg-selected"
              >
                <span className="w-10 shrink-0 text-end text-sm font-medium tabular-nums">
                  {r.hop ?? '–'}
                </span>
                {/* cycle-expression-3: no tree or ladder indent in the kit; one spacer per hop */}
                <div className="flex min-w-0 flex-1 items-center">
                  {Array.from({ length: r.hop ?? 0 }, (_, step) => (
                    <span key={step} aria-hidden className="w-3 shrink-0" />
                  ))}
                  <div className="flex min-w-0 flex-col">
                    <span
                      className={
                        r.hop === null
                          ? 'font-mono text-sm break-all text-muted-foreground'
                          : 'font-mono text-sm break-all'
                      }
                    >
                      {r.id}
                    </span>
                    <span className="text-xs break-words text-muted-foreground">
                      {KIND_LABEL[r.kind]}
                      {r.via === null
                        ? r.hop === null
                          ? ' · out of reach'
                          : ' · origin'
                        : ` · via ${r.via}`}
                    </span>
                  </div>
                </div>
                {r.affected && r.hop !== 0 ? <Status tone="bad">Affected</Status> : null}
              </li>
            ))}
          </ol>
        </ScrollArea>
      )}
    />
  )

  const rings = (
    <ChartCard
      title="Reach by hop"
      subtitle="One mark per resource on the ring of its distance"
      phase={ringPhase}
      empty={
        shotState === 'empty'
          ? {
              cause: 'Nothing to draw yet.',
              action: { label: 'Run inventory scan', onClick: retry },
            }
          : null
      }
      figure={{
        // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle c10, kept as its builder left it: its figure follows focus, built before figure-readout
        value: focus.readout(String(reached.length), (r) => (r.hop === null ? '–' : String(r.hop))),
        unit: focus.readout('resources in reach', (r) => (r.hop === 1 ? 'hop' : 'hops')),
        period: focus.readout(`${affected} affected`, (r) => `${r.id}, ${reachLine(r)}`),
      }}
      legend={LEGEND}
      chart={() => <ReachRings rows={rows} focus={focus} farthest={farthest} />}
    />
  )

  return (
    <Page area="key-reach">
      <PageBar title="Leaked key reach" />
      <StatGroup variant="strip" label="Reach of the leaked key">
        <StatCell
          title="Reachable"
          value={settled ? reached.length : null}
          unit={settled ? `of ${rows.length - 1} resources` : ''}
          phase={phase === 'loading' ? 'loading' : 'ready'}
        />
        <StatCell
          title="Farthest"
          value={settled ? farthest : null}
          unit={settled ? (farthest === 1 ? 'hop' : 'hops') : ''}
          phase={phase === 'loading' ? 'loading' : 'ready'}
        />
        <StatCell
          title="Affected"
          value={settled ? affected : null}
          unit={settled ? `of ${reached.length} reachable` : ''}
          phase={phase === 'loading' ? 'loading' : 'ready'}
          {...(settled ? { status: { tone: 'bad', label: 'Seen in logs' } as const } : {})}
        />
      </StatGroup>
      <div {...focus.target} aria-label="Resources and their reach" className="@container">
        <div className="grid grid-cols-1 items-start gap-4 @wide:grid-cols-2">
          <div className="@wide:order-2">{rings}</div>
          <div className="@wide:order-1">{list}</div>
        </div>
        {focus.live}
      </div>
    </Page>
  )
}
