import { useRender } from '@base-ui/react/use-render'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import { useId } from 'react'
import type { ComponentProps, ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { resolvePhase } from '../core/phase'
import type { Empty, ErrorKind, FrameState } from '../core/phase'
import { PhaseBoundary } from '../core/phase-boundary'
import type { Box, BoxSlot, IconComponent } from '../core/ports'

/**
 * The `Card` cva table: the ringed card surface. `flush` drops the padding so a band or an inset
 * region can run edge to edge.
 *
 * @example
 * cardVariants({ flush: true }) // class string for a non-`Card` element
 */
export const cardVariants = cva(
  'flex flex-col overflow-clip rounded-card bg-card text-foreground shadow-card [--card-edge:1rem] @max-narrow:[--card-edge:0.75rem]',
  {
    variants: {
      flush: {
        true: 'p-0',
        false: 'p-4',
      },
    },
    defaultVariants: { flush: false },
  },
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const cardParts = [
  'card',
  'card-band',
  'card-info',
  'icon-tile',
  'inset',
  'card-phase',
] as const

export type CardProps = Omit<useRender.ComponentProps<'div'>, 'className'> &
  VariantProps<typeof cardVariants> & {
    /** Layout only (`w-full`, `col-span-2`, `mt-4`). Display and padding belong to `flush`. */
    className?: string
  }

/**
 * The base card: a surface with a radius and a ring. Works with no provider; polymorphism only
 * through `render`.
 *
 * @example
 * <Card>Revenue</Card>
 * <Card flush render={<section aria-label="Orders" />}>…</Card>
 */
export function Card({ flush, className, render, ref, ...props }: CardProps): ReactElement {
  return useRender({
    render,
    ref,
    defaultTagName: 'div',
    props: {
      ...props,
      'data-slot': 'card',
      'data-surface': 'card',
      className: cn(cardVariants({ flush }), className),
    },
  })
}

// ── Card parts ───────────────────────────────────────────────────────────────────────────────────

type PartProps<E extends 'div' | 'span'> = Omit<ComponentProps<E>, 'className'> & {
  /** Layout only (`w-full`, `col-span-2`, `mt-4`). */
  className?: string
}

/**
 * A recessed region of a card. It owns the shared left edge (`--card-edge`) and takes the inset
 * surface role.
 *
 * @example
 * <Card flush><CardBand title="Shipped" /><Inset>…</Inset></Card>
 */
export function Inset({ className, ...props }: PartProps<'div'>): ReactElement {
  return (
    <div
      {...props}
      data-slot="inset"
      data-surface="inset"
      className={cn('bg-inset px-(--card-edge) py-3', className)}
    />
  )
}

/**
 * The neutral tile behind a band icon. It has no tone: colour belongs to a verdict, not to a card.
 *
 * @example
 * <IconTile><GitMerge className="size-icon" aria-hidden /></IconTile>
 */
export function IconTile({ className, ...props }: PartProps<'span'>): ReactElement {
  return (
    <span
      aria-hidden="true"
      {...props}
      data-slot="icon-tile"
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-ctrl bg-selected text-muted-foreground',
        className,
      )}
    />
  )
}

/** The CSS-ident-safe form of a `useId` value, for the popover's anchor name. */
const identOf = (id: string): string => id.replace(/[^\w-]/g, '')

export type CardInfoProps = Omit<ComponentProps<'button'>, 'className' | 'children' | 'type'> & {
  /** Layout only. */
  className?: string
  /** Names the glyph button for assistive tech (`About Shipped`). */
  label: string
  /** The definition: one sentence on what the card measures. */
  children: ReactNode
}

/**
 * The definition glyph: a button that opens a native popover (`popover` + `popovertarget`), so the
 * browser owns Escape, light dismiss and focus return, and no overlay library enters the closure.
 * Click opens it, never hover.
 *
 * @example
 * <CardInfo label="About Shipped">Merged pull requests in the range.</CardInfo>
 */
export function CardInfo({ label, children, className, ...props }: CardInfoProps): ReactElement {
  const id = useId()
  const anchor = `--card-info-${identOf(id)}`
  return (
    <>
      <button
        type="button"
        aria-label={label}
        {...props}
        data-slot="card-info"
        popoverTarget={id}
        style={{ anchorName: anchor }}
        className={cn(
          'relative z-10 inline-flex border-0 bg-transparent p-0 size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground focus-ring after:absolute after:inset-0 pointer-coarse:after:-inset-2.5',
          className,
        )}
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
        className="w-max max-w-[min(20rem,calc(100vw-2rem))] rounded-inset border-0 outline-none bg-popover p-3 text-xs text-foreground shadow-overlay supports-[position-area:bottom]:m-2 supports-[position-area:bottom]:[position-area:bottom_span-right] supports-[position-area:bottom]:[position-try-fallbacks:flip-inline,flip-block]"
      >
        {children}
      </div>
    </>
  )
}

export type CardBandProps = Omit<PartProps<'div'>, 'title' | 'children'> & {
  icon?: IconComponent
  title: string
  subtitle?: string
  /** The definition behind the glyph: one sentence on what the card measures. */
  info?: string
  /** Trailing controls; a menu or a filter slot. */
  end?: ReactNode
}

/**
 * The header row every frame shares: `icon`, `title`, `subtitle`, `info` and `end` on the card's
 * left edge.
 *
 * @example
 * <CardBand icon={GitMerge} title="Shipped" subtitle="vs last week" info="Merged pull requests." />
 */
export function CardBand({
  icon: Icon,
  title,
  subtitle,
  info,
  end,
  className,
  ...props
}: CardBandProps): ReactElement {
  return (
    <div
      {...props}
      data-slot="card-band"
      className={cn('flex min-w-0 items-center gap-2 px-(--card-edge) py-3', className)}
    >
      {Icon !== undefined && (
        <IconTile>
          <Icon className="size-icon" aria-hidden="true" />
        </IconTile>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1">
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          {info !== undefined && <CardInfo label={`About ${title}`}>{info}</CardInfo>}
        </div>
        {subtitle !== undefined && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {end !== undefined && <div className="ml-auto flex shrink-0 items-center gap-2">{end}</div>}
    </div>
  )
}

// ── Phase ────────────────────────────────────────────────────────────────────────────────────────

const ACTION =
  'relative inline-flex h-6 cursor-pointer items-center rounded-ctrl bg-secondary px-2 text-xs font-medium text-foreground shadow-raised hover:bg-accent focus-ring after:absolute after:inset-x-0 after:top-1/2 after:h-full after:-translate-y-1/2 pointer-coarse:after:min-h-11'

const ERROR_TEXT: Record<ErrorKind | 'default', string> = {
  forbidden: 'You do not have access to this.',
  'not-found': 'This no longer exists.',
  default: 'Could not load this.',
}

function ErrorArm({
  kind,
  message,
  retry,
  caught = false,
}: {
  kind?: ErrorKind | undefined
  message?: string | undefined
  retry?: (() => void) | undefined
  caught?: boolean
}): ReactElement {
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
      {retry !== undefined && (
        <button type="button" className={ACTION} onClick={retry}>
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

function Skeleton({ shape }: { shape: CardPhaseProps['skeleton'] }): ReactElement {
  const bar = 'animate-pulse rounded-chip bg-foreground/10 motion-reduce:animate-none'
  if (shape !== undefined && 'rows' in shape) {
    return (
      <div aria-hidden="true" className="flex h-full flex-col gap-2 px-(--card-edge) py-3">
        {Array.from({ length: shape.rows }, (_, i) => (
          <div key={i} className={cn(bar, 'h-4')} />
        ))}
      </div>
    )
  }
  return (
    <div aria-hidden="true" className="h-full px-(--card-edge) py-3">
      {/* theme-allow raw-html-layout — a per-instance box height is data, not a class */}
      <div className={cn(bar, 'h-full min-h-4')} style={{ height: shape?.height }} />
    </div>
  )
}

/** Calls the box slot as a component, so a throw lands in the boundary and not in the card. */
function Slot({ body, box }: { body: ReactNode | BoxSlot; box: Box }): ReactNode {
  return typeof body === 'function' ? body(box) : body
}

export type CardPhaseProps = FrameState & {
  /** The box height the body gets and every other phase holds; `fill` takes the card's remainder. */
  height?: number | 'fill'
  /** The loading shape, at the final box. Default: one block filling the box. */
  skeleton?: { rows: number } | { height: number }
  /**
   * The body. A box slot is called with the box only in `ready` and `stale`, so a loading, error or
   * empty card never runs it.
   */
  children: ReactNode | BoxSlot
  className?: string
}

/**
 * Renders the phase for every frame: the skeleton, the error arm, the empty arm and the stale line
 * around the body, inside one box. A throwing box slot renders the error arm and leaves the
 * neighbouring cards alone; Retry runs the slot again.
 *
 * @example
 * <CardPhase phase={query} empty={rows.length ? null : { cause: 'No merges yet' }} height={72}>
 *   {(box) => <Sparkline series={rows} height={box.height} ariaLabel="Shipped per day" />}
 * </CardPhase>
 */
export function CardPhase({
  phase,
  empty,
  height = 'fill',
  skeleton,
  children,
  className,
}: CardPhaseProps): ReactElement {
  const resolved = resolvePhase({ phase, empty })
  const box: Box = { height, phase: resolved.tag === 'stale' ? 'stale' : 'ready' }
  return (
    <div
      data-slot="card-phase"
      data-phase={resolved.tag}
      aria-busy={resolved.tag === 'loading' || undefined}
      style={typeof height === 'number' ? { height } : undefined}
      className={cn(
        'relative min-w-0',
        height === 'fill' ? 'min-h-24 flex-1' : 'shrink-0 overflow-clip',
        className,
      )}
    >
      {resolved.tag === 'loading' && <Skeleton shape={skeleton} />}
      {resolved.tag === 'error' && (
        <ErrorArm kind={resolved.kind} message={resolved.message} retry={resolved.retry} />
      )}
      {resolved.tag === 'empty' && <EmptyArm empty={resolved.empty} />}
      {resolved.body && (
        <>
          <PhaseBoundary fallback={({ reset }) => <ErrorArm retry={reset} caught />}>
            <Slot body={children} box={box} />
          </PhaseBoundary>
          {resolved.tag === 'stale' && (
            <output className="absolute top-0 right-(--card-edge) rounded-chip bg-card px-1.5 text-micro text-muted-foreground">
              {resolved.refreshFailed ? 'Could not refresh. Showing earlier data.' : 'Updating'}
            </output>
          )}
        </>
      )}
    </div>
  )
}
