import { useContext, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactElement, RefObject } from 'react'
import { HostTitleContext } from '../core/could-not-load'
import { cn } from '../core/cn'
import { useMessages } from '../core/messages/use-messages'
import { cards } from '../core/messages/cards'
import { CardMenu } from '../core/card-menu'
import { Card, CardInfo, CardPhase, IconTile, Inset } from '../ui/card'
import type { DataPanelProps, LegendEntry } from './contract'
import {
  FrameDepthContext,
  MAX_DEPTH,
  MAX_INLINE_CONTROLS,
  useAboutLabel,
  warnOnce,
} from './stat-group-shared'

/** One skeleton or body row of a `{ rows }` panel: 32 px and an 8 px gap. */
const ROW = 32
const GAP = 8

/**
 * The phase arms (error, empty) are laid out for 96 px, so a panel never draws a body shorter than
 * that, whatever `bodySize` asks for.
 */
const MIN_BODY = 96

/** The body box height `bodySize` declares. The loading, error, empty and ready body all hold it. */
const bodyHeightOf = (size: DataPanelProps['bodySize']): number => {
  const px =
    'rows' in size
      ? Math.max(0, Math.round(size.rows)) * (ROW + GAP) - GAP
      : Math.round(size.height)
  return Math.max(MIN_BODY, px)
}

/**
 * A `{ rows }` body shows whole rows: when its table's rows run past the declared height, the box
 * is cut after the last row that fits, so no row is clipped through its text. The measure reads the
 * rows against the declared height, never the snapped one, so it holds under a resize and a refetch;
 * the snapped height is kept through the loading, empty and error arms, so a panel that has shown
 * its rows keeps their height. Bodies that draw no table rows keep the declared height.
 */
function useWholeRows(
  enabled: boolean,
  declared: number,
): { ref: RefObject<HTMLDivElement | null>; height: number } {
  const ref = useRef<HTMLDivElement | null>(null)
  const [snapped, setSnapped] = useState<number | undefined>(undefined)
  useLayoutEffect(() => {
    const box = ref.current?.querySelector('[data-slot="card-phase"]')
    if (!enabled || !(box instanceof HTMLElement)) return undefined
    const measure = (): void => {
      const rows = box.querySelectorAll('tbody [data-slot="table-row"]')
      if (rows.length === 0) return
      const top = box.getBoundingClientRect().top
      let fit: number | undefined
      let last = 0
      for (const row of rows) {
        last = row.getBoundingClientRect().bottom - top
        if (last <= declared + 0.5) fit = last
      }
      setSnapped(last <= declared + 0.5 || fit === undefined ? undefined : Math.ceil(fit))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    for (const child of box.children) observer.observe(child)
    return () => observer.disconnect()
  })
  return { ref, height: snapped === undefined ? declared : Math.max(MIN_BODY, snapped) }
}

const BAR = 'animate-pulse rounded-chip bg-foreground/10 motion-reduce:animate-none'

function PanelSkeleton({ size }: { size: DataPanelProps['bodySize'] }): ReactElement {
  if ('rows' in size) {
    return (
      <div aria-hidden="true" className="flex h-full flex-col gap-2 overflow-clip">
        {Array.from({ length: Math.max(0, Math.round(size.rows)) }, (_, i) => (
          <div key={i} className={cn(BAR, 'h-8 shrink-0')} />
        ))}
      </div>
    )
  }
  return (
    <div aria-hidden="true" className="h-full">
      <div className={cn(BAR, 'h-full')} />
    </div>
  )
}

/** The legend row of a card: one swatch and label per entry, under the header. `BarList` draws it too. */
export function Legend({ entries }: { entries: readonly LegendEntry[] }): ReactElement {
  const t = useMessages(cards)
  return (
    <ul
      data-slot="data-panel-legend"
      // The explicit role is deliberate: `list-style: none` makes Safari drop the implicit one.
      // oxlint-disable-next-line jsx-a11y/no-redundant-roles
      role="list"
      className="m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-1 px-(--card-edge) pb-2 text-xs text-muted-foreground"
    >
      {entries.map((entry) => (
        <li key={entry.key} className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden="true"
            style={
              {
                '--swatch-light': entry.color.light,
                '--swatch-dark': entry.color.dark,
              } as CSSProperties
            }
            className={cn(
              'shrink-0',
              entry.swatch === 'dashed'
                ? 'h-0 w-3 border-t-2 border-dashed border-(color:--swatch-light) dark:border-(color:--swatch-dark)'
                : 'size-2 rounded-xs bg-(--swatch-light) dark:bg-(--swatch-dark)',
              entry.failed === true && 'opacity-40',
            )}
          />
          <span className="truncate">
            {entry.failed === true ? `${entry.label} (${t('cards.unavailable')})` : entry.label}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * The panel header: an icon tile, the title and its definition glyph, a subtitle, the inline controls
 * and the menu, on the card's left edge. Below `@regular` the controls wrap to a second row; they are
 * rendered once, so a bound control is never a CSS twin of itself.
 */
function PanelHead(
  props: Pick<DataPanelProps, 'title' | 'subtitle' | 'icon' | 'info' | 'controls' | 'menu'>,
): ReactElement {
  const { title, subtitle, icon: Icon, info, controls, menu } = props
  const about = useAboutLabel()
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
            <CardInfo label={about(title)} className="-my-0.5">
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
          data-slot="data-panel-controls"
          className="order-1 flex w-full flex-wrap items-center gap-2 @regular:order-none @regular:w-auto @regular:shrink-0"
        >
          {controls.render()}
        </div>
      )}
      {menu !== undefined && (
        <div data-slot="data-panel-menu" className="flex shrink-0 items-center">
          <CardMenu menu={menu} label={`Actions for ${title}`} />
        </div>
      )}
    </div>
  )
}

/**
 * The frame for a body that is not a chart: the same header and phase handling as the other cards,
 * around a table, a list or a board. The body is one box slot at a fixed height, declared by the
 * required `bodySize`, so a loading, empty or error panel is as tall as a ready one and
 * the body is called only in `ready` and `stale`. A `{ rows }` body whose table rows run past
 * the declared height shows whole rows: the box is cut after the last row that fits, and the
 * panel keeps that height through the other phases. The box clips with `overflow: clip`, never
 * `hidden`, so a table head that sticks to the page keeps sticking.
 *
 * @useWhen a page needs the card frame around a table, a row list or a board, with a header, controls and a legend
 * @neverWhen the body is a chart (use a chart card) or a single figure (use a stat card or a stat cell)
 *
 * @example
 * <DataPanel
 *   title="Open pull requests"
 *   subtitle="by age"
 *   phase={query}
 *   empty={rows.length ? null : { cause: 'Nothing open' }}
 *   bodySize={{ rows: 6 }}
 *   body={(box) => <PullTable rows={rows} height={box.height} />}
 * />
 */
export function DataPanel(props: DataPanelProps): ReactElement {
  const { title, controls, toolbar, legend } = props
  const { phase, empty, bodySize, body } = props
  const depth = useContext(FrameDepthContext)
  if (controls !== undefined && controls.count > MAX_INLINE_CONTROLS) {
    warnOnce(
      'controls',
      `DataPanel "${title}" has ${controls.count} inline controls (over ${MAX_INLINE_CONTROLS}). Move the filters to the toolbar.`,
    )
  }
  if (depth >= MAX_DEPTH) {
    warnOnce(
      'depth',
      `DataPanel "${title}" sits ${depth} frames deep (over ${MAX_DEPTH}). Lay the frames out side by side instead of nesting them.`,
    )
  }
  const declared = bodyHeightOf(bodySize)
  const { ref: insetRef, height } = useWholeRows('rows' in bodySize, declared)
  return (
    <div data-slot="data-panel" className="@container min-w-0">
      <Card flush>
        <PanelHead {...props} />
        {toolbar !== undefined && (
          <div
            data-slot="data-panel-toolbar"
            className="flex flex-wrap items-center gap-2 px-(--card-edge) pb-2"
          >
            {toolbar.render()}
          </div>
        )}
        {legend !== undefined && legend.length > 0 && <Legend entries={legend} />}
        <Inset ref={insetRef} className="flex flex-col">
          <HostTitleContext.Provider value={title}>
            <FrameDepthContext.Provider value={depth + 1}>
              <CardPhase
                phase={phase}
                empty={empty}
                height={height}
                skeleton={<PanelSkeleton size={bodySize} />}
              >
                {body}
              </CardPhase>
            </FrameDepthContext.Provider>
          </HostTitleContext.Provider>
        </Inset>
      </Card>
    </div>
  )
}
