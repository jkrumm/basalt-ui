/**
 * `useChartFocus` — the focus-and-readout half of the geometry seam (`v3-expr-1-seam`). One focused
 * datum that three readers share: the marks dim the rest against it, a card fact reads it through
 * `readout` (the total again on leave), and one polite live region says it.
 *
 * A host (`CartesianChart`, `Heatmap`) takes the handle as `focus` and owns the tab stop and the
 * live region. A page that draws its own marks, a list of `Meter`s included, spreads `focus.target`
 * on the container, `focus.item(i)` on each mark, and renders `focus.live` once. A list of a coarser grain beside it
 * (versions beside samples) spreads `focus.groupItem(name)` on each row and shares the one focus.
 */
import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactElement } from 'react'
import type {
  ChartFocus,
  ChartFocusGroupItem,
  ChartFocusItem,
  ChartFocusOptions,
  ChartFocusTarget,
} from './contract'
import { FOCUS_RELEASE, RELEASE_MS } from '../core/focus-release'
import type { ReleaseSide } from '../core/focus-release'
import { chartCursor } from './core/cursor'

export type {
  ChartFocus,
  ChartFocusGroupItem,
  ChartFocusItem,
  ChartFocusOptions,
  ChartFocusTarget,
} from './contract'

/** What an engine host spreads on the wrapper around the engine: the one tab stop and its keys. */
export type HostFocusProps = {
  tabIndex: 0
  role: 'group'
  'aria-roledescription': string
  'aria-label': string
  onKeyDown: (event: KeyboardEvent<Element>) => void
  onBlur: () => void
  'data-chart-focus': ''
}

/**
 * The wrapper props of an engine host with a `focus` (the engine's own keyboard is off: TanStack's
 * cursor-bound focus never reports a point back, and a host must step its own order). `step` maps
 * a key to the next item index (`null` clears, `undefined` is not ours); `onStep` sees each result
 * after the focus is set.
 */
export function hostFocusProps<D>(
  focus: ChartFocus<D>,
  label: string,
  step: (key: string, index: number | null) => number | null | undefined = (key) => focus.step(key),
  onStep?: (index: number | null) => void,
): HostFocusProps {
  const go = (next: number | null): void => {
    focus.set(next)
    onStep?.(next)
  }
  return {
    tabIndex: 0,
    role: 'group',
    'aria-roledescription': 'chart',
    'aria-label': label,
    onKeyDown: (event) => {
      const next = step(event.key, focus.index)
      if (next === undefined) return
      event.preventDefault()
      go(next)
    },
    onBlur: () => go(null),
    'data-chart-focus': '',
  }
}

/**
 * The focus wrapper takes the place a bare engine box has in the chart root: the root's height
 * (`100%`, shrunk by the legend row under it), so a `fill` box inside it still fills its card.
 */
const WRAP_STYLE: CSSProperties = { height: '100%', flex: '0 1 auto', minHeight: 0 }

/** An engine host's body: wrapped in the focus tab stop with its live region, or as it is. */
export function FocusWrap(props: {
  props: HostFocusProps | undefined
  live: ReactElement | undefined
  children: ReactElement
}): ReactElement {
  if (props.props === undefined) return props.children
  return (
    <div {...props.props} style={WRAP_STYLE}>
      {props.children}
      {props.live}
    </div>
  )
}

/**
 * The setter a chart host uses for what its own pointer reports. A row that set the focus on pointer
 * entry holds it against a chart's clear: the engine reports its pointer leave (or an empty cursor)
 * after the row's enter whenever the pointer crosses the chart on its way, and that clear must not
 * undo the row. A chart's focus of an item, the row's own leave and a key all still replace it.
 */
const CHART_SET = Symbol('basalt.chartSet')

type ChartSide = { [CHART_SET]?: (next: number | null) => void }

function chartSet<D>(focus: ChartFocus<D>): (next: number | null) => void {
  return (focus as ChartFocus<D> & ChartSide)[CHART_SET] ?? focus.set
}

const timeOf = (v: unknown): unknown => (v instanceof Date ? v.getTime() : v)

/**
 * A cartesian host's focus rides the shared cursor of its group: the engine publishes the hovered
 * x there, and the host's own arrow keys publish the stepped item's x. Each cursor change maps back
 * to the item at that x; a cleared cursor clears the focus. Returns the wrapper props, or
 * `undefined` without a `focus`.
 */
export function useCursorFocus<D>(
  focus: ChartFocus<D> | undefined,
  options: { group: string | undefined; x: (d: D) => unknown; label: string },
): HostFocusProps | undefined {
  const { group, x, label } = options
  const follow = useEffectEvent(() => {
    if (focus === undefined) return
    const set = chartSet(focus)
    const state = chartCursor(group).getState()
    if (state === null) return set(null)
    if (state.anchor !== 'value' || state.value.x === undefined) return
    const at = timeOf(state.value.x)
    const index = focus.items.findIndex((d) => timeOf(x(d)) === at)
    set(index >= 0 ? index : null)
  })
  const active = focus !== undefined
  useEffect(() => (active ? chartCursor(group).subscribe(follow) : undefined), [active, group])
  if (focus === undefined) return undefined
  const publish = (index: number | null): void => {
    const d = index === null ? undefined : focus.items[index]
    const cursor = chartCursor(group)
    if (d === undefined) return cursor.setState(null)
    cursor.setState({
      anchor: 'value',
      value: { x: x(d) as Date | number | string },
      source: 'keyboard',
      pinned: false,
    })
  }
  return hostFocusProps(focus, label, (key, index) => stepInX(focus, x, key, index), publish)
}

/**
 * The next index for a key, stepping in x order when every x is a number or a time: the data may
 * come in any order (a ranking, a descending list), the arrow keys walk the axis. A categorical
 * x keeps the data's own order, which is the axis order of a band.
 */
function stepInX<D>(
  focus: ChartFocus<D>,
  x: (d: D) => unknown,
  key: string,
  index: number | null,
): number | null | undefined {
  const xs = focus.items.map((d) => timeOf(x(d)) as number)
  if (!/^(Arrow(Left|Right)|Home|End)$/.test(key) || xs.some((v) => typeof v !== 'number'))
    return focus.step(key)
  const order = xs.map((_, i) => i).sort((a, b) => xs[a]! - xs[b]!)
  const next = stepFocus(key, index === null ? null : order.indexOf(index), xs.length)
  return typeof next === 'number' ? order[next] : next
}

const noRef = (): void => undefined

/**
 * A mark's ref: the element joins its index's set while mounted. A chart mark and a list row can stand
 * on one index, so the set keeps both, and one unmount removes only its own element. The closure
 * holds its element, because React detaches a ref by calling the function it attached.
 */
function markRef(marks: Map<number, Set<Element>>, i: number): (element: Element | null) => void {
  let node: Element | null = null
  return (element) => {
    if (node !== null) marks.get(i)?.delete(node)
    node = element
    if (element === null) return
    marks.set(i, (marks.get(i) ?? new Set<Element>()).add(element))
  }
}

/** Visually hidden, still read: the live region speaks without taking room. */
const HIDDEN: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

/**
 * The live regions mounted for one focus, first mounted first. Two charts on one `useChartFocus`
 * each render `focus.live`, and one move must be said once: only the first mounted region speaks.
 */
type LiveClaims = { ids: string[]; listeners: Set<() => void> }

function newClaims(): LiveClaims {
  return { ids: [], listeners: new Set() }
}

function claim(claims: LiveClaims, id: string): () => void {
  claims.ids = [...claims.ids, id]
  for (const notify of claims.listeners) notify()
  return () => {
    claims.ids = claims.ids.filter((other) => other !== id)
    for (const notify of claims.listeners) notify()
  }
}

/** The polite live region of a focus; a second one on the same focus draws nothing. */
function FocusLive(props: { claims: LiveClaims; text: string }): ReactElement | null {
  const { claims, text } = props
  const id = useId()
  useLayoutEffect(() => claim(claims, id), [claims, id])
  const speaker = useSyncExternalStore(
    (notify) => {
      claims.listeners.add(notify)
      return () => claims.listeners.delete(notify)
    },
    () => claims.ids[0],
    () => undefined,
  )
  if (speaker !== undefined && speaker !== id) return null
  return (
    <output aria-live="polite" aria-atomic="true" style={HIDDEN} data-chart-focus-live="">
      {text}
    </output>
  )
}

/**
 * The handler an engine host passes `ChartEngine` as `onFocusDatum`: the engine's focused point
 * (pointer or its own arrow keys) back to an index of `focus.items`. An engine datum is the item
 * itself or a wrapper holding it as `datum` (a cartesian row, a heat-grid cell); one that names no
 * item clears the focus.
 */
export function engineFocusHandler<D>(
  focus: ChartFocus<D> | undefined,
): ((datum: unknown) => void) | undefined {
  if (focus === undefined) return undefined
  return (datum) => {
    const set = chartSet(focus)
    if (datum === null || datum === undefined) return set(null)
    const direct = focus.items.indexOf(datum as D)
    if (direct >= 0) return set(direct)
    const inner =
      typeof datum === 'object' && 'datum' in datum
        ? (datum as { datum: unknown }).datum
        : undefined
    const index = inner === undefined ? -1 : focus.items.indexOf(inner as D)
    set(index >= 0 ? index : null)
  }
}

/** The next index for a key, or `undefined` when the key is not ours. `null` clears. */
export function stepFocus(
  key: string,
  index: number | null,
  count: number,
  columns = 1,
): number | null | undefined {
  if (count === 0) return undefined
  const last = count - 1
  const clamp = (i: number): number => Math.min(last, Math.max(0, i))
  const grid = columns > 1
  const by = (delta: number, from: number): number => (index === null ? from : clamp(index + delta))
  switch (key) {
    case 'ArrowRight':
      return by(1, 0)
    case 'ArrowLeft':
      return by(-1, last)
    case 'ArrowDown':
      return by(grid ? columns : 1, 0)
    case 'ArrowUp':
      return by(grid ? -columns : -1, last)
    case 'Home':
      return 0
    case 'End':
      return last
    case 'Escape':
      return null
    default:
      return undefined
  }
}

/** The nearest ancestor that scrolls its overflow on either axis, or `null`. */
function scrollRegionOf(node: Element): HTMLElement | null {
  if (typeof getComputedStyle === 'undefined') return null
  for (let at = node.parentElement; at !== null; at = at.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(at)
    const y = (overflowY === 'auto' || overflowY === 'scroll') && at.scrollHeight > at.clientHeight
    const x = (overflowX === 'auto' || overflowX === 'scroll') && at.scrollWidth > at.clientWidth
    if (x || y) return at
  }
  return null
}

/** The element holding the document's focus (a chart's tab stop, a list, a row), or `null` when none does. */
function focusHolder(): Element | null {
  if (typeof document === 'undefined') return null
  const at = document.activeElement
  return at === null || at === document.body || at === document.documentElement ? null : at
}

/** A node with a box: the phone card or the table row of the tier that is not showing has none. */
const isDrawn = (node: Element): boolean => node.getClientRects().length > 0

/**
 * Scrolls `node` into its own list's region by the least distance, and nothing else. A region the
 * pointer is in never moves: that is the page (the shell's scrollport) or the list itself, and
 * scrolling it would carry the chart or the row away from the pointer that set the focus.
 * `scrollIntoView` cannot be told to stop at one ancestor, so the region's offsets are set directly.
 */
function revealInOwnRegion(nodes: readonly Element[]): void {
  const held = focusHolder()
  const byRegion = new Map<HTMLElement, Element[]>()
  for (const node of nodes) {
    if (!isDrawn(node)) continue
    const region = scrollRegionOf(node)
    if (region === null || region.matches(':hover')) continue
    // The region holding the focused element (a chart at 390 sits in the page's) never moves for a node
    // outside that element: it would carry the chart out of view.
    if (held !== null && region.contains(held) && !held.contains(node)) continue
    byRegion.set(region, [...(byRegion.get(region) ?? []), node])
  }
  for (const [region, own] of byRegion) scrollRegionTo(region, own)
}

/**
 * Scrolls `region` by the least distance that shows `nodes` together, or, when they are taller than the
 * region, the first of them alone: a held run comes into view whole where it fits.
 */
function scrollRegionTo(region: HTMLElement, nodes: readonly Element[]): void {
  const first = nodes[0]
  if (first === undefined) return
  const r = region.getBoundingClientRect()
  const boxes = nodes.map((n) => n.getBoundingClientRect())
  const top = Math.min(...boxes.map((b) => b.top))
  const bottom = Math.max(...boxes.map((b) => b.bottom))
  const left = Math.min(...boxes.map((b) => b.left))
  const right = Math.max(...boxes.map((b) => b.right))
  const fits = bottom - top <= r.height && right - left <= r.width
  const [t, b, l, rt] = fits
    ? [top, bottom, left, right]
    : [boxes[0]!.top, boxes[0]!.bottom, boxes[0]!.left, boxes[0]!.right]
  const dy = t < r.top ? t - r.top : b > r.bottom ? b - r.bottom : 0
  const dx = l < r.left ? l - r.left : rt > r.right ? rt - r.right : 0
  if (dy !== 0) region.scrollTop += dy
  if (dx !== 0) region.scrollLeft += dx
}

/** Brings `node` into view by the least scroll, at once: a list that glides under a pointer, or under reduced motion, is motion nobody asked for. */
function scrollNodeIntoView(node: Element | undefined): void {
  if (node === undefined || typeof node.scrollIntoView !== 'function') return
  node.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
}

/** The items of a focus whose data has not arrived: one array, so the handle keeps its identity while it waits. */
const NO_ITEMS: readonly never[] = []

/**
 * The focus handle for `items`, in reading order (the order arrow keys step).
 *
 * ```tsx
 * const focus = useChartFocus(rows, { announce: (d) => `${d.stage}: ${duration(d.ms)}` })
 * <ChartCard title="Pace" footer={[{ label: 'Behind best', value: focus.readout(total, (d) => d.behind) }]}
 *   chart={<CartesianChart … focus={focus} />} />
 * ```
 *
 * `items` is `undefined` until the query settles: `useChartFocus(query.data, …)` is the one loading shape, so
 * no fallback array stands in for data that is not there (a `phase` on the card says it is loading).
 * With no items nothing is focused and a held index reads as none.
 *
 * A mark spreading `focus.item(i)` is dimmed by the kit while another is focused, at the opacity
 * the kit's own marks use; a page sets no opacity of its own. With `group`, PageUp and PageDown step
 * by group, and a list of groups beside the marks spreads `focus.groupItem(name)` on each row to
 * share the focus both ways. A list of the same grain spreads `focus.item(i)` instead. A list whose
 * rows are the chart's series (one row per line) spreads `focus.seriesItem(key)`: pointing at a row
 * emphasises its series across every x as the legend does, and the legend marks the row. A list whose
 * rows stand for several items each (a window of hours, the probe of a finding) calls
 * `focus.hold(indexes)`, as `DataTable focusItems` does: every held item is focused, a cartesian
 * host draws the run as one x band, and `focus.span` reads them. Leaving a row
 * keeps its group focused, so crossing the gap to the next row or to the chart never flickers; leaving
 * the chart's container or a blur clears it.
 *
 * @useWhen a chart, a heat grid, a meter or hand-drawn marks should dim the rest around one datum and drive a readout
 * @neverWhen only a tooltip is wanted (the hosts draw one already)
 */
export function useChartFocus<D>(
  settled: readonly D[] | undefined,
  options: ChartFocusOptions<D>,
): ChartFocus<D> {
  const items: readonly D[] = settled ?? (NO_ITEMS as readonly D[])
  const { announce, announceSpan, columns, group } = options
  // `entered`: the focus came into its group from outside it, so the announcement names the group.
  // `span`: every index `hold` set, in item order, when it held more than one.
  const [held, setHeld] = useState<{
    index: number
    entered: boolean
    span?: readonly number[]
  } | null>(null)
  // The series a list row or the chart's legend emphasises across every x.
  const [series, setSeries] = useState<string | null>(null)
  // A list's pointer leave asks for a release (`core/focus-release`): the clear waits for a grace
  // window, and any focus set in it (a row, the chart, a key) takes the wait over.
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancel = (): void => {
    if (pending.current === null) return
    clearTimeout(pending.current)
    pending.current = null
  }
  useEffect(
    () => () => {
      if (pending.current !== null) clearTimeout(pending.current)
    },
    [],
  )
  const release = (clear: () => void): void => {
    cancel()
    pending.current = setTimeout(() => {
      pending.current = null
      clear()
    }, RELEASE_MS)
  }
  const emphasise = (key: string | null): void => {
    cancel()
    setSeries(key)
  }
  // An index past the end (the items shrank) is no focus, without an effect to clear it.
  const index = held !== null && held.index < items.length ? held.index : null
  // The index the state will show once the sets queued so far have rendered, for an engine echo to compare against.
  const shown = useRef<number | null>(null)
  const datum = index === null ? null : (items[index] as D)
  // One identity while the hold and the items stand, so a host can key its drawing on it.
  const { inSpan, span } = useMemo(() => {
    const at = held === null || held.index >= items.length ? null : held.index
    const indexes = at === null ? [] : (held?.span?.filter((i) => i < items.length) ?? [at])
    return { inSpan: new Set(indexes), span: indexes.map((i) => items[i] as D) }
  }, [held, items])
  const groupAt = (i: number | null): string | undefined => {
    const d = i === null ? undefined : items[i]
    return group === undefined || d === undefined ? undefined : group(d)
  }
  // `reveal`: the focus came from outside the rows (the chart's pointer, a host's keys), so the
  // row it names comes into view in the scroll region it sits in. A row the pointer entered is
  // already under it, and a repeat of the held index never scrolls a list the viewer moved.
  const apply = (next: number | null, reveal: boolean): void => {
    if (next === null || next < 0 || next >= items.length) {
      shown.current = null
      return setHeld(null)
    }
    // The same focus is no change (an engine echoes it on every rebuild): setting it would render the owner again.
    if (next === shown.current && held?.span === undefined) return
    if (reveal && next !== index) revealInRegion(next)
    shown.current = next
    setHeld((was) => {
      const from = was === null || was.index >= items.length ? null : was.index
      // The same index keeps the same state: an engine host reports its focus on every render.
      if (from === next && was?.span === undefined) return was
      return { index: next, entered: from === null || groupAt(from) !== groupAt(next) }
    })
  }

  // Marks and group rows by key, so a keyboard step can scroll the focused one into view.
  const marks = useRef(new Map<number, Set<Element>>())
  const rows = useRef(new Map<string, Element>())
  // Every mark is drawn already, and focus changes no layout, so the step scrolls before it sets.
  // The focused marks come into view first, wherever they scroll. The joined row follows only inside the
  // scroll region it has to itself: when the chart and the row share a region (the page), scrolling it to
  // the row would carry the focused chart out of view (a 390 page puts the list under the chart).
  const reveal = (next: number): void => {
    const name = groupAt(next)
    const own = [...(marks.current.get(next) ?? [])]
    const held = focusHolder()
    for (const node of own) {
      // A mark of the element holding the focus scrolls wherever it must; a list row beside it only in its own region.
      if (held === null || held.contains(node)) scrollNodeIntoView(node)
      else revealInOwnRegion([node])
    }
    const row = name === undefined ? undefined : rows.current.get(name)
    if (row === undefined) return
    const region = scrollRegionOf(row)
    if (region === null || own.some((node) => region.contains(node))) return
    if (held !== null && region.contains(held) && !held.contains(row)) return
    scrollRegionTo(region, [row])
  }
  const revealInRegion = (...indexes: readonly number[]): void => {
    const nodes = indexes.flatMap((next) => {
      const name = groupAt(next)
      return [
        ...(marks.current.get(next) ?? []),
        ...(name === undefined || rows.current.get(name) === undefined
          ? []
          : [rows.current.get(name) as Element]),
      ]
    })
    revealInOwnRegion(nodes)
  }
  // `pointed`: the index a mark or row set by pointer entry, held against a chart's own clear.
  const pointed = useRef<number | null>(null)
  const set = (next: number | null): void => {
    cancel()
    pointed.current = null
    apply(next, true)
  }
  const point = (next: number): void => {
    cancel()
    pointed.current = next >= 0 ? next : null
    apply(next, false)
  }
  // Several items at once, as a pointer holds them: the first leads, and a chart's clear keeps them.
  const hold = (indexes: readonly number[]): void => {
    cancel()
    const valid = [...new Set(indexes)]
      .filter((i) => Number.isInteger(i) && i >= 0 && i < items.length)
      .toSorted((a, b) => a - b)
    const first = valid[0]
    if (first === undefined) return set(null)
    if (valid.length === 1) return point(first)
    // A run reveals its rows together where they fit (its first row alone where they do not), before the hold; a run already held does not move.
    const sameRun =
      held?.span !== undefined &&
      held.span.length === valid.length &&
      held.span.every((i, k) => i === valid[k])
    if (!sameRun) revealInRegion(...valid)
    pointed.current = first
    shown.current = first
    setHeld((was) => {
      const same =
        was !== null &&
        was.span !== undefined &&
        was.span.length === valid.length &&
        was.span.every((i, k) => i === valid[k])
      if (same) return was
      const from = was === null || was.index >= items.length ? null : was.index
      return {
        index: first,
        entered: from === null || groupAt(from) !== groupAt(first),
        span: valid,
      }
    })
  }
  const fromChart = (next: number | null): void => {
    if (next === null && pointed.current !== null) return
    // An engine echoes its focused datum back on every definition it rebuilds, and an app without the React
    // Compiler hands it a new one on each render, so an echo of the focus shown must set nothing (`apply`): the
    // set would render the owner, and that render the echo again. The span's own first item keeps the span.
    if (next !== null && next === index && held?.span !== undefined) return
    set(next)
  }

  const step = (key: string): number | null | undefined => {
    const next =
      key === 'PageUp' || key === 'PageDown'
        ? stepGroup(key, index, items, group)
        : stepFocus(key, index, items.length, columns)
    if (next !== undefined && next !== null && next !== index) reveal(next)
    return next
  }
  const target: ChartFocusTarget = {
    tabIndex: 0,
    role: 'group',
    'aria-roledescription': 'chart',
    onKeyDown: (event: KeyboardEvent<Element>) => {
      const next = step(event.key)
      if (next === undefined) return
      event.preventDefault()
      set(next)
    },
    onBlur: () => {
      set(null)
      emphasise(null)
    },
    // The container clears, never a mark: crossing the gap between two marks keeps the last one.
    onPointerLeave: (event: PointerEvent<Element>) => {
      // A tap ends in a leave: the tapped mark stays focused until the next tap or blur.
      if (event.pointerType === 'touch') return
      set(null)
      emphasise(null)
    },
  }
  const item = (i: number): ChartFocusItem => ({
    'data-chart-mark': '',
    ...(inSpan.has(i) && { 'data-focused': '' as const }),
    ...(index !== null && !inSpan.has(i) && { 'data-dimmed': '' as const }),
    ref: markRef(marks.current, i),
    onPointerEnter: () => point(i),
    onPointerDown: () => point(i),
  })
  const groupItem = (name: string): ChartFocusGroupItem => {
    const first = group === undefined ? -1 : items.findIndex((d) => group(d) === name)
    return {
      ...(index !== null && groupAt(index) === name && { 'data-focused': '' as const }),
      ref: (element) => {
        if (element === null) rows.current.delete(name)
        else rows.current.set(name, element)
      },
      onPointerEnter: () => point(first),
      onPointerDown: () => point(first),
    }
  }
  // A row per series: it emphasises its series on pointing and is marked while the series is. No
  // keyboard step lands on a series, so its row never needs scrolling into view: the ref is inert.
  const seriesItem = (key: string): ChartFocusGroupItem => ({
    ...(series === key && { 'data-focused': '' as const }),
    ref: noRef,
    onPointerEnter: () => emphasise(key),
    onPointerDown: () => emphasise(key),
  })
  const said =
    datum === null
      ? ''
      : span.length > 1
        ? (announceSpan?.(span) ?? `${announce(datum)} to ${announce(span.at(-1) as D)}`)
        : announce(datum)
  // Entering a group at a later item names the group by its first item's announcement, never by its
  // key (a key is an id as often as a name); entering at the first item says only that datum.
  const lead =
    held?.entered === true && index !== null && group !== undefined
      ? items.findIndex((d) => group(d) === groupAt(index))
      : -1
  const name = lead < 0 || lead === index ? undefined : announce(items[lead] as D)
  const [claims] = useState(newClaims)
  const live: ReactElement = (
    <FocusLive claims={claims} text={name === undefined ? said : `${name}: ${said}`} />
  )
  const handle: ChartFocus<D> & ChartSide & ReleaseSide = {
    [CHART_SET]: fromChart,
    [FOCUS_RELEASE]: release,
    items,
    index,
    datum,
    set,
    hold,
    span,
    // `read` also takes the held span (`[datum]` for one item) as a second argument.
    readout: (rest, read) =>
      datum === null ? rest : (read as (d: D, span: readonly D[]) => typeof rest)(datum, span),
    dimmed: (d) => datum !== null && !span.includes(d),
    target,
    item,
    groupItem,
    series,
    setSeries: emphasise,
    seriesItem,
    step,
    live,
  }
  return handle
}

/**
 * The index PageUp or PageDown moves to over contiguous groups, or `undefined` without a `group`.
 * PageDown goes to the next group's first item and stays put in the last group. PageUp goes to the
 * current group's first item, or to the previous group's first item from there. With no focus,
 * PageDown starts at the first item and PageUp at the last group's first item.
 */
export function stepGroup<D>(
  key: 'PageUp' | 'PageDown',
  index: number | null,
  items: readonly D[],
  group: ((d: D) => string) | undefined,
): number | undefined {
  if (group === undefined || items.length === 0) return undefined
  const starts = items.flatMap((d, i) =>
    i === 0 || group(d) !== group(items[i - 1] as D) ? [i] : [],
  )
  const last = starts.at(-1) as number
  if (index === null) return key === 'PageDown' ? 0 : last
  if (key === 'PageDown') return starts.find((s) => s > index) ?? index
  const own = starts.findLast((s) => s <= index) ?? 0
  if (index > own) return own
  return starts.findLast((s) => s < own) ?? own
}
