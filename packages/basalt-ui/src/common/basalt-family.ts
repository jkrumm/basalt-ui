/**
 * A `--basalt-*` name's FAMILY — its leading lowercase run: `--basalt-surface-bg` → `surface`, `--basalt-ink2`
 * → `ink`, `--basalt-tooltip-bg` → `tooltip`, `--basalt-fill-hover-cyan` → `fill`. Dependency-free, because
 * the generator that writes `BASALT_FAMILIES` and the token factories that refuse a consumer
 * name inside one must agree on it byte for byte.
 */
export function basaltFamilyOf(name: string): string {
  return /^--basalt-([a-z]*)/.exec(name)?.[1] ?? ''
}

/**
 * Families a consumer extends without any factory: the theme emits `--basalt-on-<color>` for EVERY
 * `theme.colors` entry, a consumer's own colors included, so `on` is never basalt's alone.
 */
const CONSUMER_EXTENSIBLE_FAMILIES: ReadonlySet<string> = new Set(['on'])

/** The basalt-owned families among `names` — run over every name basalt emits (`collectBasaltNames`). */
export function basaltFamilies(names: readonly string[]): string[] {
  const families = new Set(names.map(basaltFamilyOf))
  return [...families].filter((f) => f !== '' && !CONSUMER_EXTENSIBLE_FAMILIES.has(f)).toSorted()
}
