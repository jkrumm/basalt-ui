/**
 * `filterSlot(specs)`: the typed-data channel a composite takes its controls through. A composite
 * (`PageBar`, `Section`, `StatCard`, `ChartCard`, `DataPanel`, `AppShell globalControls`) gets a
 * `ControlsSlot`, never children, so a page author cannot hand it a raw `Select`. The slot draws
 * each spec with `ControlView`, which reads its presentation from the home around it.
 *
 * `filterSlot.custom(handle, label, render)` is the one escape: the author draws the input, the slot
 * keeps the label, the override cue and the reset. It is counted (`countEscapes`), and an app's
 * `.basalt/budget.json` caps it.
 */
import { use } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { useMessages } from '../core/messages/use-messages'
import { home as homeMessages } from '../core/messages/home'
import type { ControlHandle, ControlsSlot } from '../core/ports'
import { Lozenge } from '../ui/badge'
import { buttonVariants } from '../ui/button'
import type { ControlPresentation, FilterScope, FilterSpec } from './contract'
import { ControlPresentationContext, ControlView } from './control-view'
import { describeValue } from './renderers'
import type { ControlSize } from './renderers'

/** The name a counted escape carries; `lint --stats` and `countEscapes` count slots by it. */
export const FILTER_SLOT_CUSTOM = 'filterSlot.custom'

/** A slot made by `filterSlot.custom`: a `ControlsSlot` that says it is an escape. */
export type CustomControlsSlot = ControlsSlot & { readonly escape: typeof FILTER_SLOT_CUSTOM }

/** What `filterSlot.custom` hands its `render`: the bound value and the way to change it. */
export type CustomControlState<T> = {
  value: T
  set(next: T): void
  /** Unsets the field (`handle.clear()`). */
  clear(): void
  /** Name the input with it (`aria-label`). */
  label: string
  /** The control height the home asks for. */
  size: ControlSize
}

const SIZE: Record<ControlPresentation, ControlSize> = { pill: 'md', row: 'md', inline: 'sm' }

// oxlint-disable-next-line typescript/no-explicit-any -- the concept's `FilterSpec<any>[]`: handles of different `T` share one list
type AnySpec = FilterSpec<any>

function ResetAll({ specs }: { specs: readonly AnySpec[] }): ReactElement | null {
  const t = useMessages(homeMessages)
  // Subscribe to every handle so the button appears and goes with the values.
  for (const s of specs) {
    // oxlint-disable-next-line react/rules-of-hooks -- a slot's specs are fixed for its lifetime
    s.handle.use()
  }
  const changed = specs.filter((s) => !s.handle.isDefault)
  if (changed.length === 0) return null
  return (
    <button
      type="button"
      data-slot="filter-reset"
      className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'self-start')}
      onClick={() => {
        for (const s of changed) s.handle.clear()
      }}
    >
      {t('home.resetAll')}
    </button>
  )
}

function SlotView({ specs }: { specs: readonly AnySpec[] }): ReactElement | null {
  const presentation = use(ControlPresentationContext)
  return (
    <>
      {specs.map((s) => (
        <ControlView key={s.handle.key} spec={s} />
      ))}
      {presentation === 'row' && specs.length > 1 && <ResetAll specs={specs} />}
    </>
  )
}

function CustomView<T>({
  handle,
  label,
  render,
}: {
  handle: ControlHandle<T>
  label: string
  render: (state: CustomControlState<T>) => ReactNode
}): ReactElement {
  const presentation = use(ControlPresentationContext)
  const t = useMessages(homeMessages)
  const [value, set] = handle.use()
  // oxlint-disable-next-line react/rules-of-hooks -- a handle's hooks are fixed for its lifetime
  const { source, inherited } = handle.useSource()
  const overrides = source === 'override'
  const row = presentation === 'row'
  const title = t(
    'home.overridesGlobal',
    describeValue({ handle, label, scope: 'page' } satisfies FilterSpec<T>, inherited),
  )
  const input = render({
    value,
    set,
    clear: () => {
      handle.clear()
    },
    label,
    size: SIZE[presentation],
  })
  const badge = overrides && (
    <span data-slot="override-badge" title={title} className="inline-flex shrink-0">
      <Lozenge>{t('home.local')}</Lozenge>
    </span>
  )
  const reset = (
    <button
      type="button"
      data-slot="override-reset"
      className={buttonVariants({ variant: 'ghost', size: 'sm' })}
      onClick={() => {
        handle.clear()
      }}
    >
      {row ? t('home.useGlobal') : t('home.resetToGlobal', label)}
    </button>
  )
  return (
    <div
      data-slot="control-view"
      data-source={source}
      data-presentation={presentation}
      data-escape={FILTER_SLOT_CUSTOM}
      className={cn('flex min-w-0 max-w-full gap-1.5', row ? 'flex-col' : 'flex-wrap items-center')}
    >
      {presentation !== 'inline' && (
        <span
          className={row ? 'text-sm font-medium text-foreground' : 'text-xs text-muted-foreground'}
        >
          {label}
        </span>
      )}
      {badge}
      {input}
      {overrides && reset}
    </div>
  )
}

/**
 * Typed data a composite takes its controls through. Specs render with `ControlView` in the
 * presentation of the home around them; a `row` home with several specs adds `Reset all`. No specs,
 * nothing drawn. The slot keeps its specs' scope in its type: a card (`StatCard`, `ChartCard`,
 * `DataPanel`) takes widget specs only, so a global or page spec in a card slot is a type error.
 *
 * @useWhen you give a composite (`PageBar`, `Section`, a card) its controls
 * @neverWhen the control needs an input the kinds do not draw: use `filterSlot.custom`, which is counted
 *
 * @example
 * <PageBar controls={filterSlot([spec(overview.field.q, 'Search')])} />
 */
export function filterSlot<Scope extends FilterScope>(
  // oxlint-disable-next-line typescript/no-explicit-any -- the concept's `FilterSpec<any>[]`: handles of different `T` share one list
  specs: readonly FilterSpec<any, Scope>[],
): ControlsSlot<Scope> {
  return {
    kind: 'controls-slot',
    count: specs.length,
    render: () => (specs.length === 0 ? null : <SlotView specs={specs} />),
  }
}

/**
 * The counted escape: one control bound to `handle`, its input drawn by `render`. The slot keeps the
 * label, the `Local` cue and the reset, so the escape cannot drop the override. Every use counts
 * against the app's `escapes` ceiling in `.basalt/budget.json`.
 *
 * @useWhen no kind draws the input you need and the control still has to keep its URL state and cue
 * @neverWhen a kind or an `as` hint draws it: use `filterSlot` with a `spec`
 *
 * @example
 * filterSlot.custom(globals.field.range, 'Range', ({ value, set, label }) => <MyPicker aria-label={label} value={value} onChange={set} />)
 */
filterSlot.custom = function custom<T>(
  handle: ControlHandle<T>,
  label: string,
  render: (state: CustomControlState<T>) => ReactNode,
): CustomControlsSlot {
  return {
    kind: 'controls-slot',
    count: 1,
    escape: FILTER_SLOT_CUSTOM,
    render: () => <CustomView handle={handle} label={label} render={render} />,
  }
}

/** How many of `slots` are counted escapes. The figure `lint --stats` and the fixtures read. */
export function countEscapes(slots: readonly ControlsSlot[]): number {
  return slots.filter((s) => (s as { escape?: unknown }).escape === FILTER_SLOT_CUSTOM).length
}
