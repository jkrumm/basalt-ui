import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { CardMenu } from '../core/card-menu'
import { cards } from '../core/messages/cards'
import { useMessages } from '../core/messages/use-messages'
import type { ControlsSlot, IconComponent, Verdict } from '../core/ports'
import { CardInfo, IconTile } from '../ui/card'
import type { Fact, FootFacts, MenuEntry } from './contract'

const NUMBER = new Intl.NumberFormat('en')

/** Numbers print in one locale and one grouping; a non-finite number is absent, never `NaN`. */
export function formatValue(value: number | string | null): string | null {
  if (value === null) return null
  if (typeof value === 'string') return value
  return Number.isFinite(value) ? NUMBER.format(value) : null
}

/** The stale line a stat card or cell prints: still updating, or a refetch that failed. */
export function useStaleText(refreshFailed: boolean): string {
  const t = useMessages(cards)
  return refreshFailed ? t('cards.refreshFailed') : t('cards.updating')
}

const BAR = 'animate-pulse rounded-chip bg-foreground/10 motion-reduce:animate-none'

const DOT: Record<Verdict['tone'], string> = {
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
  info: 'bg-info',
  accent: 'bg-brand',
  neutral: 'bg-muted-foreground',
}

/** The verdict home: a dot and a word. The dot is never the only carrier. */
export function StatusMark({ status }: { status: Verdict }): ReactElement {
  return (
    <span
      data-slot="stat-status"
      data-tone={status.tone}
      className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
    >
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', DOT[status.tone])} />
      {status.label}
    </span>
  )
}

/**
 * The footer on the shell: at most two facts, a muted label and a semibold value each, spread
 * across the width from the card's left edge. While the card loads a value is a bar, and once it
 * failed a muted dash: no figure shows beside a state that says there is none. The labels stay, and
 * the row keeps its height.
 */
export function StatFooter({
  facts,
  phase,
}: {
  facts: FootFacts | undefined
  phase: 'loading' | 'error' | 'empty' | 'other'
}): ReactElement | null {
  const shown: Fact[] = []
  for (const fact of facts ?? []) if (fact) shown.push(fact)
  if (shown.length === 0) return null
  const dashed = phase === 'error' || phase === 'empty'
  return (
    <dl
      data-slot="stat-footer"
      className="m-0 mt-auto flex h-10 items-center justify-between gap-4 px-(--card-edge) text-sm"
    >
      {shown.map((fact) => (
        <div key={fact.label} className="flex min-w-0 items-baseline gap-2">
          <dt className="truncate text-muted-foreground">{fact.label}</dt>
          <dd
            data-state={phase === 'other' ? undefined : phase}
            data-monospace={fact.mono === true ? '' : undefined}
            className={cn(
              'm-0 text-md font-semibold tabular-nums',
              fact.mono === true && 'font-mono',
              dashed ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {phase === 'loading' ? (
              <span aria-hidden="true" className={cn(BAR, 'block h-3 w-10')} />
            ) : dashed ? (
              '–'
            ) : typeof fact.value === 'number' ? (
              NUMBER.format(fact.value)
            ) : (
              fact.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export type StatHeadProps = {
  title: string
  subtitle: string | undefined
  icon: IconComponent | undefined
  info: string | undefined
  controls: ControlsSlot | undefined
  menu: readonly MenuEntry[] | undefined
  contextMenu: boolean | undefined
}

/**
 * The header on the shell: a 32 px icon tile, a semibold title, the definition glyph, a muted
 * subtitle, controls and the menu, on the card's left edge. Below `@regular` the controls wrap to a
 * second row; they are rendered once, so a bound control is never a CSS twin of itself.
 */
export function StatHead({
  title,
  subtitle,
  icon: Icon,
  info,
  controls,
  menu,
  contextMenu,
}: StatHeadProps): ReactElement {
  return (
    <div
      data-slot="card-band"
      className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 px-(--card-edge) pt-3 pb-2"
    >
      {Icon !== undefined && (
        <IconTile>
          <Icon className="size-icon" aria-hidden="true" />
        </IconTile>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex h-5 min-w-0 items-center gap-1">
          <p className="truncate text-md font-semibold tracking-tight text-foreground">{title}</p>
          {info !== undefined && (
            <CardInfo label={`About ${title}`} className="relative z-20 -my-0.5">
              {info}
            </CardInfo>
          )}
        </div>
        {subtitle !== undefined && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {controls !== undefined && (
        <div
          data-slot="stat-controls"
          className="relative z-20 order-1 flex w-full flex-wrap items-center gap-2 @regular:order-none @regular:w-auto @regular:shrink-0"
        >
          {controls.render()}
        </div>
      )}
      {menu !== undefined && (
        <CardMenu menu={menu} label={`Actions for ${title}`} contextMenu={contextMenu !== false} />
      )}
    </div>
  )
}

/**
 * The loading anatomy, in the rows the ready card draws: a figure and its pill, a sub line, and a
 * plot over its label row. Every row has the ready row's height, so the card never moves.
 */
export function StatSkeleton({ sub, chart }: { sub: boolean; chart: boolean }): ReactElement {
  return (
    <div data-slot="stat-skeleton" aria-hidden="true" className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2">
        <div className={cn(BAR, 'h-7 w-24')} />
        <div className={cn(BAR, 'h-6 w-14 rounded-full')} />
      </div>
      {sub && (
        <div className="flex h-5 shrink-0 items-center @max-narrow:hidden">
          <div className={cn(BAR, 'h-3 w-40 max-w-full')} />
        </div>
      )}
      {chart && (
        <div className="mt-2 flex h-(--chart-h) shrink-0 flex-col gap-1">
          <div className={cn(BAR, 'flex-1')} />
          <div className="flex h-3 shrink-0 justify-between">
            <div className={cn(BAR, 'w-10')} />
            <div className={cn(BAR, 'w-10')} />
            <div className={cn(BAR, 'w-10')} />
          </div>
        </div>
      )}
    </div>
  )
}
