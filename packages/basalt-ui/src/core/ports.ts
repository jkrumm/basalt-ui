/**
 * Ports: the structural types that replace sideways imports between layers
 * (docs/v3/ARCHITECTURE.md section 1). Types only, no value symbols. Pinned by
 * `check-contract-frozen`; a change needs a `chore: contract amendment` commit.
 */
import type { ReactElement, ReactNode } from 'react'

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

export type Delta = {
  value: number | string
  polarity: 'up-good' | 'up-bad' | 'neutral'
  label?: string
}

/** The verdict home: dot plus word. */
export type Status = { tone: Tone; label: string }

export type MeterZone = { to: number; tone: Tone; label: string }

export type MeterSpec = {
  label: string
  value: number | null
  min?: number
  max: number
  zones?: readonly [MeterZone, MeterZone, ...MeterZone[]]
  format?: (v: number) => string
}

// ---- Icons and links ----------------------------------------------------------------------

/** Structural icon: Lucide, Tabler, Phosphor and a hand-written SVG component all satisfy it. */
export type IconComponent = (props: {
  className?: string
  size?: number | string
  'aria-hidden'?: boolean | 'true' | 'false'
}) => ReactNode

/** Router-free link. Default is a plain `<a>`; `routerDefaults` supplies the router `Link`. */
export type LinkComponent = (props: {
  href: string
  className?: string
  children?: ReactNode
  'aria-current'?: 'page' | 'step' | 'location' | 'date' | 'time' | boolean | 'true' | 'false'
  'aria-label'?: string
  onClick?: (event: never) => void
}) => ReactNode

// ---- Controls and forms (controls-url-state 5, state-persistence-forms 6) -----------------

/** The only thing `./controls` sees of the router half. `clear()` unsets, never writes the fallback. */
export type ControlHandle<T> = {
  key: string
  kind: 'enum' | 'multi' | 'string' | 'number' | 'boolean' | 'range'
  options?: readonly { value: T; label: string }[]
  use(): [T, (v: T) => void]
  useSource(): { source: 'own' | 'inherited' | 'override'; inherited: T | undefined }
  clear(): void
  isDefault: boolean
}

/**
 * Opaque product of `filterSlot(specs)` from `./controls`. Composites render it and never read
 * the specs; `count` lets a dev assertion cap inline controls without opening it. `Scope` is a
 * type-only brand `filterSlot` sets from its specs, so a card slot (`ControlsSlot<'widget'>`)
 * rejects a slot built from a global or page spec; an unbranded slot (`filterSlot.custom`,
 * `globalControls`) fits anywhere.
 */
export type ControlsSlot<Scope extends string = never> = {
  readonly kind: 'controls-slot'
  readonly count: number
  render(): ReactNode
} & ([Scope] extends [never] ? unknown : { readonly scope?: Scope })

export type FieldLike<T> = {
  state: { value: T; meta: { errors: unknown[] } }
  handleChange(v: T): void
  handleBlur(): void
}

export type FormLike<V> = {
  /** `errors` are form-level. */
  state: { values: V; isSubmitting: boolean; canSubmit: boolean; errors: unknown[] }
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

/** What a detail host shows. Default host is a sheet; `PageAside` hosts it inside `AppShell`. */
export type DetailEntry = { title: string; body: BoxSlot }

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

/** Structural so `./testing` (L5) imports nothing from `src/ai` (L4). */
export type CatalogLike = {
  validate(x: unknown): { ok: true; block: unknown } | { ok: false; error: string }
  blocks: readonly { name: string; props: unknown; sample: readonly unknown[] }[]
}
