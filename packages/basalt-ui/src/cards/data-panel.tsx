import { useContext } from 'react'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { useMessages } from '../core/messages/use-messages'
import { cards } from '../core/messages/cards'
import { PhaseBoundary } from '../core/phase-boundary'
import type { Box, BoxSlot } from '../core/ports'
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
 * that, whatever `skeleton` asks for.
 */
const MIN_BODY = 96

/** The body box height `skeleton` declares. The loading, error, empty and ready body all hold it. */
const bodyHeightOf = (skeleton: DataPanelProps['skeleton']): number => {
  const px =
    'rows' in skeleton
      ? Math.max(0, Math.round(skeleton.rows)) * (ROW + GAP) - GAP
      : Math.round(skeleton.height)
  return Math.max(MIN_BODY, px)
}

const BAR = 'animate-pulse rounded-chip bg-foreground/10 motion-reduce:animate-none'

function PanelSkeleton({ skeleton }: { skeleton: DataPanelProps['skeleton'] }): ReactElement {
  if ('rows' in skeleton) {
    return (
      <div aria-hidden="true" className="flex h-full flex-col gap-2 overflow-clip">
        {Array.from({ length: Math.max(0, Math.round(skeleton.rows)) }, (_, i) => (
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

function Legend({ entries }: { entries: readonly LegendEntry[] }): ReactElement {
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
          {/* theme-allow hidden-inline-style — a series colour is app data (a light and a dark value), so it enters as two custom properties */}
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

/** Calls the menu slot as a component, so a throw lands in the boundary and not in the panel. */
function MenuSlot({ slot, box }: { slot: BoxSlot; box: Box }): ReactNode {
  return slot(box)
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
          className="order-1 flex w-full items-center gap-2 @regular:order-none @regular:w-auto"
        >
          {controls.render()}
        </div>
      )}
      {menu !== undefined && (
        <div data-slot="data-panel-menu" className="flex shrink-0 items-center">
          <PhaseBoundary fallback={() => null}>
            <MenuSlot slot={menu} box={{ height: 28, phase: 'ready' }} />
          </PhaseBoundary>
        </div>
      )}
    </div>
  )
}

/**
 * The frame for a body that is not a chart: the same header and phase handling as the other cards,
 * around a table, a list or a board. The body is one box slot at a fixed height, declared by the
 * required `skeleton`, so a loading, empty or error panel is exactly as tall as a ready one and
 * the body is called only in `ready` and `stale`. The box clips with `overflow: clip`, never
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
 *   skeleton={{ rows: 6 }}
 *   body={(box) => <PullTable rows={rows} height={box.height} />}
 * />
 */
export function DataPanel(props: DataPanelProps): ReactElement {
  const { title, controls, toolbar, legend } = props
  const { phase, empty, skeleton, body } = props
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
  const height = bodyHeightOf(skeleton)
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
        <Inset className="flex flex-col">
          <FrameDepthContext.Provider value={depth + 1}>
            <CardPhase
              phase={phase}
              empty={empty}
              height={height}
              skeleton={<PanelSkeleton skeleton={skeleton} />}
            >
              {body}
            </CardPhase>
          </FrameDepthContext.Provider>
        </Inset>
      </Card>
    </div>
  )
}
