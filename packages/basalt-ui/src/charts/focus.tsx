/**
 * `useChartFocus` — the focus-and-readout half of the geometry seam (`v3-expr-1-seam`). One focused
 * datum that three readers share: the marks dim the rest against it, a card fact reads it through
 * `readout` (the total again on leave), and one polite live region says it.
 *
 * A host (`CartesianChart`, `Heatmap`, `Meter`) takes the handle as `focus` and owns the tab stop
 * and the live region. A page that draws its own marks spreads `focus.target` on the container,
 * `focus.item(i)` on each mark, and renders `focus.live` once.
 */
import { useEffect, useEffectEvent, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactElement } from 'react'
import type { ChartFocus, ChartFocusItem, ChartFocusOptions, ChartFocusTarget } from './contract'
import { chartCursor } from './core/cursor'

export type { ChartFocus, ChartFocusItem, ChartFocusOptions, ChartFocusTarget } from './contract'

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
  step: (key: string, index: number | null) => number | null | undefined = (key, index) =>
    stepFocus(key, index, focus.items.length),
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

/** An engine host's body: wrapped in the focus tab stop with its live region, or as it is. */
export function FocusWrap(props: {
  props: HostFocusProps | undefined
  live: ReactElement | undefined
  children: ReactElement
}): ReactElement {
  if (props.props === undefined) return props.children
  return (
    <div {...props.props}>
      {props.children}
      {props.live}
    </div>
  )
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
    const state = chartCursor(group).getState()
    if (state === null) return focus.set(null)
    if (state.anchor !== 'value' || state.value.x === undefined) return
    const at = timeOf(state.value.x)
    const index = focus.items.findIndex((d) => timeOf(x(d)) === at)
    focus.set(index >= 0 ? index : null)
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
  return hostFocusProps(focus, label, undefined, publish)
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
    if (datum === null || datum === undefined) return focus.set(null)
    const direct = focus.items.indexOf(datum as D)
    if (direct >= 0) return focus.set(direct)
    const inner =
      typeof datum === 'object' && 'datum' in datum
        ? (datum as { datum: unknown }).datum
        : undefined
    const index = inner === undefined ? -1 : focus.items.indexOf(inner as D)
    focus.set(index >= 0 ? index : null)
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

/**
 * The focus handle for `items`, in reading order (the order arrow keys step).
 *
 * ```tsx
 * const focus = useChartFocus(rows, { announce: (d) => `${d.stage}: ${duration(d.ms)}` })
 * <ChartCard title="Pace" footer={[{ label: 'Behind best', value: focus.readout(total, (d) => d.behind) }]}
 *   chart={<CartesianChart … focus={focus} />} />
 * ```
 *
 * @useWhen a chart, a heat grid, a meter or hand-drawn marks should dim the rest around one datum and drive a readout
 * @neverWhen only a tooltip is wanted (the hosts draw one already)
 */
export function useChartFocus<D>(
  items: readonly D[],
  options: ChartFocusOptions<D>,
): ChartFocus<D> {
  const { announce, columns } = options
  const [held, setHeld] = useState<number | null>(null)
  // An index past the end (the items shrank) is no focus, without an effect to clear it.
  const index = held !== null && held < items.length ? held : null
  const datum = index === null ? null : (items[index] as D)
  const set = (next: number | null): void =>
    setHeld(next === null || next < 0 || next >= items.length ? null : next)
  const target: ChartFocusTarget = {
    tabIndex: 0,
    role: 'group',
    'aria-roledescription': 'chart',
    onKeyDown: (event: KeyboardEvent<Element>) => {
      const next = stepFocus(event.key, index, items.length, columns)
      if (next === undefined) return
      event.preventDefault()
      set(next)
    },
    onBlur: () => set(null),
    onPointerLeave: (event: PointerEvent<Element>) => {
      // A tap ends in a leave: the tapped mark stays focused until the next tap or blur.
      if (event.pointerType !== 'touch') set(null)
    },
  }
  const item = (i: number): ChartFocusItem => ({
    ...(index === i && { 'data-focused': '' as const }),
    ...(index !== null && index !== i && { 'data-dimmed': '' as const }),
    onPointerEnter: () => set(i),
    onPointerDown: () => set(i),
  })
  const live: ReactElement = (
    <output aria-live="polite" aria-atomic="true" style={HIDDEN} data-chart-focus-live="">
      {datum === null ? '' : announce(datum)}
    </output>
  )
  return {
    items,
    index,
    datum,
    set,
    readout: (rest, read) => (datum === null ? rest : read(datum)),
    dimmed: (d) => datum !== null && d !== datum,
    target,
    item,
    live,
  }
}
