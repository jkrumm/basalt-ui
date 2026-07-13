/**
 * Border coverage — closes an ABSENCE the `check-theme` guard structurally cannot see.
 *
 * `check-theme`'s regex scans (src/guard/index.ts) can only flag violations that are PRESENT in
 * consumer source — a raw hex, an inline border, a `withBorder` on Card. They can never flag a
 * theme `.extend()` block that was simply never written: Button and ActionIcon shipped with NO
 * entry in `baseTheme.components` at all, so they silently fell through to Mantine's stock
 * `variant="default"` 1px hairline — a real, shipped bug (docs/DESIGN-SPEC.md doctrine inversion
 * #1: depth is `shadow-card`, never a hairline, for every default-variant panel/control; borders-
 * as-borders stay reserved for layout dividers). Nothing short of a mechanical inventory of
 * Mantine's OWN shipped CSS would have caught it before ship.
 *
 * This test IS that inventory: it enumerates every `@mantine/core` component whose shipped CSS
 * declares a real border (`border:` / `border-color:` / a directional `border-*:` / a `--*-bd`
 * custom property — never `border-radius`, which is shape, not edge) and asserts each one is
 * EITHER a themed key in `baseTheme.components` OR carries a written, reasoned entry in
 * `BORDER_ALLOWLIST` below. Mantine's CSS is resolved via the module system
 * (`import.meta.resolve('@mantine/core/styles.css')`), never a hardcoded `node_modules/.bun/…`
 * path, which differs per install/lockfile and would be brittle.
 *
 * THIS TEST IS DELIBERATELY COUPLED TO MANTINE'S INTERNAL CSS. A future Mantine upgrade that
 * introduces a new bordered component (or removes a border from an existing one) SHOULD fail this
 * test — that failure IS the point: it forces a deliberate theme-or-allowlist decision instead of
 * silently shipping a consumer-visible hairline the doctrine says shouldn't exist. Do NOT "fix" a
 * future failure here by loosening the scan, widening the regex, or bulk-allowlisting — classify
 * the new/changed component the same way every entry below was classified: read its shipped CSS,
 * decide whether the border is a real panel/control edge (theme it), a layout divider (allowlist),
 * or not a surface at all (allowlist), and write a one-line reason.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as MantineCore from '@mantine/core'
import { describe, expect, test } from 'bun:test'
import { baseTheme } from './index'

// ── Mantine CSS resolution ──────────────────────────────────────────────────────────────────────

// Resolved via the module system — never a hardcoded `node_modules/.bun/@mantine+core@…` path,
// which differs per install/lockfile hash and would be brittle across machines/CI.
const MANTINE_CORE_ROOT = dirname(fileURLToPath(import.meta.resolve('@mantine/core/styles.css')))
const MANTINE_STYLES_DIR = join(MANTINE_CORE_ROOT, 'styles')

// A real border declaration: `border:`, a directional `border-top/-bottom/-left/-right/-inline-
// start/-inline-end/-block-start/-block-end(-color)?:`, `border-color:`/`border-width:`/
// `border-style:`, or a `--*-bd` custom property. The negative lookbehind on `[\w-]` excludes a
// property NAME that merely ENDS in "border" (`--mantine-color-default-border:`,
// `--app-shell-border-color:`, `--blockquote-border:`) — those are variable DEFINITIONS, not a
// rendered edge; the file only counts if it also uses that variable in an actual border-family
// property, which the same regex catches at its own declaration site. `border-radius` never
// matches — shape, not edge.
const BORDER_DECLARATION =
  /(?<![\w-])border(-top|-bottom|-left|-right|-inline-start|-inline-end|-block-start|-block-end|-color|-width|-style)?\s*:|(?<![\w-])--[\w-]*-bd(-[\w-]+)?\s*:/

/** True if `name` is a real, themeable `@mantine/core` factory-component export (`.extend`
 * exists) — filters out non-component CSS files (`default-css-variables`, `global`, `baseline`)
 * and internal, unexported support components (`InlineInput`) that happen to ship their own CSS
 * file but can never be a `theme.components` key. */
function isThemeableComponent(name: string): boolean {
  const candidate = (MantineCore as Record<string, unknown>)[name]
  return typeof candidate === 'function' && 'extend' in candidate
}

/** Every `@mantine/core` component whose OWN shipped CSS file declares a real border, per
 * `BORDER_DECLARATION` above. Scans the non-layer `.css` files only (`*.layer.css` duplicates the
 * same declarations under Mantine's CSS-layers build; scanning both would just double-count). */
function borderedMantineComponents(): string[] {
  const found: string[] = []
  for (const file of readdirSync(MANTINE_STYLES_DIR)) {
    if (!file.endsWith('.css') || file.endsWith('.layer.css')) continue
    const name = file.slice(0, -'.css'.length)
    if (!isThemeableComponent(name)) continue
    const text = readFileSync(join(MANTINE_STYLES_DIR, file), 'utf8')
    if (BORDER_DECLARATION.test(text)) found.push(name)
  }
  return found.toSorted()
}

// ── BORDER_ALLOWLIST ────────────────────────────────────────────────────────────────────────────

type BorderAllowlistEntry = {
  readonly component: string
  /** `layout-divider`: the border IS the component's job — a structural boundary between regions/
   * rows/panes (DESIGN-SPEC's own carve-out: "Layout dividers … still use plain borders — only
   * card/control depth moved to shadow"). `not-a-surface`: a reset (`border: 0`/`none`), a shape/
   * affordance ring on a non-panel element, or content styling inside `Typography` prose — never a
   * `variant="default"` panel/control edge. */
  readonly kind: 'layout-divider' | 'not-a-surface'
  readonly reason: string
}

/**
 * The closed registry of bordered `@mantine/core` components the theme deliberately does NOT
 * theme, each with a one-line reason. Modeled on `GUARD_RULES` (src/guard/index.ts) / `SURFACES`
 * (src/surfaces.ts): every entry is real, reviewable, and reasoned — never a bare string array.
 */
export const BORDER_ALLOWLIST: readonly BorderAllowlistEntry[] = [
  // ── Layout dividers ──────────────────────────────────────────────────────────────────────────
  {
    component: 'AppShell',
    kind: 'layout-divider',
    reason:
      'Border is opt-in via [data-with-border] on individual navbar/header/footer/aside sections — a structural boundary between page regions, not a default-variant control.',
  },
  {
    component: 'Divider',
    kind: 'layout-divider',
    reason:
      'The layout-divider primitive itself — its border-top/border-inline-start IS the line it draws; already reads the hairline token via the strict-surface lever.',
  },
  {
    component: 'Fieldset',
    kind: 'layout-divider',
    reason:
      'A <fieldset> group container — the border groups related form fields into a labeled section (a structural boundary, like AppShell/Table), not a floating card. Both the default and filled variants intentionally keep the hairline.',
  },
  {
    component: 'Splitter',
    kind: 'layout-divider',
    reason:
      'The resize-handle bar between two panes IS a divider by definition — it separates two layout regions.',
  },
  {
    component: 'Tree',
    kind: 'layout-divider',
    reason:
      'border-top is a tree-line connector drawn between hierarchical rows (--tree-line-color) — a structural row-relationship indicator, the same family as Table row dividers, not a panel surface.',
  },
  {
    component: 'TreeSelect',
    kind: 'layout-divider',
    reason:
      'Same tree-line connector as Tree (--ts-line-color) — a structural row-relationship indicator, not a panel surface.',
  },
  // ── Not a surface at all ─────────────────────────────────────────────────────────────────────
  {
    component: 'Alert',
    kind: 'not-a-surface',
    reason:
      'No variant="default" exists for Alert (filled | light | outline | transparent | white); its default (light) variant already ships --alert-bd: 1px solid transparent — no stock hairline to fix.',
  },
  {
    component: 'Anchor',
    kind: 'not-a-surface',
    reason: 'A text link — border: 0 is a reset, never a rendered edge.',
  },
  {
    component: 'Avatar',
    kind: 'not-a-surface',
    reason:
      'The root avatar ships --avatar-bd: 1px solid transparent by default; the one real border (AvatarGroup, a 2px page-bg ring) separates overlapping stacked circles, not a panel edge.',
  },
  {
    component: 'BackgroundImage',
    kind: 'not-a-surface',
    reason: 'border: 0 reset plus a shape-only border-radius var — never a rendered edge.',
  },
  {
    component: 'Blockquote',
    kind: 'not-a-surface',
    reason:
      "A typography/content primitive — border-inline-start is the quote's colored accent bar, its defining visual feature, not a stock hairline.",
  },
  {
    component: 'CheckboxIndicator',
    kind: 'not-a-surface',
    reason:
      "The checkbox glyph box itself — its border is the control's shape/affordance (a native-checkbox-style outline), not a panel edge. Already reads --vx-surface-border via the existing gray-4/dark-4 strict-surface lever.",
  },
  {
    component: 'ColorPicker',
    kind: 'not-a-surface',
    reason:
      'The selected-swatch preview ring (2px solid white) is a shape/preview accent, not a panel.',
  },
  {
    component: 'ColorSwatch',
    kind: 'not-a-surface',
    reason: 'border: none — swatch grid tiles are shape-only (border-radius), no rendered edge.',
  },
  {
    component: 'Loader',
    kind: 'not-a-surface',
    reason:
      "The spinner ring's border-color IS the animated graphic itself — a utility/a11y element, not a panel surface.",
  },
  {
    component: 'RadioIndicator',
    kind: 'not-a-surface',
    reason:
      "Same as CheckboxIndicator — the radio glyph's own shape/affordance border, not a panel edge.",
  },
  {
    component: 'Slider',
    kind: 'not-a-surface',
    reason:
      "The draggable thumb's border is its shape/affordance (a handle needs a visible edge to grab), not a panel surface.",
  },
  {
    component: 'ThemeIcon',
    kind: 'not-a-surface',
    reason:
      'Ships border: var(--ti-bd, 1px solid transparent) — transparent by default; --ti-bd is a call-site escape hatch, not a stock hairline.',
  },
  {
    component: 'Typography',
    kind: 'not-a-surface',
    reason:
      "Prose/content styling (hr/table/code/kbd borders) — styles user-authored rich-text content inside .mantine-Typography-root, not the app's own UI chrome.",
  },
  {
    component: 'UnstyledButton',
    kind: 'not-a-surface',
    reason:
      'border: 0 reset — the deliberately bare base every other button-like component (Button, Chip, CheckboxCard, RadioCard, …) builds on.',
  },
  {
    component: 'VisuallyHidden',
    kind: 'not-a-surface',
    reason: 'border: 0 reset on an a11y-only, visually hidden element — never rendered at all.',
  },
]

// ── Tests ────────────────────────────────────────────────────────────────────────────────────────

describe('BORDER_ALLOWLIST is well-formed', () => {
  test('every entry has a non-empty reason', () => {
    for (const entry of BORDER_ALLOWLIST) {
      expect(entry.reason.length).toBeGreaterThan(0)
    }
  })

  test('no duplicate component entries', () => {
    const names = BORDER_ALLOWLIST.map((e) => e.component)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('every bordered @mantine/core component is themed or allowlisted', () => {
  // The coverage assertion below is `expect(gaps).toEqual([])`, which passes VACUOUSLY if the scan
  // finds nothing — a silently-empty scan would report full coverage while checking zero components.
  // That is not hypothetical: an early version of this file filtered on `typeof === 'object'` (Mantine
  // factory components are FUNCTIONS with a static `.extend`) and enumerated nothing while staying
  // green. This test is the tripwire: if a Mantine upgrade restructures the dist and the scan stops
  // resolving, fail loudly here rather than quietly nodding the real assertion through.
  test('the scan actually resolves Mantine components (guards against a vacuous pass)', () => {
    const found = borderedMantineComponents()
    expect(found.length).toBeGreaterThan(20)
    // Card is the canonical bordered surface and the origin of doctrine inversion #1 — if the scan
    // can't see IT, the scan is broken, whatever its count says.
    expect(found).toContain('Card')
  })

  test('doctrine inversion #1 (docs/DESIGN-SPEC.md §8) has no unaddressed gap', () => {
    const themed = new Set(Object.keys(baseTheme.components ?? {}))
    const allowlisted = new Set(BORDER_ALLOWLIST.map((e) => e.component))

    const gaps = borderedMantineComponents()
      .filter((name) => !themed.has(name) && !allowlisted.has(name))
      .map(
        (name) =>
          `${name}: ships a stock Mantine border (@mantine/core/styles/${name}.css) but is neither ` +
          `a key in baseTheme.components (src/theme/index.ts) nor an entry in BORDER_ALLOWLIST ` +
          `(src/theme/border-coverage.test.ts). Classify it: theme it (panel bg + ` +
          `box-shadow: var(--vx-shadow-card), no border, scoped to variant="default" or its ` +
          `equivalent), or allowlist it as a layout divider / not-a-surface with a written reason. ` +
          `See docs/DESIGN-SPEC.md doctrine inversion #1.`,
      )

    expect(gaps).toEqual([])
  })
})
