/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- a flow row is a focus stop of its own: Tab walks the rows and the checklist focuses one */
import type { CSSProperties, KeyboardEvent, ReactElement } from 'react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { CardMenu } from '../core/card-menu'
import { cn } from '../core/cn'
import { useMessages } from '../core/messages/use-messages'
import { flow as flowMessages } from '../core/messages/flow'
import { alpha, BASALT } from '../tokens/core'
import { Lozenge } from '../ui/badge'
import { buttonVariants } from '../ui/button'
import { Kbd } from '../ui/kbd'
import { ScrollArea } from '../ui/scroll-area'
import { Status } from '../ui/status'
import type { EdgeBox } from './edge-path'
import { elbowPath } from './edge-path'
import type {
  FlowColumn,
  FlowEdge,
  FlowGroup,
  FlowHandle,
  FlowIssue,
  FlowRow,
  FlowTool,
} from './flow'
import { anchorOf, worstTone } from './flow'
import type { ViewportOptions } from './viewport'
import { FIT_FLOOR, useViewport, ZOOM_STEP } from './viewport'

export type FlowCanvasProps = {
  /** The accessible name of the canvas region. */
  label: string
  /** From `useFlow`: the tool, the folds and the checklist's reveal. */
  flow: FlowHandle
  /** The stage, left to right; each column's groups top to bottom. Source order is reading order. */
  columns: readonly FlowColumn[]
  /** Connectors between anchors (group or row ids); an unknown anchor draws nothing. */
  edges?: readonly FlowEdge[] | undefined
  issues?: readonly FlowIssue[] | undefined
  /** The zoom range; default 0.5 to 1.25. */
  zoom?: { min: number; max: number } | undefined
}

/** Below 480 px of container (`@regular`) the groups stack: no zoom, no edges, no tools. */
const REGULAR = 480
/** The zoom menu's fixed steps. */
const PRESETS = [0.5, 1, 1.25] as const
/** An edge runs this far out of its source before it turns, and turns on this radius. */
const ELBOW = { lead: 24, radius: 12 }

const TONE_STROKE: Record<NonNullable<FlowIssue['tone']>, string> = {
  info: 'var(--basalt-info)',
  warn: 'var(--basalt-warn)',
  bad: 'var(--basalt-bad)',
}
const LINE = 'var(--basalt-line)'
const TONE_TEXT: Record<NonNullable<FlowIssue['tone']>, string> = {
  info: 'text-info',
  warn: 'text-warn',
  bad: 'text-bad',
}

const DOTS: CSSProperties = {
  backgroundImage: `radial-gradient(circle, ${alpha(BASALT.ink, 0.1)} 1px, transparent 1.2px)`,
  backgroundSize: '18px 18px',
  backgroundAttachment: 'local',
}

const GLYPH = {
  chevron: 'M6 4l4 4-4 4',
  warn: 'M8 2.5 14 13H2Z M8 6.5v3 M8 11.25v.01',
  pointer: 'M3.5 2.5l9 4.5-4 1.25-1.5 4.25z',
  hand: 'M5.5 8V3.75a1.25 1.25 0 0 1 2.5 0V7.5V2.75a1.25 1.25 0 0 1 2.5 0V7.5V4a1.25 1.25 0 0 1 2.5 0v5.5a5 5 0 0 1-5 5h-.5a5 5 0 0 1-4.1-2.1L2 9.5a1.25 1.25 0 0 1 2-1.5Z',
  zoomIn: 'M3 8h10M8 3v10',
  zoomOut: 'M3 8h10',
  check: 'M3.5 8.5l3 3 6-7',
} as const

function Glyph({ d, className }: { d: string; className?: string }): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className ?? 'size-icon shrink-0'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  )
}

const escapeAttr = (value: string): string =>
  typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(value)
    : value.replace(/["\\]/g, '\\$&')

const push = (map: Map<string, FlowIssue[]>, key: string, issue: FlowIssue): void => {
  map.set(key, [...(map.get(key) ?? []), issue])
}

/** Every issue sorted to the anchors it marks. */
function issueIndex(columns: readonly FlowColumn[], issues: readonly FlowIssue[]) {
  const groupOf = new Map<string, string>()
  for (const column of columns)
    for (const group of column.groups) for (const row of group.rows) groupOf.set(row.id, group.id)
  const byRow = new Map<string, FlowIssue[]>()
  const byGroup = new Map<string, FlowIssue[]>()
  const byEdge = new Map<string, FlowIssue[]>()
  for (const issue of issues) {
    if ('edge' in issue.on) {
      push(byEdge, `${issue.on.edge.from}>${issue.on.edge.to}`, issue)
      continue
    }
    if ('row' in issue.on) {
      push(byRow, issue.on.row, issue)
      const group = groupOf.get(issue.on.row)
      if (group !== undefined) push(byGroup, group, issue)
      continue
    }
    push(byGroup, issue.on.group, issue)
  }
  return { groupOf, byRow, byGroup, byEdge }
}

type Drawn = { key: string; path: string; tone: FlowIssue['tone'] }

function RowView({
  row,
  issues,
}: {
  row: FlowRow
  issues: readonly FlowIssue[] | undefined
}): ReactElement {
  const t = useMessages(flowMessages)
  const Icon = row.icon
  const tone = issues === undefined ? undefined : worstTone(issues)
  return (
    <li
      data-slot="flow-row"
      data-flow-anchor={row.id}
      data-issue={tone}
      tabIndex={0}
      className="flex min-h-11 min-w-0 items-center gap-2.5 px-3 py-1.5 focus-ring focus-visible:-outline-offset-2"
    >
      {Icon !== undefined && (
        <span className="flex size-6 shrink-0 items-center justify-center rounded-chip border text-muted-foreground">
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-foreground">{row.title}</span>
        {row.sub !== undefined && (
          <span className="truncate text-xs text-muted-foreground">{row.sub}</span>
        )}
      </span>
      {row.status !== undefined && (
        <Status tone={row.status.tone} className="shrink-0 text-xs">
          {row.status.label}
        </Status>
      )}
      {tone !== undefined && issues !== undefined && (
        <span data-slot="flow-row-issue" className={cn('flex shrink-0', TONE_TEXT[tone])}>
          <Glyph d={GLYPH.warn} />
          <span className="sr-only">
            {t('flow.rowIssue', issues.map((issue) => issue.label).join(', '))}
          </span>
        </span>
      )}
    </li>
  )
}

function GroupView({
  group,
  folded,
  onFold,
  issues,
  rowIssues,
}: {
  group: FlowGroup
  folded: boolean
  onFold: () => void
  issues: readonly FlowIssue[] | undefined
  rowIssues: ReadonlyMap<string, FlowIssue[]>
}): ReactElement {
  const t = useMessages(flowMessages)
  const id = useId()
  const Icon = group.icon
  const tone = issues === undefined ? undefined : worstTone(issues)
  return (
    <section
      data-slot="flow-group"
      data-flow-group={group.id}
      data-folded={folded ? '' : undefined}
      aria-labelledby={`${id}-title`}
      className="relative flex min-w-0 flex-col rounded-card border bg-background p-1 in-data-[tool=pointer]:cursor-auto"
    >
      <div
        data-flow-anchor={group.id}
        className="flex h-9 min-w-0 items-center gap-1 pointer-coarse:h-11"
      >
        <button
          type="button"
          data-slot="flow-group-header"
          aria-expanded={!folded}
          aria-controls={`${id}-body`}
          onClick={onFold}
          className="flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-inset pointer-coarse:h-11 border-0 bg-transparent px-2.5 text-left text-foreground hover:bg-accent focus-ring focus-visible:-outline-offset-2"
        >
          <Glyph
            d={GLYPH.chevron}
            className={cn(
              'size-icon shrink-0 text-muted-foreground transition-transform duration-fast ease-standard motion-reduce:transition-none',
              !folded && 'rotate-90',
            )}
          />
          {Icon !== undefined && (
            <Icon className="size-icon shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <span id={`${id}-title`} className="min-w-0 truncate text-sm font-medium">
            {group.title}
          </span>
          {group.chip !== undefined && (
            // Outlined, not the neutral lozenge: its wash over the grey tray drops the ink under 4.5:1.
            <span
              data-slot="flow-group-chip"
              className="inline-flex h-5 shrink-0 items-center rounded-chip border px-1.5 text-xs font-medium whitespace-nowrap text-muted-foreground"
            >
              {group.chip.label}
            </span>
          )}
          {tone !== undefined && issues !== undefined && (
            <Lozenge tone={tone} data-flow-issues="">
              {t('flow.issues', issues.length)}
            </Lozenge>
          )}
        </button>
        {group.menu !== undefined && (
          <CardMenu
            menu={group.menu}
            label={t('flow.groupMenu', group.title)}
            contextMenu={group.contextMenu !== false}
          />
        )}
      </div>
      <div
        id={`${id}-body`}
        inert={folded}
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-base ease-standard motion-reduce:transition-none',
          folded ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr]',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <ul className="m-0 flex list-none flex-col divide-y rounded-inset border bg-card p-0 shadow-card">
            {group.rows.map((row) => (
              <RowView key={row.id} row={row} issues={rowIssues.get(row.id)} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

const TOOL_BUTTON = cn(
  buttonVariants({ variant: 'ghost', size: 'md', shape: 'icon' }),
  'aria-pressed:bg-selected aria-pressed:text-foreground',
)
const MENU_ITEM =
  'flex h-8 w-full cursor-pointer items-center justify-between gap-6 rounded-ctrl border-0 bg-transparent px-2 text-left text-sm text-foreground hover:bg-accent focus-ring pointer-coarse:min-h-11'

function Tools({
  tool,
  setTool,
  scale,
  zoom,
  zoomBy,
  fit,
  zoomAt,
}: {
  tool: FlowTool
  setTool: (tool: FlowTool) => void
  scale: number
  zoom: { min: number; max: number }
  zoomBy: (factor: number) => void
  fit: () => void
  zoomAt: (scale: number) => void
}): ReactElement {
  const t = useMessages(flowMessages)
  const menuId = useId()
  const anchor = `--flow-zoom-${menuId.replace(/[^\w-]/g, '')}`
  const close = (): void => {
    const menu = document.getElementById(menuId)
    if (typeof menu?.hidePopover === 'function') menu.hidePopover()
  }
  const percent = t('flow.zoomLevel', scale)
  const run = (act: () => void) => () => {
    close()
    act()
  }
  return (
    <div
      data-slot="flow-tools"
      role="toolbar"
      aria-label={t('flow.tools')}
      className="absolute bottom-5 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-1 rounded-card border bg-popover p-1.5 shadow-raised @regular:flex"
    >
      {(
        [
          ['pointer', GLYPH.pointer, t('flow.pointer'), 'V'],
          ['hand', GLYPH.hand, t('flow.hand'), 'H'],
        ] as const
      ).map(([id, d, name, key]) => (
        <button
          key={id}
          type="button"
          data-tool={id}
          aria-pressed={tool === id}
          aria-label={name}
          aria-keyshortcuts={key}
          title={`${name} (${key})`}
          className={TOOL_BUTTON}
          onClick={() => setTool(id)}
        >
          <Glyph d={d} />
        </button>
      ))}
      <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-border" />
      <button
        type="button"
        aria-label={t('flow.zoomOut')}
        disabled={scale <= zoom.min + 0.001}
        className={TOOL_BUTTON}
        onClick={() => zoomBy(1 / ZOOM_STEP)}
      >
        <Glyph d={GLYPH.zoomOut} />
      </button>
      <button
        type="button"
        data-slot="flow-zoom"
        aria-label={`${t('flow.zoom')}, ${percent}`}
        popoverTarget={menuId}
        style={{ anchorName: anchor }}
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'md' }),
          'min-w-16 justify-center tabular-nums',
        )}
      >
        {percent}
      </button>
      <div
        id={menuId}
        popover="auto"
        data-slot="flow-zoom-menu"
        style={{ positionAnchor: anchor }}
        className="m-0 min-w-48 rounded-inset border-0 bg-popover p-1 text-foreground shadow-overlay supports-[position-area:top]:m-2 supports-[position-area:top]:[position-area:top] supports-[position-area:top]:[position-try-fallbacks:flip-block]"
      >
        <button type="button" className={MENU_ITEM} onClick={run(() => zoomBy(ZOOM_STEP))}>
          {t('flow.zoomIn')}
          <Kbd>+</Kbd>
        </button>
        <button type="button" className={MENU_ITEM} onClick={run(() => zoomBy(1 / ZOOM_STEP))}>
          {t('flow.zoomOut')}
          <Kbd>-</Kbd>
        </button>
        <button type="button" className={MENU_ITEM} onClick={run(fit)}>
          {t('flow.fit')}
          <Kbd>0</Kbd>
        </button>
        <hr className="my-1 h-px border-0 bg-border" />
        {PRESETS.filter((p) => p >= zoom.min && p <= zoom.max).map((p) => (
          <button
            key={p}
            type="button"
            data-preset={p}
            className={MENU_ITEM}
            onClick={run(() => zoomAt(p))}
          >
            {t('flow.zoomLevel', p)}
            {Math.abs(scale - p) < 0.005 && <Glyph d={GLYPH.check} />}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-label={t('flow.zoomIn')}
        disabled={scale >= zoom.max - 0.001}
        className={TOOL_BUTTON}
        onClick={() => zoomBy(ZOOM_STEP)}
      >
        <Glyph d={GLYPH.zoomIn} />
      </button>
    </div>
  )
}

/** The box of an anchor in stage units: its group's sides, its own middle; a folded group's row is its header. */
function measure(stage: HTMLElement, anchors: ReadonlySet<string>): Map<string, EdgeBox> {
  const out = new Map<string, EdgeBox>()
  const frame = stage.getBoundingClientRect()
  const scale = stage.offsetWidth === 0 ? 1 : frame.width / stage.offsetWidth
  if (scale === 0) return out
  for (const id of anchors) {
    let el = stage.querySelector<HTMLElement>(`[data-flow-anchor="${escapeAttr(id)}"]`)
    const group = el?.closest<HTMLElement>('[data-slot="flow-group"]')
    if (el === null || group === null || group === undefined) continue
    if (group.dataset['folded'] !== undefined) {
      el = group.querySelector<HTMLElement>(':scope > [data-flow-anchor]') ?? el
    }
    const side = group.getBoundingClientRect()
    const mid = el.getBoundingClientRect()
    out.set(id, {
      x: (side.left - frame.left) / scale,
      width: side.width / scale,
      y: (mid.top - frame.top) / scale,
      height: mid.height / scale,
    })
  }
  return out
}

/**
 * A builder canvas: columns of group cards on a dot ground, connectors between their rows, and a
 * floating toolbar. The app places content (columns of groups of rows, never free nodes); the
 * canvas owns the grid, the zoom, the edges and the marks. Pan is the frame's own scroll: the wheel,
 * a drag on empty ground with the pointer tool (`V`), a drag anywhere with the hand tool (`H`);
 * Ctrl or Cmd with the wheel, a pinch, the zoom menu (50, 100 and 125 per cent and fit) and the
 * `+`, `-` and `0` keys (with or without Ctrl or Cmd, while focus is in the canvas) zoom it. A
 * group header folds its rows and the fold is remembered per flow; every header and row is a tab
 * stop in source order. Edges are elbows with rounded turns and an arrowhead, re-measured on a
 * resize, a fold and a zoom; one into a target with an issue takes the issue's tone. An issue marks
 * its group header (a chip with the count), its row (a triangle) and its edge, and `FlowChecklist`
 * lists it. Below 480 px of container the groups stack in source order, with no edges and no zoom.
 * A drawing smaller than the frame sits in its middle. Put it in a `fill` page; a `PageAside` beside
 * it docks and the canvas refits to the narrower frame. The column, group, row, edge and issue shapes
 * are not exported: type data off `FlowCanvasProps['columns'][number]`, and take `flow` from `useFlow`.
 *
 * @useWhen a workflow or a pipeline is a few stages of configured steps with connectors between them (a builder), edited in place, with a workflow-level panel
 * @neverWhen the records wait on each other in a graph the layout should place (use `ChainView`), or the nodes are free to move (a whiteboard, out of scope)
 *
 * @example
 * const flow = useFlow({ id: 'reorder' })
 * <FlowCanvas
 *   label="Reorder workflow"
 *   flow={flow}
 *   columns={[{ id: 'when', groups: [{ id: 'trigger', title: 'When', rows: [{ id: 'low', title: 'Stock below reorder point' }] }] }]}
 *   edges={[{ from: 'trigger', to: 'approval' }]}
 *   issues={issues}
 * />
 */
export function FlowCanvas({
  label,
  flow,
  columns,
  edges = [],
  issues = [],
  zoom = { min: 0.5, max: 1.25 },
}: FlowCanvasProps): ReactElement {
  const marker = useId().replace(/[^\w-]/g, '')
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const options: ViewportOptions = {
    min: zoom.min,
    max: zoom.max,
    floor: Math.max(zoom.min, FIT_FLOOR),
    grabs: (target) => flow.tool === 'hand' || target.closest('[data-slot="flow-group"]') === null,
  }
  const { frame, ...view } = useViewport(stageSize, options)
  const narrow = view.width > 0 && view.width < REGULAR
  const scale = narrow ? 1 : view.scale

  const index = issueIndex(columns, issues)
  useEffect(() => {
    for (const [row, group] of index.groupOf) flow.groupOf.set(row, group)
  })

  // The stage's own size, unscaled: offset sizes ignore the transform.
  useEffect(() => {
    const stage = stageRef.current
    if (stage === null) return
    const read = (): void =>
      setStageSize((prev) =>
        prev.width === stage.offsetWidth && prev.height === stage.offsetHeight
          ? prev
          : { width: stage.offsetWidth, height: stage.offsetHeight },
      )
    read()
    const observer = new ResizeObserver(read)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  // Edges re-measure on every resize of the stage or a group (a fold animates its height), and on a zoom.
  const [drawn, setDrawn] = useState<readonly Drawn[]>([])
  const edgeKey = edges.map((e) => `${e.from}>${e.to}`).join('|')
  const issueKey = issues.map((i) => `${i.id}:${anchorOf(i)}:${i.tone ?? 'warn'}`).join('|')
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (stage === null || narrow) {
      setDrawn((prev) => (prev.length === 0 ? prev : []))
      return
    }
    const anchors = new Set(edges.flatMap((e) => [e.from, e.to]))
    const toneOf = (edge: FlowEdge): FlowIssue['tone'] => {
      const own = index.byEdge.get(`${edge.from}>${edge.to}`) ?? []
      const target = [...(index.byRow.get(edge.to) ?? []), ...(index.byGroup.get(edge.to) ?? [])]
      return worstTone([...own, ...target])
    }
    const draw = (): void => {
      const boxes = measure(stage, anchors)
      const next = edges.flatMap((edge): Drawn[] => {
        const from = boxes.get(edge.from)
        const to = boxes.get(edge.to)
        if (from === undefined || to === undefined) return []
        return [
          {
            key: `${edge.from}>${edge.to}`,
            path: elbowPath(from, to, ELBOW).path,
            tone: toneOf(edge),
          },
        ]
      })
      setDrawn((prev) =>
        prev.length === next.length &&
        prev.every((p, i) => p.path === next[i]?.path && p.tone === next[i]?.tone)
          ? prev
          : next,
      )
    }
    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(stage)
    // A column resizes when a group in it folds, which moves every group under it.
    for (const part of stage.querySelectorAll(
      '[data-slot="flow-column"], [data-slot="flow-group"]',
    ))
      observer.observe(part)
    return () => observer.disconnect()
    // The keys stand for the arrays: a new array with the same edges and issues measures nothing new.
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- edgeKey and issueKey are the content of edges and issues
  }, [edgeKey, issueKey, narrow, scale, columns])

  // A reveal from the checklist: once the group is open, bring the anchor in and focus it.
  const folded = (id: string): boolean => flow.isFolded(id)
  const pending = flow.pending
  const pendingOpen = pending === undefined ? false : !folded(flow.groupOf.get(pending) ?? pending)
  useEffect(() => {
    const stage = stageRef.current
    if (pending === undefined || stage === null || !pendingOpen) return
    const el = stage.querySelector<HTMLElement>(`[data-flow-anchor="${escapeAttr(pending)}"]`)
    const target =
      el?.dataset['slot'] === 'flow-row'
        ? el
        : el?.querySelector<HTMLElement>('[data-slot="flow-group-header"]')
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    target?.focus({ preventScroll: true })
    flow.settle()
  }, [pending, pendingOpen, flow])

  const zoomAt = (next: number): void => view.zoomBy(next / view.scale)
  const keys = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.altKey || narrow) return
    const target = event.target as Element
    if (target.closest('input, textarea, select, [contenteditable="true"]') !== null) return
    const modified = event.ctrlKey || event.metaKey
    const zoomKeys: Record<string, () => void> = {
      '+': () => view.zoomBy(ZOOM_STEP),
      '=': () => view.zoomBy(ZOOM_STEP),
      '-': () => view.zoomBy(1 / ZOOM_STEP),
      _: () => view.zoomBy(1 / ZOOM_STEP),
      '0': () => view.fit(),
    }
    const toolKeys: Record<string, () => void> = {
      h: () => flow.setTool('hand'),
      v: () => flow.setTool('pointer'),
    }
    const run = zoomKeys[event.key] ?? (modified ? undefined : toolKeys[event.key.toLowerCase()])
    if (run === undefined) return
    event.preventDefault()
    run()
  }

  // The ground fills the frame at least, so a drag anywhere on it pans; a smaller drawing is centred.
  const drawnW = stageSize.width * scale
  const drawnH = stageSize.height * scale
  const groundW = Math.max(drawnW, view.width)
  const groundH = Math.max(drawnH, view.height)
  const style = {
    '--flow-scale': String(scale),
    '--flow-w': `${groundW}px`,
    '--flow-h': `${groundH}px`,
    '--flow-x': `${(groundW - drawnW) / 2}px`,
    '--flow-y': `${(groundH - drawnH) / 2}px`,
  } as CSSProperties

  return (
    <div
      data-slot="flow-canvas"
      data-zoom={scale.toFixed(3)}
      data-fitted={view.fitted ? '' : undefined}
      data-tool={flow.tool}
      className="@container relative flex min-h-0 min-w-0 flex-1 flex-col"
      onKeyDownCapture={keys}
    >
      <ScrollArea
        ref={frame}
        orientation={narrow ? 'vertical' : 'both'}
        aria-label={label}
        className="min-h-0 flex-1 overscroll-contain focus-visible:-outline-offset-2"
        style={DOTS}
      >
        <div
          data-slot="flow-ground"
          style={style}
          className={cn(
            'relative max-w-[100cqw] @regular:h-(--flow-h) @regular:w-(--flow-w) @regular:max-w-none',
            flow.tool === 'hand'
              ? 'cursor-grab active:cursor-grabbing **:cursor-grab'
              : view.pans && 'cursor-grab active:cursor-grabbing',
          )}
          {...view.drag}
        >
          <div
            ref={stageRef}
            data-slot="flow-stage"
            className="flex flex-col gap-4 p-4 @regular:absolute @regular:top-(--flow-y) @regular:left-(--flow-x) @regular:w-max @regular:origin-top-left @regular:scale-(--flow-scale) @regular:flex-row @regular:items-start @regular:gap-20 @regular:px-6 @regular:pt-14 @regular:pb-24"
          >
            <svg
              aria-hidden="true"
              data-slot="flow-edges"
              className="pointer-events-none absolute inset-0 hidden size-full overflow-visible @regular:block"
            >
              <defs>
                {(['none', 'info', 'warn', 'bad'] as const).map((tone) => (
                  <marker
                    key={tone}
                    id={`${marker}-${tone}`}
                    viewBox="0 0 6 8"
                    refX="6"
                    refY="4"
                    markerWidth="6"
                    markerHeight="8"
                    markerUnits="userSpaceOnUse"
                    orient="auto"
                  >
                    <path
                      d="M 0 0 L 6 4 L 0 8 Z"
                      fill={tone === 'none' ? LINE : TONE_STROKE[tone]}
                    />
                  </marker>
                ))}
              </defs>
              {drawn.map((edge) => (
                <path
                  key={edge.key}
                  data-slot="flow-edge"
                  data-edge={edge.key}
                  data-tone={edge.tone}
                  d={edge.path}
                  fill="none"
                  stroke={edge.tone === undefined ? LINE : TONE_STROKE[edge.tone]}
                  strokeWidth="1.5"
                  markerEnd={`url(#${marker}-${edge.tone ?? 'none'})`}
                />
              ))}
            </svg>
            {columns.map((column) => (
              <div
                key={column.id}
                data-slot="flow-column"
                className="relative flex min-w-0 flex-col gap-4 @regular:w-75 @regular:gap-5"
              >
                {column.groups.map((group) => (
                  <GroupView
                    key={group.id}
                    group={group}
                    folded={folded(group.id)}
                    onFold={() => flow.setFolded(group.id, !folded(group.id))}
                    issues={index.byGroup.get(group.id)}
                    rowIssues={index.byRow}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
      <Tools
        tool={flow.tool}
        setTool={flow.setTool}
        scale={scale}
        zoom={zoom}
        zoomBy={view.zoomBy}
        fit={view.fit}
        zoomAt={zoomAt}
      />
    </div>
  )
}
