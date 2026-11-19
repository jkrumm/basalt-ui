/* oxlint-disable jsx-a11y/no-noninteractive-element-interactions -- the list is the one tab stop of a shared chart focus (listFocus), as RowList's is */
import type { CSSProperties, FocusEvent, KeyboardEvent, PointerEvent, ReactElement } from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '../core/cn'
import { useMessages } from '../core/messages/use-messages'
import { lists } from '../core/messages/lists'
import type { ListFocus, Verdict } from '../core/ports'
import { parentsOf } from '../common/nest'
import { Button } from '../ui/button'
import { ScrollArea } from '../ui/scroll-area'
import { Status } from '../ui/status'
import { CHAIN_SIZE, chainLayout } from './chain-layout'
import { listFocus, rowFocus } from './list-focus'
import type { ChainBox } from './chain-viewport'
import { useChainViewport, ZOOM_STEP } from './chain-viewport'

/**
 * What a node shows: the kit draws the card, so a node is data. The type is declared here because
 * `src/cards/contract.ts` has no `ChainView` entry, as with `RowList`.
 */
export type ChainFace = {
  /** The name, one line: it truncates, never wraps. */
  title: string
  /** A muted line under the title: an id, a project. */
  sub?: string | undefined
  /** A dot and a word for the node's state. */
  status?: Verdict | undefined
  /**
   * Finished: what waits on it no longer waits on it. An edge out of a done node is drawn dashed
   * (done), out of any other node solid in the warn hue (blocks), and a node with a blocking edge in
   * is outlined in the warn tone.
   */
  done?: boolean | undefined
}

export type ChainViewProps<T> = {
  /** The accessible name of the chain (the region and the list). */
  label: string
  /** Every node, in reading order: it breaks ties in the layout and orders the narrow list. */
  nodes: readonly T[]
  getId: (node: T) => string
  /**
   * The ids of the nodes this one waits on (its blockers). An id that names no node is ignored; the
   * first one that does is the node it is listed under in the narrow list.
   */
  waitsOn: (node: T) => readonly string[]
  face: (node: T) => ChainFace
  /** A click or Enter on a node. Absent: nodes are inert. */
  onActivate?: ((node: T) => void) | undefined
  /**
   * A focus shared with a table or a chart over the same records (`useChartFocus(rows, …)`): a node
   * maps to its item by `getId`, so the order of `focus.items` is free. Pointing at a node focuses
   * its item and marks its row; a row focused elsewhere marks its node and the edges that touch it.
   * The chain becomes one tab stop whose arrow keys step the shared focus.
   */
  focus?: ListFocus<T> | undefined
}

const NODE =
  'relative flex h-full min-w-0 flex-col justify-center gap-1 overflow-hidden rounded-card border border-border bg-card px-3 text-left text-foreground shadow-card'
const TARGET =
  'w-full cursor-pointer hover:bg-accent focus-ring focus-visible:-outline-offset-2 group-data-focused/node:bg-accent'
/** A node waiting on an open blocker is outlined in the warn tone, its whole border, never one edge. */
const BLOCKED = 'border-warn'

function Face({
  face,
  waitsOnLine,
}: {
  face: ChainFace
  waitsOnLine: string | undefined
}): ReactElement {
  return (
    <>
      <span data-slot="chain-title" className="truncate text-sm font-medium" title={face.title}>
        {face.title}
      </span>
      <span className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-muted-foreground">{face.sub ?? ''}</span>
        {face.status !== undefined && (
          <Status tone={face.status.tone} className="shrink-0 text-xs">
            {face.status.label}
          </Status>
        )}
      </span>
      {waitsOnLine !== undefined && <span className="sr-only">{waitsOnLine}</span>}
    </>
  )
}

function Legend(): ReactElement {
  const t = useMessages(lists)
  return (
    <ul
      data-slot="chain-legend"
      aria-hidden="true"
      className="m-0 flex list-none flex-wrap gap-4 p-0 text-xs text-muted-foreground"
    >
      <li className="flex items-center gap-2">
        <svg viewBox="0 0 24 8" className="h-2 w-6">
          <line x1="0" y1="4" x2="24" y2="4" stroke="var(--basalt-warn)" strokeWidth="1.5" />
        </svg>
        {t('lists.chainBlocks')}
      </li>
      <li className="flex items-center gap-2">
        <svg viewBox="0 0 24 8" className="h-2 w-6">
          <line
            x1="0"
            y1="4"
            x2="24"
            y2="4"
            stroke="var(--basalt-line)"
            strokeWidth="1.25"
            strokeDasharray="4 3"
          />
        </svg>
        {t('lists.chainDone')}
      </li>
    </ul>
  )
}

/** Every node and edge on the way into and out of `id`: its blockers' blockers and its waiters' waiters. */
function traceOf(
  id: string,
  up: ReadonlyMap<string, readonly string[]>,
  down: ReadonlyMap<string, readonly string[]>,
): Set<string> {
  const seen = new Set([id])
  for (const links of [up, down]) {
    const stack = [id]
    while (stack.length > 0) {
      for (const next of links.get(stack.pop() ?? '') ?? []) {
        if (seen.has(next)) continue
        seen.add(next)
        stack.push(next)
      }
    }
  }
  return seen
}

const STEP_ICON = { in: 'M3 8h10M8 3v10', out: 'M3 8h10' } as const

function StepIcon({ d }: { d: string }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" className="size-icon" fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * A dependency chain: nodes that wait on other nodes, drawn left to right with each blocker left
 * of what waits on it. Every edge leaves its blocker at the middle of the right side and ends in an
 * arrowhead at the middle of the waiting node's left side; one from an open node is solid in the
 * warn hue and reads "blocks", one from a done node is dashed and reads "done", and a node waiting
 * on an open blocker is outlined in the warn tone. The graph opens fitted to its width (never below
 * half size) in a frame no taller than the page's visible scroll area: a drag on empty canvas, the
 * wheel and one finger pan it, Ctrl or Cmd with the wheel, a pinch, the zoom buttons and the
 * `+`, `-` and `0` keys zoom it. Pointing at a node (or focusing its row) lights its whole trace,
 * every node it waits on and every node waiting on it; Focus (or `F`) holds that trace and zooms
 * to it, Show all (or Escape) returns. Below 480 px of container it is a nested list instead, each
 * node under the first node it waits on with the rest named. It shares a `focus` with a
 * `DataTable` over the same records, so a node and its row are one item. The layout is the kit's
 * own (no dependency), and nodes never move.
 *
 * @useWhen records wait on other records (Issues, tasks, deploy steps) and the answer is what blocks what, beside the table of the same records
 * @neverWhen the records form a strict tree with nothing to compare across branches (use `DataTable` with `nested`), or the relation is a flow of quantities (a chart)
 *
 * @example
 * <ChainView
 *   label="Plan"
 *   nodes={issues}
 *   getId={(i) => i.id}
 *   waitsOn={(i) => i.waitsOn}
 *   face={(i) => ({ title: i.title, sub: i.key, status: verdictOf(i), done: i.state === 'done' })}
 *   focus={focus}
 * />
 */
export function ChainView<T>({
  label,
  nodes,
  getId,
  waitsOn,
  face,
  onActivate,
  focus,
}: ChainViewProps<T>): ReactElement {
  const t = useMessages(lists)
  const marker = useId().replace(/[^\w-]/g, '')
  const ids = new Set(nodes.map(getId))
  const inputs = nodes.map((node) => ({
    id: getId(node),
    waitsOn: waitsOn(node).filter((id) => ids.has(id)),
  }))
  const geometry = chainLayout(inputs)
  const { frame, ...view } = useChainViewport(geometry)
  const faces = new Map(nodes.map((node) => [getId(node), face(node)]))
  const titleOf = (id: string): string => faces.get(id)?.title ?? id
  const blockersOf = new Map(inputs.map((input) => [input.id, input.waitsOn]))
  const waitersOf = new Map<string, string[]>()
  for (const input of inputs) {
    for (const blocker of input.waitsOn) {
      waitersOf.set(blocker, [...(waitersOf.get(blocker) ?? []), input.id])
    }
  }
  const isBlocked = (id: string): boolean =>
    (blockersOf.get(id) ?? []).some((blocker) => faces.get(blocker)?.done !== true)
  const focusIndex = new Map((focus?.items ?? []).map((item, i) => [getId(item), i]))
  const focusedId =
    focus === undefined || focus.index === null
      ? undefined
      : (() => {
          const item = focus.items[focus.index]
          return item === undefined ? undefined : getId(item)
        })()

  // The node the trace follows: the shared focus, else the node under the pointer. `recent` keeps
  // the last one, so the Focus button still names it once the pointer has left the graph for it.
  const [pointed, setPointed] = useState<string | undefined>(undefined)
  const [recent, setRecent] = useState<string | undefined>(undefined)
  const [held, setHeld] = useState<string | undefined>(undefined)
  const current = focusedId ?? pointed
  if (current !== undefined && current !== recent && ids.has(current)) setRecent(current)
  const pinned = held !== undefined && ids.has(held) ? held : undefined
  const candidate = recent !== undefined && ids.has(recent) ? recent : undefined
  const tracing = pinned ?? current
  const trace = tracing === undefined ? undefined : traceOf(tracing, blockersOf, waitersOf)

  const box = (members: ReadonlySet<string>): ChainBox | undefined => {
    const placed = [...members].flatMap((id) => {
      const at = geometry.nodes.get(id)
      return at === undefined ? [] : [at]
    })
    if (placed.length === 0) return undefined
    const x = Math.min(...placed.map((at) => at.x))
    const y = Math.min(...placed.map((at) => at.y))
    return {
      x,
      y,
      width: Math.max(...placed.map((at) => at.x)) + CHAIN_SIZE.width - x,
      height: Math.max(...placed.map((at) => at.y)) + CHAIN_SIZE.height - y,
    }
  }
  const hold = (id: string): void => {
    setHeld(id)
    const area = box(traceOf(id, blockersOf, waitersOf))
    if (area !== undefined) view.zoomTo(area)
  }
  const release = (): void => {
    setHeld(undefined)
    view.fit()
  }

  // A node stepped to with the keys scrolls into the frame.
  const graphRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const graph = graphRef.current
    if (focusedId === undefined || graph === null || !graph.contains(document.activeElement)) {
      return
    }
    graph
      .querySelector(`[data-slot="chain-node"][data-id="${CSS.escape(focusedId)}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [focusedId])

  const share = (id: string): ReturnType<typeof rowFocus> | undefined => {
    const i = focusIndex.get(id)
    if (focus === undefined || i === undefined) return undefined
    return rowFocus(focus as ListFocus<unknown>, i)
  }
  // With a shared focus the graph is one tab stop whose arrows step the focus; Enter activates the
  // focused node, as a click on it does.
  const shared = focus === undefined ? undefined : listFocus(focus as ListFocus<unknown>)
  // Zoom and focus keys work from the frame, a node and the controls; never from a field.
  const zoomKeys = (event: KeyboardEvent<HTMLDivElement>): boolean => {
    if (event.altKey || event.ctrlKey || event.metaKey) return false
    if ((event.target as Element).closest('[data-slot="chain-list"], input, textarea') !== null) {
      return false
    }
    const act: Record<string, () => void> = {
      '+': () => view.zoomBy(ZOOM_STEP),
      '=': () => view.zoomBy(ZOOM_STEP),
      '-': () => view.zoomBy(1 / ZOOM_STEP),
      '0': () => view.fit(),
      f: () => {
        if (candidate !== undefined) hold(candidate)
      },
      Escape: () => {
        if (pinned !== undefined) release()
      },
    }
    const run = act[event.key.length === 1 ? event.key.toLowerCase() : event.key]
    if (run === undefined) return false
    if (event.key === 'Escape' && pinned === undefined) return false
    event.preventDefault()
    run()
    return true
  }
  // The stop is the graph's frame, outside the scrollport, so its ring is never cut by the scroll.
  const keys =
    shared === undefined || focus === undefined
      ? {}
      : {
          role: 'group',
          'aria-label': label,
          tabIndex: 0,
          onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
            if (event.defaultPrevented) return
            const at = focus.index === null ? undefined : focus.items[focus.index]
            if (event.key === 'Enter' && onActivate !== undefined && at !== undefined) {
              event.preventDefault()
              onActivate(at)
              return
            }
            shared.onKeyDown(event as unknown as KeyboardEvent<HTMLUListElement>)
          },
          onBlur: (event: FocusEvent<HTMLDivElement>) =>
            shared.onBlur(event as unknown as FocusEvent<HTMLUListElement>),
          onPointerLeave: (event: PointerEvent<HTMLDivElement>) =>
            shared.onPointerLeave(event as unknown as PointerEvent<HTMLUListElement>),
        }
  const waitsOnLine = (id: string): string | undefined => {
    const blockers = blockersOf.get(id) ?? []
    return blockers.length === 0
      ? undefined
      : t('lists.chainWaitsOn', blockers.map(titleOf).join(', '))
  }

  /** `roving`: a node of the graph, whose tab stop is the list when a focus is shared. */
  const body = (node: T, id: string, roving: boolean): ReactElement => {
    const own = faces.get(id) ?? { title: id }
    const blocked = isBlocked(id)
    const inner = <Face face={own} waitsOnLine={waitsOnLine(id)} />
    const className = cn(NODE, blocked && BLOCKED, onActivate !== undefined && TARGET)
    return onActivate === undefined ? (
      <div className={className} data-blocked={blocked ? '' : undefined}>
        {inner}
      </div>
    ) : (
      <button
        type="button"
        className={className}
        data-blocked={blocked ? '' : undefined}
        tabIndex={roving && focus !== undefined ? -1 : undefined}
        onClick={() => onActivate(node)}
      >
        {inner}
      </button>
    )
  }

  // The narrow list: each node under the first node it waits on, in reading order.
  const parents = parentsOf(
    inputs,
    (input) => input.id,
    (input) => input.waitsOn[0],
  )
  const children = new Map<string | undefined, string[]>()
  for (const input of inputs) {
    const parent = parents.get(input.id)
    children.set(parent, [...(children.get(parent) ?? []), input.id])
  }
  const nested: { id: string; level: number }[] = []
  const walk = (parent: string | undefined, level: number): void => {
    for (const id of children.get(parent) ?? []) {
      nested.push({ id, level })
      walk(id, level + 1)
    }
  }
  walk(undefined, 0)
  const byId = new Map(nodes.map((node) => [getId(node), node]))
  // Done edges first, so a port shared with a blocking edge shows the warn head on top.
  const edges = geometry.edges.toSorted(
    (a, b) => Number(faces.get(b.from)?.done === true) - Number(faces.get(a.from)?.done === true),
  )
  const percent = t('lists.chainZoomLevel', view.scale)

  return (
    <div
      data-slot="chain-view"
      className="@container flex min-w-0 flex-col gap-3"
      onKeyDownCapture={(event) => void zoomKeys(event)}
    >
      <div
        ref={graphRef}
        data-slot="chain-graph"
        data-zoom={view.scale.toFixed(3)}
        data-fitted={view.fitted ? '' : undefined}
        data-held={pinned}
        {...keys}
        className="hidden rounded-card focus-ring @regular:block"
      >
        <ScrollArea
          ref={frame}
          orientation="both"
          aria-label={label}
          style={view.room === undefined ? undefined : { maxHeight: view.room }}
        >
          <div
            data-slot="chain-canvas"
            className={cn('relative', view.pans && 'cursor-grab active:cursor-grabbing')}
            style={{
              width: geometry.width * view.scale,
              height: geometry.height * view.scale,
            }}
            {...view.drag}
          >
            <ul
              aria-label={label}
              className="absolute top-0 left-0 m-0 list-none p-0"
              style={{
                width: geometry.width,
                height: geometry.height,
                transform: `scale(${view.scale})`,
                transformOrigin: '0 0',
              }}
              onPointerLeave={() => setPointed(undefined)}
            >
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 overflow-visible"
                width={geometry.width}
                height={geometry.height}
              >
                <defs>
                  {(['blocks', 'done'] as const).map((state) => (
                    <marker
                      key={state}
                      id={`${marker}-${state}`}
                      viewBox="0 0 8 8"
                      refX="7.5"
                      refY="4"
                      markerWidth="5"
                      markerHeight="5"
                      orient="auto"
                    >
                      <path
                        d="M 0 0.5 L 7.5 4 L 0 7.5 Z"
                        fill={state === 'done' ? 'var(--basalt-line)' : 'var(--basalt-warn)'}
                      />
                    </marker>
                  ))}
                </defs>
                {edges.map((edge) => {
                  const done = faces.get(edge.from)?.done === true
                  const lit = trace === undefined || (trace.has(edge.from) && trace.has(edge.to))
                  return (
                    <path
                      key={`${edge.from}>${edge.to}`}
                      data-slot="chain-edge"
                      data-state={done ? 'done' : 'blocks'}
                      d={edge.path}
                      fill="none"
                      stroke={done ? 'var(--basalt-line)' : 'var(--basalt-warn)'}
                      strokeWidth={done ? 1.25 : 1.5}
                      strokeDasharray={done ? '4 3' : undefined}
                      markerEnd={`url(#${marker}-${done ? 'done' : 'blocks'})`}
                      opacity={lit ? 1 : 0.25}
                    />
                  )
                })}
              </svg>
              {nodes.map((node) => {
                const id = getId(node)
                const at = geometry.nodes.get(id)
                if (at === undefined) return null
                const dimmed = trace !== undefined && !trace.has(id)
                const own = share(id)
                return (
                  <li
                    key={id}
                    {...own}
                    data-slot="chain-node"
                    data-id={id}
                    // The trace, not the shared focus's own dimming: a node's blockers and waiters stay lit.
                    data-dimmed={dimmed ? '' : undefined}
                    className="group/node absolute transition-opacity data-dimmed:opacity-40 motion-reduce:transition-none"
                    style={
                      {
                        left: at.x,
                        top: at.y,
                        width: CHAIN_SIZE.width,
                        height: CHAIN_SIZE.height,
                      } as CSSProperties
                    }
                    onPointerEnter={(event) => {
                      own?.onPointerEnter?.(event)
                      setPointed(id)
                    }}
                  >
                    {body(node, id, true)}
                  </li>
                )
              })}
            </ul>
          </div>
        </ScrollArea>
      </div>
      <ul
        data-slot="chain-list"
        aria-label={label}
        className="m-0 flex list-none flex-col gap-2 p-0 @regular:hidden"
      >
        {nested.map(({ id, level }) => {
          const node = byId.get(id)
          if (node === undefined) return null
          const more = (blockersOf.get(id) ?? []).slice(1)
          return (
            <li
              key={id}
              data-slot="chain-list-node"
              data-level={String(level + 1)}
              className="flex min-w-0 flex-col gap-1"
              style={{ paddingInlineStart: `calc(var(--spacing) * ${level * 4})` }}
            >
              <div className="h-16">{body(node, id, false)}</div>
              {more.length > 0 && (
                <span className="truncate pl-3 text-xs text-muted-foreground">
                  {t('lists.chainAlsoWaitsOn', more.map(titleOf).join(', '))}
                </span>
              )}
            </li>
          )
        })}
      </ul>
      <div className="hidden flex-wrap items-center justify-between gap-3 @regular:flex">
        <Legend />
        <div
          data-slot="chain-controls"
          role="toolbar"
          aria-label={t('lists.chainControls')}
          className="flex items-center gap-1"
        >
          {pinned === undefined ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={candidate === undefined}
              onClick={() => {
                if (candidate !== undefined) hold(candidate)
              }}
            >
              {candidate === undefined
                ? t('lists.chainFocusNone')
                : t('lists.chainFocus', titleOf(candidate))}
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={release}>
              {t('lists.chainShowAll')}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            shape="icon"
            aria-label={t('lists.chainZoomOut')}
            onClick={() => view.zoomBy(1 / ZOOM_STEP)}
          >
            <StepIcon d={STEP_ICON.out} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`${t('lists.chainFit')}, ${percent}`}
            className="min-w-12 tabular-nums"
            onClick={view.fit}
          >
            {percent}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            shape="icon"
            aria-label={t('lists.chainZoomIn')}
            onClick={() => view.zoomBy(ZOOM_STEP)}
          >
            <StepIcon d={STEP_ICON.in} />
          </Button>
        </div>
      </div>
    </div>
  )
}
