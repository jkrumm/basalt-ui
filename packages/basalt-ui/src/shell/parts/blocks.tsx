/**
 * The rail's blocks: declared data (law C13) painted as rows. One DOM for every width; the rail is
 * a size container, so the collapsed form is a container variant on the rail's own width
 * (`@max-[120px]`, between the 64 px collapsed and 240 px expanded rail). A block never reads the
 * rail state in JS: hiding is CSS only, so a custom block keeps its state when the rail collapses.
 *
 * - `list`: micro-label, optional count, rows; `max` plus an ephemeral "Show more"; the fold is
 *   persisted. On the collapsed rail a `dot` list is one icon (with a dot) opening the rows in a
 *   popover.
 * - `progress`: label, percent, a track. Collapsed it paints nothing itself: its ring rides the
 *   settings row (`RailSettings ring`).
 * - `custom`: `render(box)` mounted verbatim. Named by `mobile`, the collapsed rail shows its icon
 *   opening the same node in a popover.
 */
import { useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../../core/cn'
import { useFormat } from '../../core/format'
import { persisted } from '../../core/persisted'
import type { IconComponent } from '../../core/ports'
import { useSizeClass } from '../../page/use-size-class'
import { CountBadge } from '../../ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../ui/collapsible'
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover'
import { Progress } from '../../ui/progress'
import type { ShellBox } from '../contract'
import { FOLD_VERSION } from '../core/block-model'
import type {
  BlockTone,
  CoreBlockItem,
  CoreListBlock,
  CoreProgressBlock,
} from '../core/block-model'
import type { RailBlockRow } from '../core/projector'

/** The rail is 64 px collapsed and 240 px expanded; the collapsed form keys off this. */
const COLLAPSED = '@max-[120px]'

/**
 * The box a custom block renders into: one control row (32 px) high, like a header `custom`
 * action. It is a hint, not a clip: the block keeps whatever height it needs.
 */
export const BLOCK_BOX_HEIGHT = 32

const TONE_DOT: Record<BlockTone, string> = {
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
}

const LABEL = 'min-w-0 flex-1 truncate text-micro font-medium uppercase tracking-wide text-faint'
const ROW =
  'flex h-7 w-full min-w-0 items-center gap-2 rounded-ctrl px-2.5 text-start text-sm text-muted-foreground'
const ROW_BUTTON = 'cursor-pointer hover:bg-accent hover:text-foreground focus-ring'
const RAIL_ICON_BUTTON =
  'relative size-8 cursor-pointer place-items-center rounded-ctrl text-muted-foreground hover:bg-accent hover:text-foreground'
/** The collapsed-rail trigger: absent expanded, a centred 32 px icon button collapsed. */
const RAIL_TRIGGER = cn('hidden', `${COLLAPSED}:grid`, RAIL_ICON_BUTTON)

function Chevron({ open }: { open: boolean }): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-3 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {open ? <path d="M6 9l6 6l6 -6" /> : <path d="M9 6l6 6l-6 6" />}
    </svg>
  )
}

function ItemLead({ item }: { item: CoreBlockItem }): ReactElement | null {
  const Icon = item.icon
  if (Icon !== undefined) return <Icon className="size-icon shrink-0" aria-hidden />
  if (item.tone === undefined) return null
  return (
    <span
      aria-hidden="true"
      data-tone={item.tone}
      className={cn('size-2 shrink-0 rounded-full', TONE_DOT[item.tone])}
    />
  )
}

function BlockItem({ item }: { item: CoreBlockItem }): ReactElement {
  const body = (
    <>
      <ItemLead item={item} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.meta !== undefined && (
        <span className="shrink-0 text-xs text-faint tabular-nums">{item.meta}</span>
      )}
    </>
  )
  // A row with nowhere to go is text: a keyboard walk must not stop on a dead control.
  if (item.onClick === undefined) {
    return (
      <div data-slot="shell-rail-block-item" className={ROW}>
        {body}
      </div>
    )
  }
  return (
    <button
      type="button"
      data-slot="shell-rail-block-item"
      className={cn(ROW, ROW_BUTTON)}
      onClick={item.onClick}
    >
      {body}
    </button>
  )
}

/** The rows and the "Show more" toggle. The toggle is ephemeral: a reach, not a preference. */
function ListItems({ block, visible }: { block: CoreListBlock; visible: number }): ReactElement {
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? block.items.length : visible
  return (
    <div className="flex flex-col gap-px">
      {block.items.slice(0, shown).map((item) => (
        <BlockItem key={item.id} item={item} />
      ))}
      {(visible < block.items.length || showAll) && (
        <button
          type="button"
          aria-expanded={showAll}
          className={cn(ROW, ROW_BUTTON, 'text-xs')}
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

function ListBlock({ row, block }: { row: RailBlockRow; block: CoreListBlock }): ReactElement {
  const [folded, setFolded] = persisted<boolean>(row.foldKey, {
    version: FOLD_VERSION,
    initial: false,
  }).use()
  const visible = row.visibleCount ?? block.items.length
  const Icon = row.rail === 'dot' ? block.icon : undefined
  const header = (
    <>
      <span className={LABEL}>{block.label}</span>
      {block.count !== undefined && block.count > 0 && <CountBadge count={block.count} />}
    </>
  )

  return (
    <div
      data-slot="shell-rail-block"
      data-rail={row.rail}
      className={cn('flex flex-col', Icon === undefined && `${COLLAPSED}:hidden`)}
    >
      <div className={cn('flex flex-col', Icon !== undefined && `${COLLAPSED}:hidden`)}>
        {block.collapsible === true ? (
          <Collapsible open={!folded} onOpenChange={(open) => setFolded(!open)}>
            <CollapsibleTrigger className={cn(ROW, ROW_BUTTON, 'h-6')}>
              {header}
              <Chevron open={!folded} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ListItems block={block} visible={visible} />
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <>
            <div className={cn(ROW, 'h-6')}>{header}</div>
            <ListItems block={block} visible={visible} />
          </>
        )}
      </div>
      {Icon !== undefined && (
        <Popover>
          <PopoverTrigger aria-label={block.label} className={RAIL_TRIGGER}>
            <Icon className="size-icon" aria-hidden />
            <span
              aria-hidden="true"
              data-slot="shell-rail-block-dot"
              className="absolute end-1 top-1 size-2 rounded-full bg-brand-fill"
            />
          </PopoverTrigger>
          <PopoverContent aria-label={block.label} side="right" align="start" className="w-64 p-2">
            <ListItems block={block} visible={visible} />
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

/** `value` is a fraction, 0 to 1. The collapsed rail shows no row: the ring is on the settings row. */
function ProgressBlock({
  row,
  block,
}: {
  row: RailBlockRow
  block: CoreProgressBlock
}): ReactElement {
  const format = useFormat()
  const fraction = Math.min(1, Math.max(0, block.value))
  const inner = (
    <>
      <span className="flex items-baseline justify-between gap-2">
        <span className={LABEL}>{block.label}</span>
        <span className="shrink-0 text-xs text-faint tabular-nums">{format.percent(fraction)}</span>
      </span>
      <Progress value={fraction * 100} aria-label={block.label} />
    </>
  )
  const frame = 'flex w-full flex-col gap-1.5 rounded-ctrl px-2.5 py-1.5 text-start'
  return (
    <div
      data-slot="shell-rail-block"
      data-rail={row.rail}
      className={cn('flex flex-col', `${COLLAPSED}:hidden`)}
    >
      {block.onClick !== undefined ? (
        <button
          type="button"
          className={cn(frame, 'cursor-pointer hover:bg-accent focus-ring')}
          onClick={block.onClick}
        >
          {inner}
        </button>
      ) : (
        <div className={frame}>{inner}</div>
      )}
    </div>
  )
}

/** What a custom block carries at runtime: the frozen `SidebarBlock` has it, `CoreBlock` omits it. */
type CustomBlockShape = {
  mobile?: { label: string; icon: IconComponent }
  render?: (box: ShellBox) => ReactNode
}

/**
 * Mounted inline and never unmounted by the collapsed rail (hiding is CSS only, so the node keeps
 * its state). A named block adds a collapsed-rail icon opening a second mount of the node in a
 * popover, while open. The box is `{ height: 32, sizeClass }` and nothing clips the node.
 */
function CustomBlock({ row }: { row: RailBlockRow }): ReactElement | null {
  const sizeClass = useSizeClass()
  const block = row.block as unknown as CustomBlockShape
  if (block.render === undefined) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console -- dev-only diagnostic
      console.warn(`[basalt] RailBlock: custom block "${row.id}" has no render function.`)
    }
    return null
  }
  const box: ShellBox = { height: BLOCK_BOX_HEIGHT, sizeClass }
  const Icon = row.rail === 'icon' ? block.mobile?.icon : undefined
  const label = block.mobile?.label
  const named = Icon !== undefined && label !== undefined
  return (
    <div
      data-slot="shell-rail-block"
      data-rail={row.rail}
      className={cn('flex flex-col', !named && `${COLLAPSED}:hidden`)}
    >
      <div className={cn(named && `${COLLAPSED}:hidden`)}>{block.render(box)}</div>
      {named && (
        <Popover>
          <PopoverTrigger aria-label={label} className={RAIL_TRIGGER}>
            <Icon className="size-icon" aria-hidden />
          </PopoverTrigger>
          <PopoverContent aria-label={label} side="right" align="start" className="w-64 p-2">
            {block.render(box)}
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

/** One block, whichever kind it is. The rail places it; this decides only the paint. */
export function RailBlock({ row }: { row: RailBlockRow }): ReactElement | null {
  const { block } = row
  if (block.kind === 'list') return <ListBlock row={row} block={block} />
  if (block.kind === 'progress') return <ProgressBlock row={row} block={block} />
  return <CustomBlock row={row} />
}
