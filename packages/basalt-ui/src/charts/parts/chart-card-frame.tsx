/**
 * The frame `ChartCard` is drawn on: the card surface, the header band, the inset, the phase arms
 * and the footer, with the classes of `ui/card` and `StatCard` so the two read as one family.
 *
 * It is written here, not imported, because `ui/card` pulls `@base-ui/react/use-render` (the `Card`
 * polymorphism) and `./charts` reaches no Base UI (`check-dist-layering`). Everything else it needs
 * is Base-UI-free: `cn`, `resolvePhase`, `PhaseBoundary`, `DeltaBadge`.
 */
import { useId } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../../core/cn'
import type { Empty, ResolvedPhase } from '../../core/phase'
import { PhaseBoundary } from '../../core/phase-boundary'
import type { BoxSlot, ControlsSlot, IconComponent } from '../../core/ports'
import type { Fact, FootFacts } from '../contract'

const NUMBER = new Intl.NumberFormat('en')

/** Numbers print in one locale and one grouping; a non-finite number is absent, never `NaN`. */
export function formatValue(value: number | string | null): string | null {
  if (value === null) return null
  if (typeof value === 'string') return value
  return Number.isFinite(value) ? NUMBER.format(value) : null
}

/** The card surface (`cardVariants({ flush: true })` of `ui/card`, which this closure cannot import). */
export const SURFACE =
  'flex flex-col overflow-clip rounded-card bg-card p-0 text-foreground shadow-card [--card-edge:1rem] @max-narrow:[--card-edge:0.75rem] [--card-gutter:calc(var(--radius-card)_-_var(--radius-inset))]'

const identOf = (id: string): string => id.replace(/[^\w-]/g, '')

const ACTION =
  'relative inline-flex h-6 cursor-pointer items-center rounded-ctrl bg-secondary px-2 text-xs font-medium text-foreground shadow-raised hover:bg-accent focus-ring after:absolute after:inset-x-0 after:top-1/2 after:h-full after:-translate-y-1/2 pointer-coarse:after:min-h-11'

/** The definition glyph: a button that opens a native popover, so no overlay library is needed. */
function Info({ title, children }: { title: string; children: string }): ReactElement {
  const id = useId()
  const anchor = `--chart-info-${identOf(id)}`
  return (
    <>
      <button
        type="button"
        aria-label={`About ${title}`}
        data-slot="card-info"
        popoverTarget={id}
        style={{ anchorName: anchor }}
        className="relative z-10 -my-0.5 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted-foreground hover:bg-accent hover:text-foreground focus-ring after:absolute after:inset-0 pointer-coarse:after:-inset-2.5"
      >
        <svg viewBox="0 0 16 16" className="size-icon" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 7.25v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="5" r="0.9" fill="currentColor" />
        </svg>
      </button>
      {/* theme-allow hidden-inline-style — the anchor name is unique per instance, so it cannot be a class */}
      <div
        id={id}
        popover="auto"
        tabIndex={-1}
        style={{ positionAnchor: anchor }}
        className="w-max max-w-[min(20rem,calc(100vw-2rem))] rounded-inset border-0 bg-popover p-3 text-xs text-foreground shadow-overlay outline-none supports-[position-area:bottom]:m-2 supports-[position-area:bottom]:[position-area:bottom_span-right] supports-[position-area:bottom]:[position-try-fallbacks:flip-inline,flip-block]"
      >
        {children}
      </div>
    </>
  )
}

const BAR = 'animate-pulse rounded-chip bg-foreground/10 motion-reduce:animate-none'

export type HeadProps = {
  title: string | undefined
  subtitle: string | undefined
  icon: IconComponent | undefined
  info: string | undefined
  controls: ControlsSlot | undefined
  menu: ReactNode
}

/**
 * The header: an icon tile, a semibold title, the definition glyph, a muted subtitle, controls and
 * the menu on the card's left edge. A `loading` card with no title draws a bar of the title's height.
 */
export function Head({
  title,
  subtitle,
  icon: Icon,
  info,
  controls,
  menu,
}: HeadProps): ReactElement {
  return (
    <div
      data-slot="card-band"
      className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 px-(--card-edge) pt-3 pb-2"
    >
      {Icon !== undefined && (
        <span
          aria-hidden="true"
          data-slot="icon-tile"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-ctrl bg-selected text-muted-foreground"
        >
          <Icon className="size-icon" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex h-5 min-w-0 items-center gap-1">
          {title === undefined ? (
            <div aria-hidden="true" className={cn(BAR, 'h-4 w-32')} />
          ) : (
            <p className="truncate text-md font-semibold tracking-tight text-foreground">{title}</p>
          )}
          {title !== undefined && info !== undefined && <Info title={title}>{info}</Info>}
        </div>
        {subtitle !== undefined && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {controls !== undefined && (
        <div
          data-slot="chart-controls"
          className="relative z-10 order-1 flex w-full items-center gap-2 @regular:order-none @regular:w-auto"
        >
          {controls.render()}
        </div>
      )}
      {menu !== undefined && menu !== null && (
        <div data-slot="chart-menu" className="relative z-10 flex shrink-0 items-center">
          {menu}
        </div>
      )}
    </div>
  )
}

/** The footer: at most two facts, a muted label and a semibold value each. */
export function Footer({ facts }: { facts: FootFacts | undefined }): ReactElement | null {
  const shown: Fact[] = []
  for (const fact of facts ?? []) if (fact) shown.push(fact)
  if (shown.length === 0) return null
  return (
    <dl
      data-slot="chart-footer"
      className="m-0 flex h-10 items-center justify-between gap-4 px-(--card-edge) text-sm"
    >
      {shown.map((fact) => (
        <div key={fact.label} className="flex min-w-0 items-baseline gap-2">
          <dt className="truncate text-muted-foreground">{fact.label}</dt>
          <dd className="m-0 text-md font-semibold text-foreground tabular-nums">
            {typeof fact.value === 'number' ? NUMBER.format(fact.value) : fact.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

const ERROR_TEXT = {
  forbidden: 'You do not have access to this.',
  'not-found': 'This no longer exists.',
  default: 'Could not load this.',
} as const

function ErrorArm({
  resolved,
  retry,
  caught = false,
}: {
  resolved?: Extract<ResolvedPhase, { tag: 'error' }>
  retry?: (() => void) | undefined
  caught?: boolean
}): ReactElement {
  const kind = resolved?.kind
  const message = resolved?.message
  const run = retry ?? resolved?.retry
  return (
    <div
      role="alert"
      data-phase={caught ? 'error' : undefined}
      className="flex h-full min-h-24 flex-col items-center justify-center gap-2 px-(--card-edge) py-3 text-center"
    >
      <p className="text-sm text-foreground">{ERROR_TEXT[kind ?? 'default']}</p>
      {message !== undefined && kind === undefined && (
        <p className="text-xs text-muted-foreground">{message}</p>
      )}
      {run !== undefined && (
        <button type="button" className={ACTION} onClick={run}>
          Retry
        </button>
      )}
    </div>
  )
}

function EmptyArm({ empty }: { empty: Empty }): ReactElement {
  const { cause, action, filtered } = empty
  return (
    <div className="flex h-full min-h-24 flex-col items-center justify-center gap-2 px-(--card-edge) py-3 text-center">
      <p className="text-sm text-muted-foreground">{cause}</p>
      {filtered !== undefined ? (
        <button type="button" className={ACTION} onClick={filtered.reset}>
          Clear filters
        </button>
      ) : (
        action !== undefined &&
        ('href' in action ? (
          <a href={action.href} className={ACTION}>
            {action.label}
          </a>
        ) : (
          <button type="button" className={ACTION} onClick={action.onSelect}>
            {action.label}
          </button>
        ))
      )}
    </div>
  )
}

/** The loading plot: one block over a label row, in the box the chart will fill. */
export function PlotSkeleton(): ReactElement {
  return (
    <div data-slot="chart-skeleton" aria-hidden="true" className="flex h-full flex-col gap-1">
      <div className={cn(BAR, 'flex-1')} />
      <div className="flex h-3 shrink-0 justify-between">
        <div className={cn(BAR, 'w-10')} />
        <div className={cn(BAR, 'w-10')} />
        <div className={cn(BAR, 'w-10')} />
      </div>
    </div>
  )
}

/** Calls the box slot as a component, so a throw lands in the boundary and not in the card. */
function Slot({ chart, phase }: { chart: BoxSlot; phase: 'ready' | 'stale' }): ReactNode {
  return chart({ height: 'fill', phase })
}

export type PhaseBoxProps = {
  resolved: ResolvedPhase
  /** `undefined` when the card is a Suspense fallback: there is no chart to call. */
  chart: BoxSlot | undefined
  className: string
}

/**
 * The chart box: one fixed clipping box whose height the card chose, holding the skeleton, the
 * error arm, the empty arm or the chart. The slot is called only in `ready` and `stale`; whatever it
 * draws is clipped, so a taller chart cannot move the card.
 */
export function PhaseBox({ resolved, chart, className }: PhaseBoxProps): ReactElement {
  const phase = resolved.tag === 'stale' ? 'stale' : 'ready'
  return (
    <div
      data-slot="chart-box"
      data-phase={resolved.tag}
      aria-busy={resolved.tag === 'loading' || undefined}
      className={cn('relative flex min-h-0 min-w-0 flex-col overflow-clip', className)}
    >
      {resolved.tag === 'loading' && <PlotSkeleton />}
      {resolved.tag === 'error' && <ErrorArm resolved={resolved} />}
      {resolved.tag === 'empty' && <EmptyArm empty={resolved.empty} />}
      {resolved.body && chart !== undefined && (
        <>
          <PhaseBoundary fallback={({ reset }) => <ErrorArm retry={reset} caught />}>
            <div className="min-h-0 flex-1 [&>[data-basalt-chart]]:h-full">
              <Slot chart={chart} phase={phase} />
            </div>
          </PhaseBoundary>
          {resolved.tag === 'stale' && (
            <output className="absolute top-0 right-0 rounded-chip bg-card px-1.5 text-micro text-muted-foreground">
              {resolved.refreshFailed ? 'Could not refresh. Showing earlier data.' : 'Updating'}
            </output>
          )}
        </>
      )}
    </div>
  )
}
