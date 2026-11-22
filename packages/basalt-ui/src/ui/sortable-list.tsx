import { cva } from 'class-variance-authority'
import { useEffect, useEffectEvent, useId, useRef, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { landing } from '../core/drag-landing'
import { sortable } from '../core/messages/sortable'
import { useMessages } from '../core/messages/use-messages'
import type { DragData, DragEdge, DragLike } from '../core/ports'

/**
 * The `SortableList` cva table: the list, a row (`data-dragging` at 30 %, `data-edge` draws the
 * drop line above or below it) and the 24 px handle.
 *
 * @example
 * sortableListVariants() // the list's class string
 */
export const sortableListVariants = cva('m-0 flex list-none flex-col gap-1 p-0')

const ROW =
  'relative flex min-h-ctl min-w-0 items-center gap-2 rounded-ctrl data-dragging:opacity-30 data-edge:before:pointer-events-none data-edge:before:absolute data-edge:before:inset-x-0 data-edge:before:h-0.5 data-edge:before:rounded-full data-edge:before:bg-brand data-[edge=before]:before:-top-0.5 data-[edge=after]:before:-bottom-0.5'

const HANDLE =
  'inline-flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-ctrl border-0 bg-transparent p-0 text-muted-foreground hover:bg-accent hover:text-foreground focus-ring active:cursor-grabbing pointer-coarse:size-11'

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const sortableListParts = ['sortable-list'] as const

/** The edge of `element` the pointer at `clientY` is over: its upper half is `before`. */
function edgeOf(element: Element, clientY: number): DragEdge {
  const { top, height } = element.getBoundingClientRect()
  return clientY < top + height / 2 ? 'before' : 'after'
}

/** A target takes a source of its own `scope` only, so two boards on one page never cross. */
const sameScope = (a: DragData, b: DragData): boolean => a['scope'] === b['scope']

type Engine = {
  adapter: typeof import('@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter')
  preview: typeof import('@atlaskit/pragmatic-drag-and-drop/utils/set-custom-native-drag-preview')
}

let loading: Promise<Engine> | undefined

/**
 * The library loads on the first registration, which runs in an effect: a server render and a
 * Node import of this module never reach it (its entry points are directories Node's ESM loader
 * refuses), and the list's first chunk stays free of it.
 */
const engineChunk = (): Promise<Engine> =>
  (loading ??= Promise.all([
    import('@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter'),
    import('@atlaskit/pragmatic-drag-and-drop/utils/set-custom-native-drag-preview'),
  ]).then(
    ([adapter, preview]) => ({ adapter, preview }),
    (error: unknown) => {
      loading = undefined // the next registration tries again
      throw error
    },
  ))

let reported = false

/** Registers once the library has loaded; the cleanup holds before and after it. */
function register(make: (engine: Engine) => () => void): () => void {
  let off: (() => void) | undefined
  let live = true
  engineChunk().then(
    (engine) => {
      if (live) off = make(engine)
    },
    (error: unknown) => {
      // The menu and keyboard paths still move everything; say once why drag is off.
      if (reported) return
      reported = true
      console.error('basalt-ui: the drag engine did not load, so drag is off.', error)
    },
  )
  return () => {
    live = false
    off?.()
  }
}

/**
 * The drag engine behind the `DragLike` port, on Pragmatic drag and drop's element adapter: the
 * one module of the package that imports it. Native drag events carry mouse, touch and pen alike,
 * and the registry is per element, so a virtualised row that unmounts mid-drag only drops out of
 * the targets. `tilt` draws the preview as a copy of the element turned 2 degrees with the overlay
 * shadow, held where the pointer took it. A test swaps the three methods (the seam `Board` and
 * `SortableList` both read).
 *
 * @example
 * <Board drag={drag} columns={columns} items={items} card={card} onMove={move} label="Issues" />
 */
export const drag: DragLike = {
  item({ element, handle, data, tilt, onDrag }) {
    return register(({ adapter, preview }) =>
      adapter.draggable({
        element,
        ...(handle === undefined ? {} : { dragHandle: handle }),
        getInitialData: () => ({ ...data }),
        onGenerateDragPreview({ nativeSetDragImage, location }) {
          if (tilt !== true) return
          const rect = element.getBoundingClientRect()
          const x = location.initial.input.clientX - rect.left
          const y = location.initial.input.clientY - rect.top
          preview.setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: () => ({ x: x + 8, y: y + 8 }),
            render({ container }) {
              const frame = document.createElement('div')
              frame.className = 'p-2'
              const copy = element.cloneNode(true) as HTMLElement
              copy.removeAttribute('data-dragging')
              copy.dataset['slot'] = 'drag-preview'
              copy.className = cn(copy.className, 'rotate-2 rounded-card shadow-overlay')
              copy.style.width = `${rect.width}px`
              frame.append(copy)
              container.append(frame)
            },
          })
        },
        onDragStart: () => onDrag?.(true),
        onDrop: () => onDrag?.(false),
      }),
    )
  },
  target({ element, data, onHover }) {
    let last: DragEdge | null = null
    const report = (edge: DragEdge | null): void => {
      if (edge === last) return
      last = edge
      onHover?.(edge)
    }
    return register(({ adapter }) =>
      adapter.dropTargetForElements({
        element,
        getData: () => ({ ...data }),
        canDrop: ({ source }) => sameScope(source.data as DragData, data),
        onDragEnter: ({ location }) => report(edgeOf(element, location.current.input.clientY)),
        onDrag: ({ location }) => report(edgeOf(element, location.current.input.clientY)),
        onDragLeave: () => report(null),
        onDrop: () => report(null),
      }),
    )
  },
  watch({ onStart, onDrop }) {
    return register(({ adapter }) =>
      adapter.monitorForElements({
        onDragStart: ({ source }) => onStart?.(source.data as DragData),
        onDrop({ source, location }) {
          const record = location.current.dropTargets[0]
          const target = record === undefined ? null : (record.data as DragData)
          const edge =
            record === undefined ? null : edgeOf(record.element, location.current.input.clientY)
          onDrop({ source: source.data as DragData, target, edge })
        },
      }),
    )
  },
}

export type SortableMove = { id: string; from: number; to: number }

export type SortableListProps<T extends { id: string }> = {
  /** The list's accessible name. */
  label: string
  items: readonly T[]
  /** The row's name in the handle's label and the announcement. */
  itemLabel(item: T): string
  /** Called once per finished move with the row's final index. */
  onMove(move: SortableMove): void
  /** The row's content, after its handle. */
  children(item: T, index: number): ReactNode
  /** Layout only. */
  className?: string | undefined
}

/**
 * A vertical list the user reorders: drag a row by its 24 px handle, or focus the handle and press
 * Arrow Up, Arrow Down, Home or End. Each finished move calls `onMove` once with the row's final
 * index, says where it went in a polite live region and keeps focus on the moved row's handle.
 * While a row is dragged it stays in place at 30 % and a line marks where it will land. The list
 * holds no order of its own: render `items` in the order `onMove` produced.
 *
 * @useWhen the user sets an order by hand: a settings list, the order of tabs or columns
 * @neverWhen the order is a sort the data defines (sort the table), or cards move between states (use Board)
 *
 * @example
 * <SortableList label="Sidebar" items={links} itemLabel={(l) => l.label}
 *   onMove={({ from, to }) => setLinks(reorder(links, from, to))}>
 *   {(link) => <span className="text-sm">{link.label}</span>}
 * </SortableList>
 */
export function SortableList<T extends { id: string }>({
  label,
  items,
  itemLabel,
  onMove,
  children,
  className,
}: SortableListProps<T>): ReactElement {
  const t = useMessages(sortable)
  const scope = useId()
  const hint = `${scope}-hint`
  const list = useRef<HTMLUListElement>(null)
  const [said, setSaid] = useState('')
  const focusId = useRef<string | null>(null)
  const move = (id: string, to: number): void => {
    const from = items.findIndex((row) => row.id === id)
    const row = items[from]
    if (row === undefined || to === from || to < 0 || to >= items.length) return
    onMove({ id, from, to })
    setSaid(t('sortable.moved', itemLabel(row), to + 1, items.length))
    focusId.current = id
  }

  const dropped = useEffectEvent((id: string, overId: string, edge: DragEdge): void => {
    const from = items.findIndex((row) => row.id === id)
    const over = items.findIndex((row) => row.id === overId)
    if (from >= 0 && over >= 0) move(id, landing(from, over, edge))
  })

  useEffect(
    () =>
      drag.watch({
        onDrop({ source, target, edge }) {
          if (source['scope'] !== scope || target === null || edge === null) return
          dropped(String(source['id']), String(target['id']), edge)
        },
      }),
    [scope],
  )

  // The moved row re-renders in its new place; its handle takes focus back.
  useEffect(() => {
    const id = focusId.current
    if (id === null) return
    focusId.current = null
    list.current
      ?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"] [data-sortable="handle"]`)
      ?.focus()
  }, [items])

  return (
    <>
      <ul
        ref={list}
        aria-label={label}
        data-slot="sortable-list"
        className={cn(sortableListVariants(), className)}
      >
        {items.map((item, index) => (
          <SortableRow
            key={item.id}
            id={item.id}
            scope={scope}
            name={itemLabel(item)}
            hint={hint}
            handleLabel={t('sortable.handle', itemLabel(item))}
            onKey={(key) => {
              const to = {
                ArrowUp: index - 1,
                ArrowDown: index + 1,
                Home: 0,
                End: items.length - 1,
              }[key]
              if (to === undefined) return false
              move(item.id, to)
              return true
            }}
          >
            {children(item, index)}
          </SortableRow>
        ))}
      </ul>
      <span id={hint} hidden>
        {t('sortable.hint')}
      </span>
      <output className="sr-only">{said}</output>
    </>
  )
}

type Key = 'ArrowUp' | 'ArrowDown' | 'Home' | 'End'

function SortableRow({
  id,
  scope,
  name,
  hint,
  handleLabel,
  onKey,
  children,
}: {
  id: string
  scope: string
  name: string
  hint: string
  handleLabel: string
  onKey(key: Key): boolean
  children: ReactNode
}): ReactElement {
  const row = useRef<HTMLLIElement>(null)
  const handle = useRef<HTMLButtonElement>(null)
  const [dragging, setDragging] = useState(false)
  const [edge, setEdge] = useState<DragEdge | null>(null)

  useEffect(() => {
    const element = row.current
    if (element === null || handle.current === null) return
    const data = { scope, id }
    const off = [
      drag.item({ element, handle: handle.current, data, onDrag: setDragging }),
      drag.target({ element, data, onHover: setEdge }),
    ]
    return () => {
      for (const cleanup of off) cleanup()
    }
  }, [scope, id])

  return (
    <li
      ref={row}
      data-sortable="item"
      data-id={id}
      data-dragging={dragging ? '' : undefined}
      data-edge={edge ?? undefined}
      className={ROW}
    >
      <button
        ref={handle}
        type="button"
        data-sortable="handle"
        aria-label={handleLabel}
        aria-describedby={hint}
        title={name}
        onKeyDown={(event) => {
          if (event.altKey || event.ctrlKey || event.metaKey) return
          if (onKey(event.key as Key)) event.preventDefault()
        }}
        className={HANDLE}
      >
        <Grip />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  )
}

function Grip(): ReactElement {
  return (
    <svg viewBox="0 0 16 16" className="size-icon" fill="currentColor" aria-hidden="true">
      <circle cx="6" cy="4" r="1.1" />
      <circle cx="10" cy="4" r="1.1" />
      <circle cx="6" cy="8" r="1.1" />
      <circle cx="10" cy="8" r="1.1" />
      <circle cx="6" cy="12" r="1.1" />
      <circle cx="10" cy="12" r="1.1" />
    </svg>
  )
}
