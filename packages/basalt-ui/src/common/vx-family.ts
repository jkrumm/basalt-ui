/**
 * A `--vx-*` name's FAMILY — its leading lowercase run: `--vx-surface-bg` → `surface`, `--vx-ink2`
 * → `ink`, `--vx-tooltip-bg` → `tooltip`, `--vx-fill-hover-cyan` → `fill`. Dependency-free, because
 * the generator that writes `BASALT_VX_FAMILIES` and the token factories that refuse a consumer
 * name inside one must agree on it byte for byte.
 */
export function vxFamilyOf(name: string): string {
  return /^--vx-([a-z]*)/.exec(name)?.[1] ?? ''
}

/**
 * Families a consumer extends without any factory: the theme emits `--vx-on-<color>` for EVERY
 * `theme.colors` entry, a consumer's own colors included, so `on` is never basalt's alone.
 */
const CONSUMER_EXTENSIBLE_FAMILIES: ReadonlySet<string> = new Set(['on'])

/** The basalt-owned families among `names` — run over every name basalt emits (`collectVxNames`). */
export function basaltVxFamilies(names: readonly string[]): string[] {
  const families = new Set(names.map(vxFamilyOf))
  return [...families].filter((f) => f !== '' && !CONSUMER_EXTENSIBLE_FAMILIES.has(f)).toSorted()
}
