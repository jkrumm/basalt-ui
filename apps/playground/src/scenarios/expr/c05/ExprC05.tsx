/**
 * c05 — a legal ops lead plans the year: which contracts need a notice soon, which renew on their
 * own. One row per contract, ordered by notice deadline, on a shared twelve-month track that starts
 * today: a round mark is the last day to give notice, a square mark is the renewal (filled when it
 * renews on its own, hollow when it only renews if someone acts). A dashed rule marks the 60-day
 * limit; a notice that closed sits hollow in a shaded 30-day window before the today line, at its
 * true date. The card's figure and a sticky readout line above the card follow focus.
 */
import { useRouterState } from '@tanstack/react-router'
import { ChartCard, useChartFocus } from 'basalt-ui/charts'
import { date, money } from 'basalt-ui/format'
import { Skeleton } from 'basalt-ui/ui/skeleton'
import { cardStateProps, retryCopy } from '../../shot-state'
import type { ScenarioProps } from '../../shot-state'
import classes from './ExprC05.module.css'
import { FIXTURE_NAMES, HORIZON_DAYS, SOON_DAYS, TODAY, dayNumber, fixtureFor } from './fixture'
import type { Contract, FixtureName } from './fixture'

const EMPTY_COPY =
  'No contracts are in the register yet. Import them from the contract system to see notice dates.'
const SKELETON_ROWS = 12
const REST_HINT = 'Arrow keys step through the contracts; the readout follows the focused row.'
const PAST_DAYS = 30
const TONE = { soon: 'warn', passed: 'bad', later: 'muted' } as const

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// Quarter starts inside the horizon; the first label also names its year.
const TICKS = ['2027-04-01', '2027-07-01', '2027-10-01'] as const

// One decimal at millions and thousands: `1.2M`, `96.5K`.
const eur = (value: number): string => money(value, { currency: 'EUR', compact: true })

// ── geometry and reading (glue) ─────────────────────────────────────────────────────────────────

const TODAY_DAY = dayNumber(TODAY)
const daysUntil = (iso: string): number => dayNumber(iso) - TODAY_DAY
/** Percent along the track: 30 shaded days before today, then the 12-month horizon. */
const pctOfDays = (days: number): number =>
  Math.min(100, Math.max(0, ((days + PAST_DAYS) / (HORIZON_DAYS + PAST_DAYS)) * 100))
const pct = (iso: string): number => pctOfDays(daysUntil(iso))
const TODAY_PCT = pctOfDays(0)
const SOON_PCT = pctOfDays(SOON_DAYS)
const left = (percent: number): { left: string } => ({ left: `${percent}%` })
// cycle-expression-2: basalt-ui/format has no month-only tick label, so the axis names its months
const tickLabel = (iso: string, first: boolean): string => {
  const [y = '', m = '1'] = iso.split('-')
  return `${MONTHS[Number(m) - 1] ?? ''}${first ? ` ${y}` : ''}`
}

type Urgency = 'passed' | 'soon' | 'later'
const urgencyOf = (c: Contract): Urgency => {
  const days = daysUntil(c.notice)
  if (days < 0) return 'passed'
  return days <= SOON_DAYS ? 'soon' : 'later'
}

function noticeLine(c: Contract): string {
  const days = daysUntil(c.notice)
  if (days < 0) return `Notice closed ${-days} d ago`
  if (days === 0) return 'Notice due today'
  return `Notice in ${days} d`
}

const renewalLine = (c: Contract): string =>
  c.autoRenew ? `Auto-renews ${date(c.renewal)}` : `Term ends ${date(c.renewal)}`

const readFixtureName = (searchStr: string): FixtureName => {
  const raw = new URLSearchParams(searchStr).get('fixture')
  return FIXTURE_NAMES.find((n) => n === raw) ?? 'default'
}

// ── parts ───────────────────────────────────────────────────────────────────────────────────────

const item = (swatch: string, label: string) => (
  <span className={classes.legendItem}>
    <span className={swatch} aria-hidden="true" />
    {label}
  </span>
)

function Legend() {
  return (
    <div className={classes.legend}>
      {item(classes.legendDot, 'Notice date')}
      {item(`${classes.legendDot} ${classes.soon}`, `Due within ${SOON_DAYS} d`)}
      {item(`${classes.legendDot} ${classes.passed}`, 'Notice closed')}
      {item(`${classes.legendSquare} ${classes.auto}`, 'Auto-renews')}
      {item(classes.legendSquare, 'Manual renewal')}
    </div>
  )
}

function AxisRow() {
  return (
    <div className={`${classes.row} ${classes.axis}`} aria-hidden="true">
      <div className={classes.axisTrack}>
        {/* theme-allow hidden-inline-style — a label sits at a date's position */}
        <span className={classes.tickLabel} style={left(TODAY_PCT)}>
          Today
        </span>
        {/* theme-allow hidden-inline-style — the label heads the dashed limit rule */}
        <span className={`${classes.tickLabel} ${classes.limitLabel}`} style={left(SOON_PCT)}>
          {SOON_DAYS} d
        </span>
        {TICKS.map((iso, i) => (
          // theme-allow hidden-inline-style — a label sits at a date's position
          <span key={iso} className={classes.tickLabel} style={left(pct(iso))}>
            {tickLabel(iso, i === 0)}
          </span>
        ))}
      </div>
    </div>
  )
}

function Track({ c, note }: { c: Contract; note: string | null }) {
  const urgency = urgencyOf(c)
  const from = pct(c.notice)
  const to = pct(c.renewal)
  return (
    <div className={classes.track} aria-hidden="true">
      {/* theme-allow raw-html-layout — the shaded window's width is the share of the track before today; cycle-expression-2: no kit time-lane to own it */}
      <span className={classes.pastZone} style={{ width: `${TODAY_PCT}%` }} />
      {/* theme-allow hidden-inline-style — the today line sits at day 0 */}
      <span className={classes.todayLine} style={left(TODAY_PCT)} />
      {TICKS.map((iso) => (
        // theme-allow hidden-inline-style — a gridline sits at a date's position
        <span key={iso} className={classes.tick} style={left(pct(iso))} />
      ))}
      {/* theme-allow hidden-inline-style — the limit rule sits at the soon horizon */}
      <span className={classes.limit} style={left(SOON_PCT)} />
      {/* theme-allow raw-html-layout — the connector's span is notice to renewal in data; cycle-expression-2: no kit time-lane to own it */}
      <span className={classes.link} style={{ left: `${from}%`, width: `${to - from}%` }} />
      {/* theme-allow hidden-inline-style — the marks sit at their dates */}
      <span
        className={`${classes.mark} ${classes.notice} ${urgency === 'later' ? '' : classes[urgency]} ${urgency === 'passed' ? classes.past : ''}`}
        style={left(from)}
      />
      {/* theme-allow hidden-inline-style — the marks sit at their dates */}
      <span
        className={`${classes.mark} ${classes.renewal} ${c.autoRenew ? classes.auto : ''}`}
        style={left(to)}
      />
      {note === null ? null : (
        // theme-allow hidden-inline-style — the note clears the renewal mark and the limit rule
        <span className={classes.note} style={{ left: `${Math.max(to, SOON_PCT)}%` }}>
          {note}
        </span>
      )}
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className={classes.row}>
      <div className={classes.name}>
        <span className={`${classes.line} ${classes.title}`}>
          <Skeleton className="w-2/3" />
        </span>
        <span className={`${classes.line} ${classes.meta}`}>
          <Skeleton className="w-1/2" />
        </span>
      </div>
      <div className={classes.track}>
        <Skeleton className="h-3 w-full" />
      </div>
      <div className={classes.status}>
        <span className={`${classes.line} ${classes.title}`}>
          <Skeleton className="w-2/3" />
        </span>
        <span className={`${classes.line} ${classes.meta}`}>
          <Skeleton className="w-1/2" />
        </span>
      </div>
    </div>
  )
}

// ── scenario ────────────────────────────────────────────────────────────────────────────────────

export function ExprC05Scenario({ shotState }: ScenarioProps) {
  // cycle-expression-2: the route's validateSearch drops `fixture`, so the raw search string is read
  const searchStr = useRouterState({ select: (s) => s.location.searchStr })
  const name = readFixtureName(searchStr)
  const rows = fixtureFor(name).toSorted((a, b) => daysUntil(a.notice) - daysUntil(b.notice))
  const focus = useChartFocus(rows, {
    announce: (c) => `${c.vendor}: ${noticeLine(c)}. ${renewalLine(c)}`,
  })

  const soon = rows.filter((c) => urgencyOf(c) === 'soon')
  const lockedIn = rows.filter((c) => urgencyOf(c) === 'passed' && c.autoRenew).length
  const auto = rows.filter((c) => c.autoRenew)
  const autoValue = auto.reduce((sum, c) => sum + c.value, 0)
  const atRisk = soon.filter((c) => c.autoRenew).toSorted((a, b) => b.value - a.value)[0]

  // the empty and error cards carry no figure line, so no readout or basis line either
  const settled = shotState === 'empty' || shotState === 'error'
  return (
    <div data-shot="expr-c05" className={classes.root}>
      {settled ? null : (
        <div className={classes.caption}>
          {focus.readout(REST_HINT, (c) => `${c.vendor} · ${noticeLine(c)} · ${renewalLine(c)}`)}
        </div>
      )}
      <ChartCard
        title="Contract notices"
        subtitle={settled ? undefined : `Next 12 months from ${date(TODAY)}`}
        actions={<Legend />}
        facts={[
          {
            value: focus.readout(`${soon.length} of ${rows.length}`, (c) => c.vendor),
            period: focus.readout(
              `notices due within ${SOON_DAYS} d${lockedIn > 0 ? ` · ${lockedIn} auto-renewal already locked in` : ''}`,
              (c) => noticeLine(c),
            ),
            tone: focus.readout<'warn' | 'bad' | 'muted'>('warn', (c) => TONE[urgencyOf(c)]),
          },
          {
            value: focus.readout(eur(autoValue), (c) => eur(c.value)),
            period: focus.readout(
              `renews on its own · ${auto.length} of ${rows.length} contracts`,
              (c) =>
                `${c.autoRenew ? 'renews on its own' : 'ends unless renewed'} · ${eur(c.value)} a year`,
            ),
          },
        ]}
        {...cardStateProps(shotState, retryCopy('contract register'), 'content', EMPTY_COPY)}
      >
        <div className={classes.board}>
          <AxisRow />
          {shotState === 'loading' ? (
            Array.from({ length: SKELETON_ROWS }, (_, i) => <SkeletonRow key={i} />)
          ) : (
            <div
              {...focus.target}
              className={classes.rows}
              aria-label="Contracts by notice deadline, today to twelve months out"
            >
              {rows.map((c, i) => {
                const urgency = urgencyOf(c)
                return (
                  <div
                    key={c.id}
                    {...focus.item(i)}
                    className={`${classes.row} motion-safe:transition-opacity data-dimmed:opacity-25`}
                  >
                    <div className={classes.name}>
                      <span className={`${classes.line} ${classes.title}`}>{c.vendor}</span>
                      <span className={`${classes.line} ${classes.meta}`}>
                        {eur(c.value)} a year
                      </span>
                    </div>
                    <Track
                      c={c}
                      note={c.id === atRisk?.id ? 'Largest auto-renewal due soon' : null}
                    />
                    <div className={classes.status}>
                      <span className={`${classes.line} ${classes.title}`}>
                        <span
                          className={`${classes.dot} ${urgency === 'later' ? '' : classes[urgency]}`}
                          aria-hidden="true"
                        />
                        {noticeLine(c)}
                      </span>
                      <span className={`${classes.line} ${classes.meta}`}>{renewalLine(c)}</span>
                    </div>
                  </div>
                )
              })}
              {focus.live}
            </div>
          )}
        </div>
      </ChartCard>
    </div>
  )
}
