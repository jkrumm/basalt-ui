/**
 * c07 — Eval run against its baseline.
 *
 *   Question: Did this run beat the baseline, and which cases changed sides?
 *   Form: the pass rate with its verdict and the four counts; then one square per case (regressed
 *   and fixed first, coloured by side) as the run's single tab stop with a readout of the focused
 *   case; then every case that changed sides as a table whose row opens the full case.
 *
 * `?fixture=default|tied|regressed` picks the data (`tied` is the zero-flip extreme).
 */
import { useRouterState } from '@tanstack/react-router'
import { DataPanel, StatCard } from 'basalt-ui/cards'
import { useChartFocus } from 'basalt-ui/charts'
import { CardGrid, EmptyState, Page, PageSummary, QueryState, Section } from 'basalt-ui/page'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import { Sheet, SheetContent } from 'basalt-ui/ui/sheet'
import { VX } from 'basalt-ui/tokens'
import { Status, Swatch } from 'basalt-ui/ui/status'
import { useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { noop } from '../../shot-state'
import type { ScenarioProps } from '../../shot-state'
import { BASELINE_LABEL, FIXTURE_NAMES, RUN_LABEL, buildCases, flips, tally } from './fixture'
import type { CaseRow, Change, FixtureName, Tally } from './fixture'

const EMPTY_CAUSE = 'This run scored no cases, so there is nothing to compare with the baseline.'
const ERROR_MESSAGE = `Could not load the run of ${RUN_LABEL} or its baseline of ${BASELINE_LABEL}: the eval results store did not answer. Retry, or check the run in the eval service.`

/** Squares per row; the arrow keys step a row by the same count. */
const COLUMNS = 20

const c = col<CaseRow>()

const CHANGE_TONE: Record<Change, 'good' | 'bad' | 'neutral'> = {
  Regressed: 'bad',
  Fixed: 'good',
  'Still passing': 'neutral',
  'Still failing': 'neutral',
}

/** A square's fill: the flips take the strong verdict fills, a held pass is a hairline-quiet bar, a held fail is hollow. */
const SQUARE: Record<Change, string> = {
  Regressed: 'bg-bad',
  Fixed: 'bg-good',
  'Still passing': 'bg-line',
  'Still failing': 'border border-line',
}

/** The non-hue cue on a flip: a minus for pass to fail, a plus for fail to pass. */
const GLYPH: Record<Change, string> = {
  Regressed: '\u2212',
  Fixed: '+',
  'Still passing': '',
  'Still failing': '',
}

const KEY: readonly { change: Change; count: (t: Tally) => number }[] = [
  { change: 'Regressed', count: (t) => t.regressed },
  { change: 'Fixed', count: (t) => t.fixed },
  { change: 'Still passing', count: (t) => t.heldPass },
  { change: 'Still failing', count: (t) => t.heldFail },
]

const columns = [
  c.entity('id', { header: 'Case', filter: 'text', priority: 1 }),
  c.text('input', { header: 'Input', priority: 3 }),
  c.status('change', {
    header: 'Side',
    options: ['Regressed', 'Fixed', 'Still passing', 'Still failing'],
    tone: (value) => CHANGE_TONE[value as Change] ?? 'neutral', // cycle-expression-2: a status tone takes a string, so the closed union needs a cast
    filter: 'multi',
    priority: 1,
  }),
]

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

function verdictOf(t: Tally): { tone: 'good' | 'bad' | 'neutral'; label: string } {
  const net = t.passNow - t.passBase
  if (net > 0) return { tone: 'good', label: 'Beat baseline' }
  if (net < 0) return { tone: 'bad', label: 'Below baseline' }
  return { tone: 'neutral', label: 'Matches baseline' }
}

function sentenceOf(t: Tally): string {
  const net = t.passNow - t.passBase
  const moved = t.fixed + t.regressed
  if (moved === 0) return 'No case changed sides: this run matches the baseline case for case'
  const split = `${t.fixed} fixed, ${t.regressed} regressed`
  if (net === 0) return `Even on pass count, but ${plural(moved, 'case')} changed sides: ${split}`
  const lead = net > 0 ? 'Beat the baseline' : 'Fell below the baseline'
  return `${lead} by ${plural(Math.abs(net), 'case')}: ${split}`
}

const signed = (n: number): string => `${n > 0 ? '+' : ''}${n}`
const pct = (n: number, total: number): string => ((n / total) * 100).toFixed(1)

/** The change against the baseline as plain text: signed points, both rates, the case net. */
function deltaLine(t: Tally): string {
  const pp = ((t.passNow - t.passBase) / t.total) * 100
  const points = `${pp > 0 ? '+' : ''}${pp.toFixed(1)} pp`
  return `${points} vs baseline ${pct(t.passBase, t.total)}% (${signed(t.passNow - t.passBase)} cases)`
}

/** Case numbers of one side, for the line beside the bracket. */
const numbers = (rows: readonly CaseRow[], change: Change): string =>
  rows
    .filter((r) => r.change === change)
    .map((r) => `#${Number(r.id.slice(5))}`)
    .join(', ')

function Key({ change, count }: { change: Change; count: number }): ReactElement {
  return (
    <li className="flex items-center gap-2">
      {change === 'Still failing' ? (
        <span className="size-2.5 rounded-chip border border-line" aria-hidden="true" />
      ) : (
        <Swatch color={change === 'Regressed' ? VX.bad : change === 'Fixed' ? VX.good : VX.line} />
      )}
      <span>{change}</span>
      <span className="font-medium">{count}</span>
    </li>
  )
}

function useFixtureName(): FixtureName {
  // cycle-expression-2: the scenario route's validateSearch drops `fixture`, so read the raw search string
  const raw = useRouterState({ select: (s) => s.location.searchStr })
  const name = new URLSearchParams(raw).get('fixture')
  return FIXTURE_NAMES.find((n) => n === name) ?? 'default'
}

function Field({ label, children }: { label: string; children: string }): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="m-0 font-mono text-sm break-words whitespace-pre-wrap">{children}</dd>
    </div>
  )
}

function CaseSheet({ row, onClose }: { row: CaseRow | null; onClose: () => void }): ReactElement {
  return (
    <Sheet
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent title={row === null ? 'Case' : `Case ${row.id}`}>
        {row === null ? null : (
          <dl className="m-0 flex flex-col gap-4">
            <div className="flex gap-4">
              <Status tone="neutral">{`Baseline ${row.baseline}`}</Status>
              <Status tone={row.now === 'Pass' ? 'good' : 'bad'}>{`This run ${row.now}`}</Status>
            </div>
            <Field label="Input">{row.input}</Field>
            <Field label="Expected">{row.expected}</Field>
            <Field label="Actual">{row.actual}</Field>
          </dl>
        )}
      </SheetContent>
    </Sheet>
  )
}

/** One square per case: the run's single tab stop. Arrow keys and pointing move one readout. */
function Squares({ rows, t }: { rows: readonly CaseRow[]; t: Tally }): ReactElement {
  const focus = useChartFocus(rows, {
    columns: COLUMNS,
    announce: (d) => `${d.id}: baseline ${d.baseline}, this run ${d.now}. ${d.change}.`,
  })
  const moved = t.fixed + t.regressed
  const rest: ReactNode = `${t.passNow} of ${t.total} cases pass, ${moved} changed sides`
  return (
    <div className="flex max-w-xl flex-col gap-2">
      <ul className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-1 p-0 text-sm tabular-nums @regular:grid-cols-4">
        {KEY.map((k) => (
          <Key key={k.change} change={k.change} count={k.count(t)} />
        ))}
      </ul>
      <div className="min-h-28 text-sm tabular-nums">
        {focus.readout<ReactNode>(rest, (d) => (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{d.id}</span>
              <Status tone={CHANGE_TONE[d.change]}>{d.change}</Status>
            </div>
            <div className="break-words">Input: {d.input}</div>
            <div className="break-words">Expected: {d.expected}</div>
            <div className="break-words">Actual: {d.actual}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-20 gap-1" aria-hidden="true">
        {moved === 0 ? (
          <div className="col-span-20 text-xs text-muted-foreground">No case changed sides</div>
        ) : (
          // theme-allow hidden-inline-style — the bracket spans as many columns as there are flips
          <div
            className="border-b border-ink-faint pb-1 text-xs whitespace-nowrap tabular-nums"
            style={{ gridColumn: `span ${Math.min(moved, COLUMNS)}` }} // cycle-expression-2: a labelled bracket over a run of marks; no annotation primitive
          >
            {`${t.regressed} regressed, ${t.fixed} fixed`}
          </div>
        )}
      </div>
      <div
        {...focus.target}
        aria-label={`Eval cases, ${rows.length} squares, one per case. Arrow keys move between cases.`}
        className="grid grid-cols-20 gap-1"
      >
        {rows.map((row, i) => (
          <div
            key={row.id}
            {...focus.item(i)}
            className={`flex aspect-square items-center justify-center rounded-chip text-micro text-primary-foreground data-dimmed:opacity-25 data-focused:ring-2 data-focused:ring-brand ${SQUARE[row.change]}`}
          >
            {GLYPH[row.change]}
          </div>
        ))}
      </div>
      {focus.live}
      <div className="flex flex-col gap-1 text-xs text-muted-foreground tabular-nums">
        {t.regressed > 0 ? <p className="m-0">Regressed: {numbers(rows, 'Regressed')}</p> : null}
        {t.fixed > 0 ? <p className="m-0">Fixed: {numbers(rows, 'Fixed')}</p> : null}
        <p className="m-0">
          1 square = 1 case. Minus is pass to fail, plus is fail to pass. Point at a square or use
          the arrow keys to read a case.
        </p>
      </div>
    </div>
  )
}

function Body({ rows, loading }: { rows: readonly CaseRow[]; loading: boolean }): ReactElement {
  const [open, setOpen] = useState<CaseRow | null>(null)
  const t = tally(rows)
  const moved = flips(rows)
  const verdict = verdictOf(t)
  const phase = loading ? 'loading' : 'ready'
  const table = useDataTable<CaseRow>({
    id: 'expr-c07-flips',
    label: 'Cases that changed sides',
    columns,
    data: moved,
    getRowId: (row) => row.id,
    mode: { kind: 'client' },
    pager: 'none',
    onRowActivate: setOpen,
    phase,
  })
  return (
    <div className="flex flex-col gap-6 pt-4">
      {loading ? (
        <PageSummary loading facts={[]} />
      ) : (
        <PageSummary
          sentence={<span className="tabular-nums">{sentenceOf(t)}</span>}
          facts={[`Run of ${RUN_LABEL}`, `Baseline of ${BASELINE_LABEL}`, plural(t.total, 'case')]}
        />
      )}
      <CardGrid min="regular">
        <StatCard
          title="Pass rate"
          subtitle="vs the baseline run"
          value={loading ? null : ((t.passNow / t.total) * 100).toFixed(1)}
          unit="%"
          status={verdict}
          sub={`${deltaLine(t)}; ${t.passNow} of ${t.total} pass`} // cycle-expression-2: the delta chip is near-invisible in light, so the signed change is plain text
          phase={phase}
        />
      </CardGrid>
      <DataPanel
        title="Every case"
        subtitle="Regressed and fixed first"
        phase={phase}
        skeleton={{ height: 320 }}
        body={() => <Squares rows={rows} t={t} />}
      />
      <Section title="Cases that changed sides">
        {moved.length === 0 && !loading ? (
          <EmptyState
            why="No case changed sides, so there is nothing to list. Every case held its result."
            tier="section"
          />
        ) : (
          // theme-allow hidden-inline-style — the table skeleton is a fixed 6 rows; the loading wrapper holds the loaded rows' height
          // cycle-expression-2: no table option makes the skeleton match the loaded row count
          <div
            className="flex flex-col"
            style={
              loading
                ? {
                    minHeight: `calc(${Math.max(moved.length, 6) + 1} * var(--table-row-h, var(--vx-row-h)))`,
                  }
                : undefined
            }
          >
            <DataTable table={table} height="auto" />
          </div>
        )}
      </Section>
      <CaseSheet row={open} onClose={() => setOpen(null)} />
    </div>
  )
}

export function ExprC07Scenario({ shotState }: ScenarioProps): ReactElement {
  const name = useFixtureName()
  const rows = buildCases(name)
  if (shotState === 'error') {
    return (
      <Page area="expr-c07">
        <QueryState phase={{ tag: 'error', message: ERROR_MESSAGE, retry: noop }} tier="page" />
      </Page>
    )
  }
  if (shotState === 'empty') {
    return (
      <Page area="expr-c07">
        <div className="flex flex-col gap-6 pt-4">
          <PageSummary
            sentence="0 cases scored in this run"
            facts={[`Run of ${RUN_LABEL}`, `Baseline of ${BASELINE_LABEL}`]}
          />
          <EmptyState
            why={EMPTY_CAUSE}
            action={{ label: 'Rerun the eval', onSelect: noop }}
            tier="page"
          />
        </div>
      </Page>
    )
  }
  return (
    <Page area="expr-c07">
      <Body rows={rows} loading={shotState === 'loading'} />
    </Page>
  )
}
