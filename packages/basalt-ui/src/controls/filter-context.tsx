/**
 * The two contexts `FilterSet` publishes and every control in this folder consumes
 * (`docs/CONTROLS-SPEC.md` §3). Its own module so `filter-set.tsx` and `filter-sheet.tsx` can both
 * read it without importing each other.
 *
 * **Surface** — `useFilterSurface()` is how a control decides its FORM, not a media query: `'pill'`
 * inside the bar row (and inside the desktop `+N` fold), `'sheet'` inside the mobile `Filters (n)`
 * Drawer, `'panel'` inside a `PageAside` body, where a chip in a 300px column reads as a stray
 * button and the archetype is an inspector ROW (`docs/ASIDE-SPEC.md` §1). A control renders exactly
 * one form per mount; the desktop/mobile swap WITHIN the pill form is CSS
 * (`visibleFrom`/`hiddenFrom`), never JS (C9).
 *
 * **Registry** — `useFilterRegistration()` is what makes `Filters (n)` and `Reset all` derived
 * rather than hand-passed: each filter reports `{ isActive, reset }` for itself, so `FilterSet`
 * needs no list of its children's fields. Registration is deliberately scoped to ONE surface: the
 * bar row keeps every child mounted on every viewport (hidden slots are `display: none`, never
 * unmounted — see `controls.module.css`), so the row alone is a complete and stable census. The
 * fold dropdown and the sheet mount a SECOND copy of the same children and therefore provide a
 * `null` registry, which is what keeps one filter from counting twice.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'

/**
 * Which form a control renders. Provided by `FilterSet` (`'pill'` / `'sheet'`) and by `PageAside`
 * (`'panel'`); `'pill'` when there is neither.
 */
export type FilterSurface = 'pill' | 'sheet' | 'panel'

const FilterSurfaceContext = createContext<FilterSurface>('pill')

/**
 * The form this control should render — the ONE thing a control branches on.
 *
 * @example
 * const surface = useFilterSurface()
 * if (surface === 'sheet') return <SheetField label={label}>…</SheetField>
 */
export function useFilterSurface(): FilterSurface {
  return useContext(FilterSurfaceContext)
}

/** What one filter reports about itself, keyed internally by a `useId()` per mount. */
export type FilterRegistration = {
  /** `!field.isDefault(value)` — the only input to `Filters (n)` and the pill's accent border. */
  readonly isActive: boolean
  /** Writes the field back to its fallback. Called by `Reset all`. */
  readonly reset: () => void
}

type FilterRegistry = {
  register(key: string, registration: FilterRegistration): void
  unregister(key: string): void
}

const FilterRegistryContext = createContext<FilterRegistry | null>(null)

export type FilterSetScopeProps = {
  readonly surface: FilterSurface
  /** `null` on a second copy of the same children (the fold dropdown, the sheet) and on a surface
   * that owns no census at all (the aside panel — it has no `Filters (n)` and no `Reset all`). */
  readonly registry: FilterRegistry | null
  readonly children: ReactNode
}

/** Provides both contexts at once — every place FilterSet mounts children goes through this. */
export function FilterSetScope({ surface, registry, children }: FilterSetScopeProps): ReactNode {
  return (
    <FilterSurfaceContext.Provider value={surface}>
      <FilterRegistryContext.Provider value={registry}>{children}</FilterRegistryContext.Provider>
    </FilterSurfaceContext.Provider>
  )
}

/**
 * Report this filter's active/reset state to the enclosing `FilterSet`. Call it unconditionally —
 * it no-ops outside a registering scope (a bare filter with no `FilterSet`, the fold dropdown, the
 * sheet), which is what keeps it hook-safe in every control.
 *
 * The reset is `field.clear()`, never `setValue(field.fallback)`: writing the fallback back is a
 * WRITE, so it persists the default as if the user had chosen it — the URL keeps `?window=7d`, the
 * localStorage mirror keeps its key, and a later change to the field's fallback no longer reaches
 * either. `clear()` removes the value instead, on whichever lane the field is on.
 *
 * @example
 * const [value] = field.use()
 * useFilterRegistration(!field.isDefault(value), () => field.clear())
 */
export function useFilterRegistration(isActive: boolean, reset: () => void): void {
  const registry = useContext(FilterRegistryContext)
  const key = useId()
  // A ref, so a `reset` closure that is fresh every render does not re-run the effect (and so
  // `Reset all` always calls the LATEST setter, not the one captured at registration).
  const resetRef = useRef(reset)
  resetRef.current = reset
  const stableReset = useCallback(() => {
    resetRef.current()
  }, [])

  useEffect(() => {
    if (registry === null) return
    registry.register(key, { isActive, reset: stableReset })
    return () => {
      registry.unregister(key)
    }
  }, [registry, key, isActive, stableReset])
}

export type FilterCensus = {
  readonly registry: FilterRegistry
  /** How many registered filters are non-default — `Filters (n)`. */
  readonly activeCount: number
  /** Resets every registered filter. */
  readonly resetAll: () => void
}

/**
 * The registry side, for `FilterSet` itself. The map is a ref (registration happens in children's
 * effects, which must not re-render the parent mid-commit) and the COUNT is state, so only a real
 * change in the count re-renders the bar.
 */
export function useFilterCensus(): FilterCensus {
  const entries = useRef(new Map<string, FilterRegistration>())
  const [activeCount, setActiveCount] = useState(0)

  // The functional form, so React's own bail-out drops a write of the count already held — a
  // register/unregister pair that leaves the count unchanged must not re-render the bar.
  const sync = useCallback(() => {
    let next = 0
    for (const entry of entries.current.values()) {
      if (entry.isActive) next += 1
    }
    setActiveCount((current) => (current === next ? current : next))
  }, [])

  const registry = useMemo<FilterRegistry>(
    () => ({
      register(key, registration) {
        entries.current.set(key, registration)
        sync()
      },
      unregister(key) {
        entries.current.delete(key)
        sync()
      },
    }),
    [sync],
  )

  const resetAll = useCallback(() => {
    for (const entry of entries.current.values()) entry.reset()
  }, [])

  return { registry, activeCount, resetAll }
}
