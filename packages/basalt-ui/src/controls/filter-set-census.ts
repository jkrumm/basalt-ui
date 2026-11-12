/**
 * The census of a `FilterSet`: which specs hold a value that narrows, and how to return them all to
 * their defaults. It reads the handles, never the DOM, so the count is the same whichever surface
 * (pill row, fold panel, phone sheet) is mounted, hidden or clipped.
 */
import type { FilterSpec } from './contract'

// oxlint-disable-next-line typescript/no-explicit-any -- the concept's `FilterSpec<any>[]`: handles of different `T` share one list
export type AnySpec = FilterSpec<any>

/** The catalogue a spec offers: its own `options`, else the handle's. */
export function catalogueOf(spec: AnySpec): readonly { value: unknown; label: string }[] {
  return (spec.options ?? spec.handle.options ?? []) as readonly { value: unknown; label: string }[]
}

/** A multi selection that holds no value or every catalogue value narrows nothing. */
export function isUnrestricted(spec: AnySpec, value: unknown): boolean {
  if (spec.handle.kind !== 'multi' || !Array.isArray(value)) return false
  if (value.length === 0) return true
  const catalogue = catalogueOf(spec)
  return catalogue.length > 0 && catalogue.every((o) => value.includes(o.value))
}

/**
 * Whether `value` narrows. A multi equal to the full set behaves as empty, so it never counts; any
 * other kind is active when its handle is off its default.
 */
export function isActive(spec: AnySpec, value: unknown): boolean {
  if (isUnrestricted(spec, value)) return false
  return !spec.handle.isDefault
}

/**
 * A spec whose catalogue also holds the current value, when the value is not in it (a link, an
 * archived option, a catalogue still loading). The input then shows what is applied instead of an
 * empty box.
 */
export function withCurrentValue(spec: AnySpec, value: unknown): AnySpec {
  const catalogue = catalogueOf(spec)
  if (catalogue.length === 0) return spec
  const kind = spec.handle.kind
  let held: unknown[]
  if (kind === 'multi') held = Array.isArray(value) ? value : []
  else if (kind === 'enum') held = value === '' || value === undefined ? [] : [value]
  else if (kind === 'range') held = [(value as { preset?: unknown } | undefined)?.preset]
  else return spec
  const missing = held.filter((v) => typeof v === 'string' && !catalogue.some((o) => o.value === v))
  if (missing.length === 0) return spec
  return {
    ...spec,
    options: [...catalogue, ...missing.map((v) => ({ value: v, label: String(v) }))],
  }
}

/**
 * Subscribes to every spec's handle and reports how many are active and a reset for them.
 *
 * Calls one hook per spec, so the caller keeps the list fixed for the lifetime of the mount (the
 * `FilterSet` remounts this when the set of handle keys changes).
 */
export function useCensus(specs: readonly AnySpec[]): { count: number; reset(): void } {
  const active: AnySpec[] = []
  for (const s of specs) {
    // oxlint-disable-next-line react/rules-of-hooks -- the list is fixed per mount (keyed by handle keys)
    const [value] = s.handle.use()
    if (isActive(s, value)) active.push(s)
  }
  return {
    count: active.length,
    reset() {
      for (const s of active) s.handle.clear()
    },
  }
}
