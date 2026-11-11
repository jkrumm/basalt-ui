import { useId } from 'react'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import type { ControlsSlot, IconComponent, Status } from '../core/ports'
import { CardInfo, IconTile } from '../ui/card'
import type { Fact, FootFacts, MenuAction } from './contract'

const NUMBER = new Intl.NumberFormat('en')

/** Numbers print in one locale and one grouping; a non-finite number is absent, never `NaN`. */
export function formatValue(value: number | string | null): string | null {
  if (value === null) return null
  if (typeof value === 'string') return value
  return Number.isFinite(value) ? NUMBER.format(value) : null
}

const DOT: Record<Status['tone'], string> = {
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
  info: 'bg-info',
  accent: 'bg-brand',
  neutral: 'bg-muted-foreground',
}

/** The verdict home: a dot and a word. The dot is never the only carrier. */
export function StatusMark({ status }: { status: Status }): ReactElement {
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

/** The footer band: at most two facts as a definition list on the card's left edge. */
export function StatFooter({ facts }: { facts: FootFacts | undefined }): ReactElement | null {
  const shown: Fact[] = []
  for (const fact of facts ?? []) if (fact) shown.push(fact)
  if (shown.length === 0) return null
  return (
    <dl
      data-slot="stat-footer"
      className="m-0 flex h-9 items-center gap-4 px-(--card-edge) text-xs"
    >
      {shown.map((fact) => (
        <div key={fact.label} className="flex min-w-0 items-baseline gap-1.5">
          <dt className="text-muted-foreground">{fact.label}</dt>
          <dd className="m-0 font-medium text-foreground tabular-nums">
            {typeof fact.value === 'number' ? NUMBER.format(fact.value) : fact.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

const identOf = (id: string): string => id.replace(/[^\w-]/g, '')

const ITEM =
  'flex h-8 w-full cursor-pointer items-center rounded-ctrl border-0 bg-transparent px-2 text-left text-sm text-foreground no-underline hover:bg-accent focus-ring pointer-coarse:min-h-11'

/**
 * The card menu: a button that opens a native popover of actions. No overlay library, so the
 * chartless card keeps its size; the browser owns Escape, light dismiss and focus return.
 */
export function StatMenu({
  actions,
  label,
}: {
  actions: readonly MenuAction[]
  label: string
}): ReactElement {
  const id = useId()
  const anchor = `--stat-menu-${identOf(id)}`
  const close = (): void => document.getElementById(id)?.hidePopover()
  return (
    <>
      <button
        type="button"
        aria-label={label}
        data-slot="stat-menu"
        popoverTarget={id}
        style={{ anchorName: anchor }}
        className="relative z-10 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted-foreground hover:bg-accent hover:text-foreground focus-ring after:absolute after:inset-0 pointer-coarse:after:-inset-2.5"
      >
        <svg viewBox="0 0 16 16" className="size-icon" fill="currentColor" aria-hidden="true">
          <circle cx="3.5" cy="8" r="1.25" />
          <circle cx="8" cy="8" r="1.25" />
          <circle cx="12.5" cy="8" r="1.25" />
        </svg>
      </button>
      {/* theme-allow hidden-inline-style — the anchor name is unique per instance, so it cannot be a class */}
      <div
        id={id}
        popover="auto"
        style={{ positionAnchor: anchor }}
        className="m-0 min-w-40 rounded-inset border-0 bg-popover p-1 text-foreground shadow-overlay supports-[position-area:bottom]:m-2 supports-[position-area:bottom]:[position-area:bottom_span-left] supports-[position-area:bottom]:[position-try-fallbacks:flip-block]"
      >
        {actions.map((action) =>
          'href' in action ? (
            <a key={action.label} href={action.href} className={ITEM}>
              {action.label}
            </a>
          ) : (
            <button
              key={action.label}
              type="button"
              className={ITEM}
              onClick={() => {
                close()
                action.onSelect()
              }}
            >
              {action.label}
            </button>
          ),
        )}
      </div>
    </>
  )
}

export type StatHeadProps = {
  title: string
  subtitle: string | undefined
  icon: IconComponent | undefined
  info: string | undefined
  controls: ControlsSlot | undefined
  menu: readonly MenuAction[] | undefined
}

/**
 * The header band: icon tile, title, definition glyph, subtitle, controls and menu on the card's
 * left edge. Below `@regular` the controls wrap to a second row of the band; they are rendered
 * once, so a bound control is never a CSS twin of itself.
 */
export function StatHead({
  title,
  subtitle,
  icon: Icon,
  info,
  controls,
  menu,
}: StatHeadProps): ReactElement {
  return (
    <div
      data-slot="card-band"
      className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2 px-(--card-edge) py-3"
    >
      {Icon !== undefined && (
        <IconTile>
          <Icon className="size-icon" aria-hidden="true" />
        </IconTile>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex h-6 min-w-0 items-center gap-1">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          {info !== undefined && <CardInfo label={`About ${title}`}>{info}</CardInfo>}
        </div>
        {subtitle !== undefined && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {controls !== undefined && (
        <div
          data-slot="stat-controls"
          className="relative z-10 order-1 flex w-full items-center gap-2 @regular:order-none @regular:w-auto"
        >
          {controls.render()}
        </div>
      )}
      {menu !== undefined && <StatMenu actions={menu} label={`Actions for ${title}`} />}
    </div>
  )
}
