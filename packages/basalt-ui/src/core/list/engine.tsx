/**
 * The list engine behind `Combobox`, a searchable `Select` and the command palette: one hook that
 * turns a source (static or a loader), a query, a rank and a create rule into rows, and one body
 * that draws those rows on Base UI's Combobox list, windowed through a `virtual` port (`VirtualList`)
 * past `VIRTUAL_THRESHOLD` rows. Base UI receives the exact flat values the body draws (`filter={null}`),
 * so its indices are the rows' indices, windowed or not.
 */
import { Autocomplete as BaseAutocomplete } from '@base-ui/react/autocomplete'
import { Combobox as BaseCombobox } from '@base-ui/react/combobox'
import { useEffect, useRef, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { useIsomorphicLayoutEffect } from '../../common/isomorphic-layout-effect'
import type { VirtualItem } from '../ports'
import {
  CheckMark,
  CreateRowText,
  ListStatusRow,
  OptionRowBody,
  groupLabelVariants,
  optionRowVariants,
} from './option-row'
import type { ListStatus, RowSize } from './option-row'
import { CREATE_ROW, buildRows, flatOptions, optionText } from './options'
import type { ListItems, ListLoader, ListModel, ListOption, ListRow, ListSource } from './options'
import type { RankFn } from './rank'

/** Past this many rows a list with a `virtual` port renders windowed. */
export const VIRTUAL_THRESHOLD = 100

/**
 * The windowing port a long list renders through: `VirtualList` from `basalt-ui/ui/virtual-list`
 * fits it. A port, as `DataTable`'s `virtual` is, so a list never imports the virtualizer peer.
 */
export type ListVirtual = (props: {
  count: number
  estimateSize(index: number): number
  getItemKey(index: number): string | number
  keepIndex?: number | undefined
  revealIndex?: number | undefined
  initialHeight?: number | undefined
  className?: string
  children(items: readonly VirtualItem[], totalSize: number): ReactNode
}) => ReactElement | null

/** The popup's list height bound in px (`max-h-80`), the first window before it is measured. */
const LIST_HEIGHT = 320

export type OptionListInput<Value> = {
  source: ListSource<Value>
  /** The query the rows answer; `''` lists everything. */
  query: string
  /** A loader runs only while the list is open. */
  open: boolean
  rank?: RankFn<ListOption<Value>> | undefined
  creatable?: boolean | undefined
  created?: readonly ListOption<Value>[] | undefined
}

export type OptionList<Value> = ListModel<Value> & {
  status: ListStatus
  error: unknown
  /** The option a value names, among every option seen: static, loaded or created. */
  find(value: unknown): ListOption<Value> | undefined
  /** The text naming a value: its option's label, else the value itself. */
  textOf(value: unknown): string
}

type Answer<Value> = { query: string; items: ListItems<Value> } | { query: string; error: unknown }

const NO_ITEMS: ListItems<never> = []

/**
 * The rows of a list for a query. A static source is ranked here; a loader is called on open and on
 * every query change, the last call aborted, and an answer that arrives after a newer query is
 * dropped even when the loader ignores `signal`. While a call for a new query runs, the previous
 * answer's rows stay and the status is `loading`; reopening on the same query refetches with the
 * last rows shown and the status left `ready`.
 */
export function useOptionList<Value>({
  source,
  query,
  open,
  rank,
  creatable = false,
  created = [],
}: OptionListInput<Value>): OptionList<Value> {
  const loader = typeof source === 'function' ? source : undefined
  const loaderRef = useRef<ListLoader<Value> | undefined>(loader)
  useIsomorphicLayoutEffect(() => {
    loaderRef.current = loader
  })
  const isAsync = loader !== undefined
  const [answer, setAnswer] = useState<Answer<Value> | undefined>(undefined)
  const [seen, setSeen] = useState<ReadonlyMap<unknown, ListOption<Value>>>(() => new Map())

  useEffect(() => {
    const load = loaderRef.current
    if (!open || load === undefined) return
    const controller = new AbortController()
    let current = true
    const run = async (): Promise<void> => {
      try {
        const items = await load(query, { signal: controller.signal })
        if (!current) return
        setAnswer({ query, items })
        setSeen((before) => {
          const next = new Map(before)
          for (const option of flatOptions(items)) next.set(option.value, option)
          return next
        })
      } catch (error: unknown) {
        if (current) setAnswer({ query, error })
      }
    }
    void run()
    return () => {
      current = false
      controller.abort()
    }
    // `isAsync` restarts the effect when a static source becomes a loader; the loader itself is read
    // from the ref so a new function each render does not reload.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- see above
  }, [isAsync, open, query])

  const items: ListItems<Value> = isAsync
    ? answer !== undefined && 'items' in answer
      ? answer.items
      : NO_ITEMS
    : (source as ListItems<Value>)
  const status: ListStatus = !isAsync
    ? 'ready'
    : answer === undefined || answer.query !== query
      ? 'loading'
      : 'error' in answer
        ? 'error'
        : 'ready'
  const model = buildRows({
    items,
    query,
    rank: isAsync ? undefined : rank,
    created,
    creatable: creatable && status !== 'loading',
  })

  const known = new Map<unknown, ListOption<Value>>(seen)
  for (const option of flatOptions(items)) known.set(option.value, option)
  for (const option of created) known.set(option.value, option)
  const find = (value: unknown): ListOption<Value> | undefined => known.get(value)
  const textOf = (value: unknown): string => {
    if (value === CREATE_ROW) return query.trim()
    const option = known.get(value)
    if (option !== undefined) return optionText(option)
    return value === null || value === undefined ? '' : String(value)
  }
  return {
    ...model,
    status,
    error: answer !== undefined && 'error' in answer ? answer.error : undefined,
    find,
    textOf,
  }
}

type Change = (value: unknown, details: never) => void
type Typing = (value: string, details: { reason: string }) => void
type Opening = (open: boolean, details: { reason: string }) => void
type Highlighting = (value: unknown, details: { reason: string; index: number }) => void

/** The Base UI Combobox root props the engine reads and owns; the rest pass through. */
export type ListRootInput = {
  options: ListSource<unknown>
  rank?: RankFn<ListOption<unknown>> | undefined
  onCreate?: ((text: string) => unknown) | undefined
  multiple?: boolean | undefined
  value?: unknown
  defaultValue?: unknown
  onValueChange?: unknown
  inputValue?: string | number | readonly string[] | undefined
  defaultInputValue?: string | number | readonly string[] | undefined
  onInputValueChange?: unknown
  open?: boolean | undefined
  defaultOpen?: boolean | undefined
  onOpenChange?: unknown
  onItemHighlighted?: unknown
  /** The text field sits in the popup as a search: it starts empty and never shows the selection. */
  searchInPopup?: boolean | undefined
  /** The windowing port; without it a long list renders every row. */
  virtual?: ListVirtual | undefined
}

export type ListRoot = {
  list: OptionList<unknown>
  highlight: ListHighlight
  /** The row index of the selected value (single mode), for a windowed list to open at it. */
  selectedIndex: number | undefined
  /** The port when the list is windowed, else undefined. */
  virtual: ListVirtual | undefined
  /** Spread on `BaseCombobox.Root`: items, value, text, open, highlight, windowing. */
  root: {
    multiple: boolean | undefined
    items: readonly unknown[]
    filter: null
    itemToStringLabel: (value: unknown) => string
    value: unknown
    onValueChange: never
    onInputValueChange: never
    onOpenChange: never
    onItemHighlighted: never
    virtualized: boolean
    inputValue: string
    open: boolean
  }
}

/**
 * The state a Base UI Combobox root needs to draw the engine's rows. It owns the selection (to swap
 * the create row for the created value) and mirrors the typed text and the open state. In single
 * mode the text is no query until the person types after opening: the input then shows the selected
 * label and the whole list opens under it, as Base UI does.
 */
export function useListRoot({
  options,
  rank,
  onCreate,
  multiple,
  value,
  defaultValue,
  onValueChange,
  inputValue,
  defaultInputValue,
  onInputValueChange,
  open,
  defaultOpen,
  onOpenChange,
  onItemHighlighted,
  searchInPopup = false,
  virtual: port,
}: ListRootInput): ListRoot {
  const single = multiple !== true
  // A single combobox shows the selected label in its input; a search field in a popup never does.
  const labelled = single && !searchInPopup
  const [created, setCreated] = useState<readonly ListOption<unknown>[]>([])
  const [inner, setInner] = useState<unknown>(defaultValue ?? (single ? null : []))
  const current = value !== undefined ? value : inner
  const [ownOpen, setOwnOpen] = useState(defaultOpen ?? false)
  const isOpen = open ?? ownOpen
  const [typedState, setTypedState] = useState(() =>
    String(inputValue ?? defaultInputValue ?? (labelled ? staticText(options, current) : '')),
  )
  const typed = inputValue !== undefined ? String(inputValue) : typedState
  const [typedSinceOpen, setTypedSinceOpen] = useState(false)
  const query = !single || typedSinceOpen ? typed : ''

  const list = useOptionList({
    source: options,
    query,
    open: isOpen,
    rank,
    creatable: onCreate !== undefined,
    created,
  })
  const highlight = useListHighlight()
  const virtual = windowed(port, list.rows.length)

  // The input is controlled (Base UI rewrites an uncontrolled one whenever the rows change), so
  // the selected label is written here: when the value changes from outside, on a pick, on close.
  const [synced, setSynced] = useState<unknown>(current)
  if (labelled && !Object.is(synced, current)) {
    setSynced(current)
    setTypedState(list.textOf(current))
  }

  const commit = (next: unknown, details: never): void => {
    setInner(next)
    if (single) {
      setSynced(next)
      setTypedState(labelled ? list.textOf(next) : '')
      setTypedSinceOpen(false)
    }
    ;(onValueChange as Change | undefined)?.(next, details)
  }
  const change: Change = (next, details) => {
    const picked = Array.isArray(next) ? next.includes(CREATE_ROW) : next === CREATE_ROW
    if (!picked || onCreate === undefined) return commit(next, details)
    const text = query.trim()
    const made = onCreate(text)
    const option: ListOption<unknown> = { value: made, label: text }
    setCreated([...created, option])
    if (!single) setTypedState('')
    commit(Array.isArray(next) ? next.map((v) => (v === CREATE_ROW ? made : v)) : made, details)
    if (labelled) setTypedState(text)
  }
  const typing: Typing = (next, details) => {
    setTypedState(next)
    if (TYPED.has(details.reason)) setTypedSinceOpen(true)
    ;(onInputValueChange as Typing | undefined)?.(next, details)
  }
  const opening: Opening = (next, details) => {
    setOwnOpen(next)
    // A closed combobox opens on its first key: that key already counts as typed.
    setTypedSinceOpen(next && TYPED.has(details.reason))
    if (!next && single) setTypedState(labelled ? list.textOf(current) : '')
    ;(onOpenChange as Opening | undefined)?.(next, details)
  }
  const highlighting: Highlighting = (item, details) => {
    highlight.onItemHighlighted(item, details)
    ;(onItemHighlighted as Highlighting | undefined)?.(item, details)
  }

  const at = single ? list.values.indexOf(current) : -1
  return {
    list,
    highlight,
    selectedIndex: at >= 0 ? at : undefined,
    virtual,
    root: {
      multiple,
      items: list.values,
      filter: null,
      itemToStringLabel: list.textOf,
      value: current,
      onValueChange: change as never,
      inputValue: typed,
      onInputValueChange: typing as never,
      onOpenChange: opening as never,
      onItemHighlighted: highlighting as never,
      virtualized: virtual !== undefined,
      open: isOpen,
    },
  }
}

/** The reasons Base UI gives when the person typed or pasted into the input. */
const TYPED: ReadonlySet<string> = new Set(['input-change', 'input-paste'])

/** The port when `count` rows pass the threshold, else undefined: a short list is never windowed. */
export function windowed(port: ListVirtual | undefined, count: number): ListVirtual | undefined {
  return count > VIRTUAL_THRESHOLD ? port : undefined
}

/** The text of a value before any list has rendered: a static option's label, else the value. */
function staticText(options: ListSource<unknown>, value: unknown): string {
  if (value === null || value === undefined) return ''
  const option =
    typeof options === 'function'
      ? undefined
      : flatOptions(options).find((candidate) => Object.is(candidate.value, value))
  return option === undefined ? String(value) : optionText(option)
}

/** The highlighted row and the row to scroll to, for a windowed list. */
export type ListHighlight = {
  active: number
  reveal: number | undefined
  onItemHighlighted(value: unknown, details: { reason: string; index: number }): void
}

/**
 * Follows Base UI's highlight for a windowed list: the active row stays mounted, and a highlight
 * that the pointer did not make (a key, typing, the list changing) scrolls it into view.
 */
export function useListHighlight(): ListHighlight {
  const [active, setActive] = useState(-1)
  const [reveal, setReveal] = useState<number | undefined>(undefined)
  return {
    active,
    reveal,
    onItemHighlighted: (_value, { reason, index }) => {
      setActive(index)
      if (reason !== 'pointer' && index >= 0) setReveal(index)
    },
  }
}

export type ListBodyProps<Value> = {
  list: OptionList<Value>
  size: RowSize
  /** Which Base UI root the rows sit in. */
  kind: 'combobox' | 'autocomplete'
  highlight: ListHighlight
  /** The windowing port, set only past the threshold (`windowed`). */
  virtual: ListVirtual | undefined
  empty?: ReactNode
  /** The selected value's option index: a windowed list opens scrolled to it. */
  selectedIndex?: number | undefined
  /** Draw the check of the selected value. The palette selects nothing and draws none. */
  checked?: boolean | undefined
  /** A row's trailing part after its hint: a shortcut's keys. */
  trailing?: ((option: ListOption<Value>) => ReactNode) | undefined
  /** Called when a row is clicked, before Base UI selects it. */
  onRowClick?: ((option: ListOption<Value>) => void) | undefined
}

type Heights = { row: number; tall: number; header: number }

/** Row heights until the probes are measured (and in a DOM that does not lay out). */
const FALLBACK: Record<RowSize, Heights> = {
  sm: { row: 24, tall: 36, header: 22 },
  md: { row: 32, tall: 44, header: 28 },
  lg: { row: 40, tall: 52, header: 30 },
}

function measure(node: HTMLElement, fallback: Heights): Heights {
  const [row, tall, header] = [...node.children].map(
    (child) => child.getBoundingClientRect().height,
  )
  return {
    row: row !== undefined && row > 0 ? row : fallback.row,
    tall: tall !== undefined && tall > 0 ? tall : fallback.tall,
    header: header !== undefined && header > 0 ? header : fallback.header,
  }
}

/**
 * Invisible rows of each shape, measured once, so a windowed list positions its rows at their real
 * height under any density, size or pointer.
 */
function useRowHeights(size: RowSize): [Heights, (node: HTMLDivElement | null) => void] {
  const [heights, setHeights] = useState<Heights>(FALLBACK[size])
  const probe = (node: HTMLDivElement | null): void => {
    if (node === null) return
    const next = measure(node, FALLBACK[size])
    if (next.row !== heights.row || next.tall !== heights.tall || next.header !== heights.header)
      setHeights(next)
  }
  return [heights, probe]
}

function Probes({
  size,
  probe,
}: {
  size: RowSize
  probe: (node: HTMLDivElement | null) => void
}): ReactElement {
  return (
    <div
      ref={probe}
      aria-hidden="true"
      className="pointer-events-none invisible absolute inset-x-0 top-0 -z-10"
    >
      <div className={optionRowVariants({ size })}>
        <OptionRowBody option={{ label: 'M' }} size={size} />
      </div>
      <div className={optionRowVariants({ size })}>
        <OptionRowBody option={{ label: 'M', description: 'M' }} size={size} />
      </div>
      <span className={groupLabelVariants({ size })}>M</span>
    </div>
  )
}

/**
 * The open list's inside: the state row, then the rows. Grouped rows sit in Base UI groups; past
 * `VIRTUAL_THRESHOLD` rows the list is windowed and a header is a row of its own.
 */
export function OptionListBody<Value>({
  list,
  size,
  kind,
  highlight,
  virtual,
  empty,
  selectedIndex,
  checked = true,
  trailing,
  onRowClick,
}: ListBodyProps<Value>): ReactElement {
  const List = kind === 'combobox' ? BaseCombobox.List : BaseAutocomplete.List
  const Item = kind === 'combobox' ? BaseCombobox.Item : BaseAutocomplete.Item
  const [heights, probe] = useRowHeights(size)
  const { rows } = list

  const item = (row: ListRow<Value>, windowed: boolean): ReactNode => {
    if (row.kind === 'header') {
      return windowed ? (
        <div
          key={row.key}
          data-slot="option-group-label"
          aria-hidden="true"
          className={groupLabelVariants({ size })}
        >
          {row.label}
        </div>
      ) : null
    }
    if (row.kind === 'create') {
      return (
        <Item
          key={row.key}
          value={CREATE_ROW}
          {...(windowed && { index: row.index })}
          data-slot="option-create"
          className={optionRowVariants({ size })}
        >
          <CreateRowText text={row.text} />
        </Item>
      )
    }
    const { option } = row
    return (
      <Item
        key={row.key}
        value={option.value}
        disabled={option.disabled ?? false}
        {...(windowed && { index: row.index })}
        {...(onRowClick !== undefined && { onClick: () => onRowClick(option) })}
        data-slot="option-row"
        className={optionRowVariants({ size })}
      >
        <OptionRowBody
          option={option}
          size={size}
          trailing={trailing?.(option)}
          check={
            checked && kind === 'combobox' ? (
              <BaseCombobox.ItemIndicator render={<CheckMark />} />
            ) : undefined
          }
        />
      </Item>
    )
  }

  const status = (
    <ListStatusRow
      status={list.status}
      error={list.error}
      empty={empty}
      hasRows={rows.length > 0}
      size={size}
    />
  )

  if (virtual !== undefined) {
    const Window = virtual
    const rowOf = rows.flatMap((row, at) => (row.kind === 'header' ? [] : [at]))
    // Until a key moves the highlight, the window holds and shows the selected row.
    const kept = highlight.active >= 0 ? highlight.active : selectedIndex
    const shown = highlight.reveal ?? selectedIndex
    const keep = kept === undefined ? undefined : rowOf[kept]
    const reveal = shown === undefined ? undefined : rowOf[shown]
    const heightOf = (at: number): number => {
      const row = rows[at]
      if (row === undefined || row.kind === 'header') return heights.header
      return row.kind === 'option' && row.option.description !== undefined
        ? heights.tall
        : heights.row
    }
    return (
      <>
        {status}
        <Probes size={size} probe={probe} />
        <List data-slot="option-list" className="outline-none">
          <Window
            className="max-h-80"
            count={rows.length}
            estimateSize={heightOf}
            getItemKey={(at) => rows[at]?.key ?? at}
            keepIndex={keep}
            revealIndex={reveal}
            initialHeight={LIST_HEIGHT}
          >
            {([entry]) =>
              entry === undefined ? null : item(rows[entry.index] as ListRow<Value>, true)
            }
          </Window>
        </List>
      </>
    )
  }

  const runs: ReactNode[] = []
  for (let at = 0; at < rows.length; at += 1) {
    const row = rows[at] as ListRow<Value>
    if (row.kind !== 'header') {
      runs.push(item(row, false))
      continue
    }
    const members: ReactNode[] = []
    while (rows[at + 1]?.kind === 'option' && (rows[at + 1] as { grouped: boolean }).grouped) {
      at += 1
      members.push(item(rows[at] as ListRow<Value>, false))
    }
    runs.push(
      <BaseCombobox.Group key={row.key} data-slot="option-group">
        <BaseCombobox.GroupLabel
          data-slot="option-group-label"
          className={groupLabelVariants({ size })}
        >
          {row.label}
        </BaseCombobox.GroupLabel>
        {members}
      </BaseCombobox.Group>,
    )
  }
  return (
    <>
      {status}
      <List data-slot="option-list" className="outline-none">
        {runs}
      </List>
    </>
  )
}
