/* oxlint-disable jsx-a11y/no-noninteractive-element-interactions -- the list is the one tab stop of a shared chart focus (listFocus), as RowList's is */
import type { CSSProperties, ReactElement } from 'react'
import { cn } from '../core/cn'
import { useMessages } from '../core/messages/use-messages'
import { lists } from '../core/messages/lists'
import type { ListFocus, Verdict } from '../core/ports'
import { parentsOf } from '../common/nest'
import { ScrollArea } from '../ui/scroll-area'
import { Status } from '../ui/status'
import { CHAIN_SIZE, chainLayout } from './chain-layout'
import { listFocus, rowFocus } from './list-focus'

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
   * is marked blocked.
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

/** The arrowhead at an edge's end: a 7 x 8 px triangle whose tip is the waiting node's side. */
function arrow(x: number, y: number): string {
  return `M ${x - 7} ${y - 4} L ${x} ${y} L ${x - 7} ${y + 4} Z`
}

const NODE =
  'relative flex h-full min-w-0 flex-col justify-center gap-1 overflow-hidden rounded-card border border-border bg-card px-3 text-left text-foreground shadow-card'
const TARGET =
  'w-full cursor-pointer hover:bg-accent focus-ring focus-visible:-outline-offset-2 group-data-focused/node:bg-accent'
/** A node waiting on an open blocker carries a bar in the warn fill on its leading edge. */
const BLOCKED = 'before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-warn'

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
      className="m-0 hidden list-none flex-wrap gap-4 p-0 text-xs text-muted-foreground @regular:flex"
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

/**
 * A dependency chain: nodes that wait on other nodes, drawn left to right with each blocker left
 * of what waits on it. An edge from an open node is solid in the warn hue and reads "blocks", one
 * from a done node is dashed and reads "done", and a node waiting on an open blocker carries the
 * warn bar. The graph scrolls sideways inside the scroll primitive; below 480 px of container it
 * is a nested list instead, each node under the first node it waits on with the rest named. It
 * shares a `focus` with a `DataTable` over the same records, so a node and its row are one item.
 * The layout is the kit's own (no dependency): it never pans or zooms, and nodes do not move.
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
  const ids = new Set(nodes.map(getId))
  const inputs = nodes.map((node) => ({
    id: getId(node),
    waitsOn: waitsOn(node).filter((id) => ids.has(id)),
  }))
  const geometry = chainLayout(inputs)
  const faces = new Map(nodes.map((node) => [getId(node), face(node)]))
  const titleOf = (id: string): string => faces.get(id)?.title ?? id
  const blockersOf = new Map(inputs.map((input) => [input.id, input.waitsOn]))
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
  const share = (id: string): ReturnType<typeof rowFocus> | undefined => {
    const i = focusIndex.get(id)
    if (focus === undefined || i === undefined) return undefined
    return rowFocus(focus as ListFocus<unknown>, i)
  }
  const keys = focus === undefined ? {} : listFocus(focus as ListFocus<unknown>)
  const waitsOnLine = (id: string): string | undefined => {
    const blockers = blockersOf.get(id) ?? []
    return blockers.length === 0 ? undefined : t('lists.chainWaitsOn', blockers.map(titleOf))
  }

  const body = (node: T, id: string): ReactElement => {
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
        tabIndex={focus === undefined ? undefined : -1}
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

  return (
    <div data-slot="chain-view" className="@container flex min-w-0 flex-col gap-3">
      <div data-slot="chain-graph" className="hidden @regular:block">
        <ScrollArea orientation="horizontal" aria-label={label}>
          <ul
            aria-label={label}
            {...keys}
            className="relative m-0 list-none p-0 focus-ring"
            style={{ width: geometry.width, height: geometry.height }}
          >
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-visible"
              width={geometry.width}
              height={geometry.height}
            >
              {geometry.edges.map((edge) => {
                const done = faces.get(edge.from)?.done === true
                const colour = done ? 'var(--basalt-line)' : 'var(--basalt-warn)'
                const lit =
                  focusedId === undefined || edge.from === focusedId || edge.to === focusedId
                return (
                  <g
                    key={`${edge.from}>${edge.to}`}
                    data-slot="chain-edge"
                    data-state={done ? 'done' : 'blocks'}
                    opacity={lit ? 1 : 0.3}
                  >
                    <path
                      d={edge.path}
                      fill="none"
                      stroke={colour}
                      strokeWidth={done ? 1.25 : 1.5}
                      {...(done && { strokeDasharray: '4 3' })}
                    />
                    <path d={arrow(edge.end.x, edge.end.y)} fill={colour} />
                  </g>
                )
              })}
            </svg>
            {nodes.map((node) => {
              const id = getId(node)
              const at = geometry.nodes.get(id)
              if (at === undefined) return null
              return (
                <li
                  key={id}
                  data-slot="chain-node"
                  data-id={id}
                  className="group/node absolute"
                  style={
                    {
                      left: at.x,
                      top: at.y,
                      width: CHAIN_SIZE.width,
                      height: CHAIN_SIZE.height,
                    } as CSSProperties
                  }
                  {...share(id)}
                >
                  {body(node, id)}
                </li>
              )
            })}
          </ul>
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
              <div className="h-16">{body(node, id)}</div>
              {more.length > 0 && (
                <span className="truncate pl-3 text-xs text-muted-foreground">
                  {t('lists.chainAlsoWaitsOn', more.map(titleOf))}
                </span>
              )}
            </li>
          )
        })}
      </ul>
      <Legend />
    </div>
  )
}
