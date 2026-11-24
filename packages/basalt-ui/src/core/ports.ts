/**
 * Ports: the structural types that replace sideways imports between layers
 * (docs/v3/ARCHITECTURE.md section 1). Types only, no value symbols. Pinned by
 * `check-contract-frozen`; a change needs a `chore: contract amendment` commit.
 */
import type { FC, ReactElement, ReactNode } from 'react'

/** Closed tone vocabulary shared by `Status`, `MeterZone` and the composites. */
export type Tone = 'good' | 'warn' | 'bad' | 'info' | 'accent' | 'neutral'

// ---- Phases and frames (charts-cards-kanban 4) --------------------------------------------

/** `'empty'` is derived from `Empty`, never an input: it cannot lack a cause. */
export type Phase =
  | 'ready'
  | 'loading'
  | 'stale'
  | { tag: 'error'; kind?: 'forbidden' | 'not-found'; retry?: () => void; message?: string }

/** Structural TanStack Query result; no Query import. A `status` of 403/404 on `error` sets `kind`. */
export type QueryStateLike = {
  isPending: boolean
  isError: boolean
  isRefetchError?: boolean
  isPlaceholderData?: boolean
  error: unknown
  refetch?: () => unknown
}

/** Geometry a composite owns and hands to a box slot. */
export type Box = { height: number | 'fill'; phase: 'ready' | 'stale' }

/** The composite owns the box at every phase; the slot only draws inside it. */
export type BoxSlot = (box: Box) => ReactNode

/**
 * A change against a base: the figure's delta pill. `polarity` names whether up is good, bad or neither,
 * which sets the tint; the sign of `value` sets the arrow.
 *
 * @useWhen a figure carries its change against a period, passed as `delta` on a stat card or a chart figure
 * @neverWhen the change is not a number the reader can act on (state it in `sub`) or no base exists
 * @example
 * delta={{ value: '+12%', polarity: 'up-good', label: 'vs last week' }}
 */
export type Delta = {
  /** Printed as given, never scaled: `0.12` shows 0.12, not 12 %, so pass `'+12%'`; the sign sets the arrow. */
  value: number | string
  polarity: 'up-good' | 'up-bad' | 'neutral'
  label?: string
}

/**
 * The verdict a card shows: a tone and a word, the type of `StatCard status`.
 *
 * @useWhen a card states a state in one word with a tone (`status` on a stat card)
 * @neverWhen the state is a count or a sentence, or the row is a table cell (use `Status` from `basalt-ui/ui/status`)
 * @example
 * status={{ tone: 'warn', label: 'Degraded' }}
 */
export type Verdict = { tone: Tone; label: string }

export type MeterZone = { to: number; tone: Tone; label: string }

export type MeterSpec = {
  label: string
  value: number | null
  min?: number
  max: number
  zones?: readonly [MeterZone, MeterZone, ...MeterZone[]]
  format?: (v: number) => string
  /** Words after the value that name it on screen: "spent", "of 150 listed". `label` stays for assistive tech. */
  caption?: string
}

// ---- A list joined to a chart's focus -----------------------------------------------------

/** What a list row spreads to join a chart's focus: pointing at it focuses its item. */
export type ListFocusItem = {
  'data-focused'?: ''
  ref: (element: Element | null) => void
  onPointerEnter: () => void
  onPointerDown: () => void
}

/**
 * The part of a chart's focus handle a kit list reads. `useChartFocus` from `basalt-ui/charts`
 * returns one; this structural copy keeps the list contracts free of `./charts`.
 */
export type ListFocus<T> = {
  readonly items: readonly T[]
  readonly index: number | null
  readonly set: (index: number | null) => void
  readonly item: (index: number) => ListFocusItem
  /** The index a key moves the focus to (`null` clears, `undefined` is not ours). */
  readonly step: (key: string) => number | null | undefined
  /**
   * Focuses several items at once, as a pointer does: a list row that stands for a run or a set of
   * them (a window of hours, a probe under its finding). The first in item order becomes `index`;
   * one index is `set` of it, none clears.
   */
  readonly hold: (indexes: readonly number[]) => void
  /** The focused items in item order: the one at `index`, every item `hold` set, or none. */
  readonly span: readonly T[]
}

// ---- Icons and links ----------------------------------------------------------------------

/** Structural icon: Lucide, Tabler, Phosphor and a hand-written SVG component all satisfy it. */
export type IconComponent = (props: {
  className?: string
  size?: number | string
  'aria-hidden'?: boolean | 'true' | 'false'
}) => ReactNode

/** Opaque product of `navTarget(linkOptions)`; only the `link` adapter opens it. */
export type NavTarget = { readonly __brand: 'NavTarget' }

/**
 * Router-free link. Default is a plain `<a>` (a `NavTarget` has no plain form, so it renders without
 * a destination); `BasaltProvider link={routerDefaults().link}` installs the router `Link` for every
 * link prop.
 */
export type LinkComponent = (props: {
  href: string | NavTarget
  className?: string
  'data-slot'?: string
  children?: ReactNode
  'aria-current'?: 'page' | 'step' | 'location' | 'date' | 'time' | boolean | 'true' | 'false'
  'aria-label'?: string
  onClick?: (event: never) => void
}) => ReactNode

// ---- Controls and forms (controls-url-state 5, state-persistence-forms 6) -----------------

/**
 * The only thing `./controls` sees of the router half. `clear()` unsets, never writes the fallback;
 * a `history: 'push'` URL field unsets as a push too (the close is an entry Back can leave), and
 * `clear({ replace: true })` overwrites the current entry instead (a cleanup, not a user close).
 */
export type ControlHandle<T> = {
  key: string
  kind: 'enum' | 'multi' | 'string' | 'number' | 'boolean' | 'range'
  options?: readonly { value: T; label: string }[]
  use(): [T, (v: T) => void]
  useSource(): { source: 'own' | 'inherited' | 'override'; inherited: T | undefined }
  clear(options?: { replace?: boolean }): void
  isDefault: boolean
}

/**
 * Opaque product of `filterSlot(specs)` from `./controls`. Composites render it and never read
 * the specs; `count` lets a dev assertion cap inline controls without opening it. `Scope` is a
 * type-only brand `filterSlot` sets from its specs, so a card slot (`ControlsSlot<'widget'>`)
 * rejects a slot built from a global or page spec; an unbranded slot (`filterSlot.custom`,
 * `globalControls`) fits anywhere. In a pill home (`page-bar`, `section-header`) the slot renders
 * as `FilterSet`, so the measured fold and the phone's `Filters (n)` sheet apply (F2 amendment n12).
 */
export type ControlsSlot<Scope extends string = never> = {
  readonly kind: 'controls-slot'
  readonly count: number
  /**
   * The slot draws its own compact form (below `md`). The shell header keeps `globalControls` in
   * the row at every width then; without it the header hides the slot below `md`, as it hides any
   * row of controls that has no narrow form.
   */
  readonly compact?: boolean
  render(): ReactNode
} & ([Scope] extends [never] ? unknown : { readonly scope?: Scope })

export type FieldLike<T> = {
  state: { value: T; meta: { errors: unknown[] } }
  handleChange(v: T): void
  handleBlur(): void
}

export type FormLike<V> = {
  /** `errors` are form-level. */
  state: {
    values: V
    isSubmitting: boolean
    canSubmit: boolean
    errors: unknown[]
    /** True once a value differs from its default; TanStack Form sets it. Read by `FormFooter`'s status. */
    isDirty?: boolean
  }
  /** Stays the server value under `keepDefaultValues`. */
  options: { defaultValues?: V }
  store: { subscribe(cb: () => void): { unsubscribe(): void } }
  reset(values: V, o?: { keepDefaultValues?: boolean }): void
}

// ---- Storage and saved views (state-persistence-forms 6, data-table 4) --------------------

/** Sync only: an async backend preloads before the first render. */
export type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  subscribe?(cb: (key: string | null) => void): () => void
}

/**
 * `S` is the table state the table concept supplies (`View<TableState>`), kept generic so
 * L1 imports nothing from `src/table`.
 */
export type ViewStore<S = unknown> = {
  list(table: string): Promise<{ id: string; name: string; state: S }[]>
  save(table: string, v: { id: string; name: string; state: S }): Promise<void>
  remove(table: string, id: string): Promise<void>
}

// ---- Hosts (shell-nav-router 3.2) ---------------------------------------------------------

/**
 * The ordered records a panel was opened from: `ids` in the opener's order, `id` the one shown, and
 * `onStep` swaps the panel to another of them. A panel draws previous and next from it, disabled at
 * the ends.
 */
export type RecordSequence = {
  readonly ids: readonly string[]
  readonly id: string
  onStep(id: string): void
}

/**
 * What a detail host shows. The default host is a sheet, a `Peek` under `AppShell`; `PageAside`
 * hosts it inside `AppShell`. `records` lets the host step through the opener's rows.
 */
export type DetailEntry = { title: string; body: BoxSlot; records?: RecordSequence }

export type DetailHost = {
  readonly isOpen: boolean
  show(entry: DetailEntry): void
  hide(): void
}

/** Region a page claims in the frame. Without a provider each region renders inline, sticky. */
export type PageRegion = 'actions' | 'breadcrumb' | 'aside' | 'title'

/** Context value `AppShell` supplies to `PageBar` and `PageAside`. A claim returns its release. */
export type PageHost = {
  claim(region: PageRegion, node: ReactNode, id: string): () => void
  setBarHeight(px: number): void
}

// ---- Virtualisation (data-table 4) --------------------------------------------------------

export type VirtualItem = { index: number; key: string | number; start: number; size: number }

/**
 * Supplied by `VirtualList` from `ui/virtual-list`, so no composite `.d.ts` names `ui/*` and
 * `./table` needs no virtual peer. `keepIndex` is always rendered (the focused row).
 */
export type VirtualLike = (props: {
  count: number
  estimateSize(index: number): number
  getItemKey(index: number): string | number
  keepIndex?: number
  overscan?: number
  children(items: readonly VirtualItem[], totalSize: number): ReactNode
}) => ReactElement | null

/** The data a drag carries and a drop target names: flat, so it survives any engine. */
export type DragData = Readonly<Record<string, string | number>>

/** Which half of a target the pointer is over: the drop lands before or after it. */
export type DragEdge = 'before' | 'after'

/**
 * Supplied by `drag` from `ui/sortable-list`, so `./cards` names no drag library and needs no
 * peer. Each call registers one element and returns its cleanup. `item` makes an element
 * draggable (by `handle` when given; `tilt` draws the preview as a tilted copy) and reports its
 * own drag; `target` reports the edge the pointer is over, `null` on leave; `watch` gets every
 * finished drag with its innermost target, `null` when it was dropped on none.
 */
export type DragLike = {
  item(o: {
    element: HTMLElement
    handle?: HTMLElement | undefined
    data: DragData
    tilt?: boolean | undefined
    onDrag?(dragging: boolean): void
  }): () => void
  target(o: {
    element: HTMLElement
    data: DragData
    onHover?(edge: DragEdge | null): void
  }): () => void
  watch(o: {
    onStart?(source: DragData): void
    onDrop(drop: { source: DragData; target: DragData | null; edge: DragEdge | null }): void
  }): () => void
}

// ---- Realtime views (live-realtime 3) -----------------------------------------------------

export type ChannelStatus =
  | 'idle'
  | 'connecting'
  | 'live'
  | 'retrying'
  | 'unauthorized'
  | 'failed'
  | 'done'

export type ConnectionView = {
  state: 'live' | 'polling' | 'offline'
  stream: 'none' | ChannelStatus
  online: boolean
  reachable: boolean
  lastFrameAt?: number
  lastUpdatedAt?: number
}

export type FreshnessView = {
  fetch: 'fresh' | 'stale' | 'paused' | 'error' | 'none'
  source?: 'fresh' | 'stale' | 'absent'
  /** `RefreshButton` props: `onSync` invalidates the keys; `error` is the failing query's message. */
  button: { syncing: boolean; lastCompletedAt?: number; onSync(): void; error?: string }
}

// ---- Catalog (ai-mdx 4) -------------------------------------------------------------------

/**
 * Structural so `./testing` (L5) imports nothing from `src/ai` (L4). `Block` renders a spec in a
 * phase (every `defineCatalog` product has one); a block's `limits` default to the catalog's.
 */
export type CatalogLike = {
  validate(x: unknown): { ok: true; block: unknown } | { ok: false; error: string }
  blocks: readonly {
    name: string
    props: unknown
    sample: readonly unknown[]
    limits?: { maxBytes: number; maxDepth: number }
    textKeys?: readonly string[]
  }[]
  discriminator?: string
  Block?: FC<{ spec: unknown; phase: Phase }>
}
