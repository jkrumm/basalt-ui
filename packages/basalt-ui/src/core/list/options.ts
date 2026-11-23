/**
 * The option model every list shares (`Select`, `Combobox`, the command palette) and the pure step
 * from a source, a query and a rank to the rows a list draws. Nothing here renders.
 */
import type { ReactNode } from 'react'
import type { IconComponent } from '../ports'
import { defaultRank, labelText } from './rank'
import type { RankFn } from './rank'

/** What an option's avatar shows: a person's or an object's name, and an image or a glyph. */
export type ListAvatar = {
  name: string
  src?: string | undefined
  icon?: IconComponent | undefined
}

/** One choice of a list. Only `value` and `label` are required. */
export type ListOption<Value = string> = {
  value: Value
  /** The row's text; a string also names the value in the input and is what the rank reads. */
  label: ReactNode
  /** A second line under the label, in the open list only; the trigger and the input show the label. */
  description?: string | undefined
  /** Drawn before the label. `avatar` wins when both are set. */
  icon?: IconComponent | undefined
  /** A face before the label: a person or a company. */
  avatar?: ListAvatar | undefined
  /** Words the rank also matches besides the label. */
  keywords?: readonly string[] | undefined
  /** A short trailing text: a count, a code, a unit. */
  hint?: string | undefined
  disabled?: boolean | undefined
}

/** A labelled run of options. A group is data, so every list draws its header the same way. */
export type ListGroup<Value = string> = {
  label: string
  options: readonly ListOption<Value>[]
}

/** The items of a list: options, groups, or both. */
export type ListItems<Value = string> = readonly (ListOption<Value> | ListGroup<Value>)[]

/**
 * Loads the items for a query. The list calls it on open and on every query change and aborts the
 * last call through `signal`; an answer that arrives after a newer query is dropped either way.
 */
export type ListLoader<Value = string> = (
  query: string,
  context: { signal: AbortSignal },
) => Promise<ListItems<Value>>

/** A static array or a loader. */
export type ListSource<Value = string> = ListItems<Value> | ListLoader<Value>

export function isGroup<Value>(
  item: ListOption<Value> | ListGroup<Value>,
): item is ListGroup<Value> {
  return 'options' in item && Array.isArray(item.options)
}

/** Every option of the items, groups flattened, in declaration order. */
export function flatOptions<Value>(items: ListItems<Value>): ListOption<Value>[] {
  return items.flatMap((item) => (isGroup(item) ? item.options : [item]))
}

/** The text that names an option: its label when it is text, else its value. */
export function optionText<Value>(option: ListOption<Value>): string {
  const text = labelText(option.label)
  return text === '' ? String(option.value) : text
}

/** The row a creatable list ends with for the typed text; never a selected value. */
export const CREATE_ROW: unique symbol = Symbol('basalt.list.create')

export type ListRow<Value> =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'option'; key: string; option: ListOption<Value>; index: number; grouped: boolean }
  | { kind: 'create'; key: string; text: string; index: number }

export type ListModel<Value> = {
  rows: readonly ListRow<Value>[]
  /** The selectable values in row order (the create row as `CREATE_ROW`): Base UI's items. */
  values: readonly (Value | typeof CREATE_ROW)[]
}

export type BuildRowsInput<Value> = {
  items: ListItems<Value>
  query: string
  /** Applied to a static list; a loader filters its own answer and passes none. */
  rank?: RankFn<ListOption<Value>> | undefined
  /** Options the person created, drawn after the rest with no group. */
  created?: readonly ListOption<Value>[] | undefined
  /** A creatable list: adds the create row when the trimmed query names no option. */
  creatable?: boolean | undefined
}

/**
 * The rows for a query. The rank runs on the flat list, so its order holds across groups: a group
 * sits where its best row ranks and keeps its rows in ranked order; loose options form one run of
 * their own. With an empty query the rank returns the declared order.
 */
export function buildRows<Value>({
  items,
  query,
  rank,
  created = [],
  creatable = false,
}: BuildRowsInput<Value>): ListModel<Value> {
  const groupOf = new Map<ListOption<Value>, number>()
  const labels: string[] = []
  const flat: ListOption<Value>[] = []
  for (const item of items) {
    if (!isGroup(item)) {
      flat.push(item)
      continue
    }
    labels.push(item.label)
    for (const option of item.options) {
      groupOf.set(option, labels.length - 1)
      flat.push(option)
    }
  }
  // A created option the items already hold is not drawn twice. A loader's answer is already the
  // match, so with no rank a created option shows only while the query finds it.
  const fresh = created.filter(
    (made) => !flat.some((option) => Object.is(option.value, made.value)),
  )
  const extra = rank === undefined && query.trim() !== '' ? defaultRank(query, fresh) : fresh
  flat.push(...extra)
  const ranked = rank === undefined ? flat : rank(query, flat)

  const sections = new Map<number, ListOption<Value>[]>()
  for (const option of ranked) {
    const group = groupOf.get(option) ?? -1
    const section = sections.get(group)
    if (section === undefined) sections.set(group, [option])
    else section.push(option)
  }

  const rows: ListRow<Value>[] = []
  const values: (Value | typeof CREATE_ROW)[] = []
  for (const [group, options] of sections) {
    const label = labels[group]
    if (label !== undefined) rows.push({ kind: 'header', key: `group:${group}`, label })
    for (const option of options) {
      rows.push({
        kind: 'option',
        key: `option:${String(option.value)}`,
        option,
        index: values.length,
        grouped: label !== undefined,
      })
      values.push(option.value)
    }
  }

  const text = query.trim()
  const taken = flat.some((option) => optionText(option).toLowerCase() === text.toLowerCase())
  if (creatable && text !== '' && !taken) {
    rows.push({ kind: 'create', key: 'create', text, index: values.length })
    values.push(CREATE_ROW)
  }
  return { rows, values }
}
