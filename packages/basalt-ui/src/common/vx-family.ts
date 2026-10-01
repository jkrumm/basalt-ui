/**
 * A `--vx-*` name's FAMILY — its leading lowercase run: `--vx-surface-bg` → `surface`, `--vx-ink2`
 * → `ink`, `--vx-tooltipBg` → `tooltip`, `--vx-fillHover-cyan` → `fill`. Dependency-free, because
 * three sides must agree on it byte for byte: the generator that writes `BASALT_VX_FAMILIES`, the
 * guard that judges every name inside one of those families, and the token factories that refuse a
 * consumer name inside one — the refusal is what makes the guard's judgement honest.
 */
export function vxFamilyOf(name: string): string {
  return /^--vx-([a-z]*)/.exec(name)?.[1] ?? ''
}

/**
 * Families a consumer extends without any factory: the theme emits `--vx-on-<color>` for EVERY
 * `theme.colors` entry, a consumer's own colors included, so `on` is never basalt's alone.
 */
const CONSUMER_EXTENSIBLE_FAMILIES: ReadonlySet<string> = new Set(['on'])

/** The basalt-owned families `css` declares into — run over `buildPaletteCss()`. */
export function vxFamiliesIn(css: string): string[] {
  const names = [...css.matchAll(/(--vx-[A-Za-z0-9-]*[A-Za-z0-9])\s*:/g)].map((m) => m[1] ?? '')
  const families = new Set(names.map(vxFamilyOf))
  return [...families].filter((f) => f !== '' && !CONSUMER_EXTENSIBLE_FAMILIES.has(f)).toSorted()
}
