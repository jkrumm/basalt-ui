/**
 * Shadow-surface coverage — closes a class of bug `check-theme`'s regex scans cannot see: applying
 * the depth token to the WRONG box.
 *
 * `--vx-shadow-card` (and `--vx-shadow-ctrl`) bakes a 1px ring into the shadow value itself (see
 * `tokens/palette.ts`'s `SHADOW`). THE INVARIANT: an element applying the token must carry the
 * surface's OWN `border-radius` — the ring is drawn by the shadow's rendering box and follows THAT
 * box's own corners, not any other element's. We shipped a bug where `box-shadow: var(--vx-shadow-
 * card)` landed on Mantine's Input WRAPPER, a bare `position: relative` box with `border-radius: 0`
 * against an 8px rounded `<input>` inside it. The ring rendered square around a rounded corner,
 * leaking visible grey nubs — a radius mismatch, not a missing background. (A shadowed box need not
 * paint its OWN background: the ring is bound to the box's RADIUS, not its background — a transparent
 * shadow box whose fill lives on a separate, identically-rounded box is legal as long as the two
 * radii match. Background usually DOES co-locate, since most surfaces declare both on the same box —
 * but it is the radius, not the background, that the ring is contractually bound to.) Nothing short of a
 * mechanical inventory of every site that APPLIES the token would have caught it: a source-level
 * guard can only flag a bad value, never a bad ELEMENT.
 *
 * This test IS that inventory: it scans basalt-ui's own source for every place that applies
 * `--vx-shadow-card`/`--vx-shadow-ctrl` (a `box-shadow`/CSS-custom-property declaration in
 * `*.module.css`, or a `boxShadow` object property — literal, `VX.shadowCard`/`VX.shadowCtrl`, or a
 * template-literal composite of either — in `*.ts`/`*.tsx`) and asserts every one is registered in
 * `SHADOW_SURFACES` below with a written `roundedBy` reason naming exactly where that box's
 * `border-radius` comes from. Mere mentions in comments/docstrings and the token DEFINITION itself
 * (`tokens/index.ts`, `tokens/palette.ts`) are excluded — this test only cares about APPLICATION.
 *
 * `roundedBy` is a REASON, not a rubber stamp: for several sites the radius is not co-declared on
 * the same object/rule but arrives through a Mantine CSS var resolved elsewhere (`--button-radius`,
 * `--ai-radius`, `--chip-radius`, `--input-radius`, `--card-radius`, `--notification-radius`) or an
 * inline `styles.root.borderRadius` set in a different block of `theme/index.ts` (NavLink) — the
 * whole point of writing it down is forcing whoever adds a new site to go verify that chain against
 * Mantine's actual shipped CSS (`@mantine/core/styles/*.css`), not just copy the shadow line. A box
 * that legitimately has `border-radius: 0` (a genuinely square surface) is a VALID reason too — say
 * so plainly; a square ring on a square surface is correct, not a gap.
 *
 * THIS TEST IS DELIBERATELY COUPLED TO OUR OWN SOURCE. Adding a new `box-shadow: var(--vx-shadow-
 * card)` (or `-ctrl`) anywhere SHOULD fail this test until it's registered — that failure IS the
 * point. Do NOT "fix" a future failure by loosening the scan or bulk-registering with a placeholder
 * reason; open the file, find the element the shadow is declared on, prove (or fix) that IT carries
 * the surface's own border-radius, and write down where that radius comes from.
 *
 * NOTE — `overflow: hidden` does NOT threaten a box's own ring. An element's own outset `box-shadow`
 * is painted outside its border box and is NOT clipped by that element's own `overflow` (only an
 * ANCESTOR's overflow clips a descendant's shadow — verified in a browser). So a surface may safely
 * carry `--vx-shadow-card` AND `overflow: hidden` on the SAME box (e.g. StatCard clipping a full-bleed
 * sparkline). The outer/inner split some surfaces use (ChartCard) is about letting a DESCENDANT — an
 * info-tooltip bubble — escape the clip, not about protecting the ring.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'bun:test'

// ── Source scan ─────────────────────────────────────────────────────────────────────────────────

// `src/theme/../` — never a hardcoded absolute path, so the test keeps working regardless of where
// the repo is checked out.
const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')

// The token's own DEFINITION files — every other mention is either an application (scanned) or a
// comment (ignored).
const DEFINITION_FILES = new Set(['tokens/index.ts', 'tokens/palette.ts'])

/** Recursively collects every `.css`/`.ts`/`.tsx` file under `SRC_DIR`, skipping `dist/` and test
 * files (a test file, including this one, can quote the token in a string/comment without being an
 * application site). */
function collectSourceFiles(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'dist' || entry.name === 'node_modules') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      collectSourceFiles(full, out)
      continue
    }
    if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) continue
    if (entry.name.endsWith('.css') || entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      out.push(full)
    }
  }
}

function stripCssComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '')
}

// Strips `/* */` block comments and `//` line comments. The negative lookbehind on `//` excludes
// `://` (a URL) from being read as a comment start — not that we expect one here, but it's the
// standard guard against eating real code that happens to contain a protocol string.
function stripTsComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

// A real application in CSS: `box-shadow:` OR a custom property (`--field-depth:`, the mechanism
// `.input` uses to receive the token conditionally) whose value contains the literal token var(). A
// bare mention of `--vx-shadow-card` in a comment never matches — comments are stripped first, and
// this requires an actual `property:` declaration.
const CSS_SHADOW_TOKEN =
  /(?<![\w-])(?:box-shadow|--[\w-]+)\s*:\s*[^;]*var\(--vx-shadow-(?:card|ctrl)\)/

// A real application in TS/TSX: a `boxShadow` object property whose value is the literal CSS var
// string, `VX.shadowCard`/`VX.shadowCtrl`, or a template literal compositing either (e.g. the
// danger-zone ring: `` `${VX.shadowCard}, 0 0 0 1px ...` ``). Deliberately does NOT match
// `--vx-shadow-overlay` (a different, unrelated token) or a `boxShadow` string literal that doesn't
// reference either token (data-table's scroll-shadow, guard/index.ts's own regex source, etc.).
const TS_SHADOW_TOKEN =
  /\bboxShadow\s*:\s*(?:'[^']*var\(--vx-shadow-(?:card|ctrl)\)[^']*'|`[^`]*(?:var\(--vx-shadow-(?:card|ctrl)\)|VX\.shadow(?:Card|Ctrl))[^`]*`|VX\.shadow(?:Card|Ctrl))/

type ShadowSite = {
  /** Path relative to `src/`, e.g. `theme/controls.module.css`. */
  readonly file: string
  /** A stable, human-readable label for the box within that file — a CSS selector for `.css`
   * files, or `Component.styles.slot`/a nearby object key for `.ts`/`.tsx` (`default` when a file
   * has exactly one site and no enclosing key to name it, e.g. a bare inline `style={{}}`). */
  readonly site: string
}

/** Every rule in a CSS module whose declarations apply the token, keyed by the rule's own selector
 * (multi-line selectors are collapsed to one line). Assumes flat, non-nested CSS (no native
 * nesting) — the one `@media` block in this codebase sits after every shadow site, so a naive
 * brace-pair scan never needs to understand at-rule nesting to find them. */
function cssShadowSites(relPath: string, text: string): ShadowSite[] {
  const clean = stripCssComments(text)
  const sites: ShadowSite[] = []
  const RULE = /([^{}]+)\{([^{}]*)\}/g
  let match: RegExpExecArray | null
  while ((match = RULE.exec(clean))) {
    const selector = match[1].trim().replace(/\s+/g, ' ')
    const body = match[2]
    if (CSS_SHADOW_TOKEN.test(body)) sites.push({ file: relPath, site: selector })
  }
  return sites
}

/** Every `boxShadow` application in a `.ts`/`.tsx` file, labeled by its nearest enclosing object
 * key chain. Walks backward from each match: the first `key: {`-only line above it names the
 * "slot" (`root`, `indicator`, `input`, …); continuing further back, the first `Name: Name.extend({`
 * line names the Mantine component (`theme/index.ts`'s `components` block). Neither pattern found
 * (a bare `style={{ … }}` object, common outside `theme/index.ts`) falls back to `'default'` — safe
 * because every such file has exactly one site. */
function tsShadowSites(relPath: string, text: string): ShadowSite[] {
  const clean = stripTsComments(text)
  const lines = clean.split('\n')
  const SLOT = /^\s*(\w+):\s*\{\s*$/
  const COMPONENT = /^\s*(\w+):\s*\w+\.extend\(\{\s*$/
  const LOOKBACK = 40
  const sites: ShadowSite[] = []
  for (const [i, line] of lines.entries()) {
    if (!TS_SHADOW_TOKEN.test(line)) continue
    let slot: string | null = null
    let component: string | null = null
    for (let j = i - 1; j >= 0 && j >= i - LOOKBACK; j--) {
      if (slot === null) {
        const slotMatch = SLOT.exec(lines[j])
        if (slotMatch) {
          slot = slotMatch[1]
          continue
        }
      }
      const componentMatch = COMPONENT.exec(lines[j])
      if (componentMatch) {
        component = componentMatch[1]
        break
      }
    }
    const label =
      component !== null
        ? slot !== null
          ? `${component}.styles.${slot}`
          : component
        : (slot ?? 'default')
    sites.push({ file: relPath, site: label })
  }
  return sites
}

/** Every application of `--vx-shadow-card`/`--vx-shadow-ctrl` across `src/**`. */
function scanShadowSites(): ShadowSite[] {
  const files: string[] = []
  collectSourceFiles(SRC_DIR, files)
  const sites: ShadowSite[] = []
  for (const file of files) {
    const relPath = relative(SRC_DIR, file)
    if (DEFINITION_FILES.has(relPath)) continue
    const text = readFileSync(file, 'utf8')
    if (file.endsWith('.css')) sites.push(...cssShadowSites(relPath, text))
    else sites.push(...tsShadowSites(relPath, text))
  }
  return sites
}

function siteKey(site: ShadowSite): string {
  return `${site.file} :: ${site.site}`
}

// ── SHADOW_SURFACES registry ────────────────────────────────────────────────────────────────────

type ShadowSurfaceEntry = ShadowSite & {
  /** Where THIS box's `border-radius` comes from — a co-declared `border-radius`/`borderRadius` in
   * the same rule/object, or a Mantine CSS var/prop resolved elsewhere, VERIFIED against Mantine's
   * actual shipped CSS (`@mantine/core/styles/*.css`) or component source, never inferred from
   * memory. A box with a genuine `border-radius: 0` is a valid reason too, stated plainly — a
   * square ring on a square surface is correct. Never a placeholder — this is the thing a reviewer
   * checks to confirm the ring actually follows this box's own, real corners. */
  readonly roundedBy: string
}

/**
 * The closed registry of every site in `src/**` that applies `--vx-shadow-card`/`--vx-shadow-ctrl`,
 * each with a reasoned `roundedBy`. Modeled on `BORDER_ALLOWLIST` (`border-coverage.test.ts`) /
 * `GUARD_RULES` (`guard/index.ts`): every entry is real, reviewable, and reasoned — never a bare
 * string array.
 */
export const SHADOW_SURFACES: readonly ShadowSurfaceEntry[] = [
  // ── theme/controls.module.css ────────────────────────────────────────────────────────────────
  {
    file: 'theme/controls.module.css',
    site: ".input[data-variant='default']",
    roundedBy:
      "--input-radius (Mantine's own Input.css sets --input-radius: var(--mantine-radius-default) " +
      'on the wrapper and consumes it via `border-radius: var(--input-radius)` directly on the ' +
      '<input> element itself — the custom property inherits from wrapper to input, landing on the ' +
      'exact element the shadow lands on).',
  },
  {
    file: 'theme/controls.module.css',
    site: ".buttonRoot[data-variant='default']",
    roundedBy:
      "--button-radius (Mantine's own Button.css declares `border-radius: var(--button-radius, " +
      'var(--mantine-radius-default))` directly on the button root — the same element `.buttonRoot` ' +
      'targets).',
  },
  {
    file: 'theme/controls.module.css',
    site: ".actionIconRoot[data-variant='default']",
    roundedBy:
      "--ai-radius (Mantine's own ActionIcon.css declares `border-radius: var(--ai-radius, " +
      'var(--mantine-radius-default))` directly on the root — the same element `.actionIconRoot` ' +
      'targets).',
  },
  {
    file: 'theme/controls.module.css',
    site: '.checkboxCardRoot[data-with-border], .radioCardRoot[data-with-border]',
    roundedBy:
      "--card-radius (Mantine's own CheckboxCard.css/RadioCard.css each declare `border-radius: " +
      'var(--card-radius)` directly on the card root — the same element this rule targets).',
  },
  {
    file: 'theme/controls.module.css',
    site: '.chipLabel:not([data-checked]):not([data-disabled])',
    roundedBy:
      "--chip-radius (Mantine's own Chip.css declares `border-radius: var(--chip-radius, 1000rem)` " +
      'directly on the label part — the same element `.chipLabel` targets).',
  },
  // ── theme/nav-link.module.css ────────────────────────────────────────────────────────────────
  {
    file: 'theme/nav-link.module.css',
    site: ".root[data-active], .root[aria-current='page']",
    roundedBy:
      "borderRadius: 6 (theme/index.ts's NavLink.extend styles.root — Mantine renders this as an " +
      'inline style on the root part, wired via `classNames: { root: navLinkClasses.root }` to the ' +
      "exact `.root` element this rule's box-shadow lands on). Verified NOT a square surface: " +
      "Mantine's own NavLink.css declares no border-radius at all for .root — the 6px comes only " +
      'from our own theme override.',
  },
  // ── shell/app-mobile-nav.module.css ──────────────────────────────────────────────────────────
  {
    file: 'shell/app-mobile-nav.module.css',
    site: '.sheet',
    roundedBy:
      'border-top-left-radius / border-top-right-radius: var(--mantine-radius-lg) (co-declared in ' +
      'the same rule).',
  },
  // ── shell/sidebar-search.module.css ──────────────────────────────────────────────────────────
  {
    file: 'shell/sidebar-search.module.css',
    site: '.trigger',
    roundedBy:
      'border-radius: var(--vx-radius-ctrl) (co-declared in the same .trigger rule, on the same ' +
      "UnstyledButton root the box-shadow lands on — the ring follows this box's own corners). " +
      'The collapsed `.railBtn` in the same file carries no shadow (radius only), so it is not a site.',
  },
  // ── theme/index.ts (baseTheme.components) ───────────────────────────────────────────────────
  {
    file: 'theme/index.ts',
    site: 'Card.styles.root',
    roundedBy:
      "borderRadius: 'var(--vx-radius-card)' (co-declared in the same styles.root object).",
  },
  {
    file: 'theme/index.ts',
    site: 'Paper.styles.root',
    roundedBy:
      "borderRadius: 'var(--vx-radius-card)' (co-declared in the same styles.root object).",
  },
  {
    file: 'theme/index.ts',
    site: 'SegmentedControl.styles.indicator',
    roundedBy: 'borderRadius: 5 (co-declared in the same styles.indicator object).',
  },
  {
    file: 'theme/index.ts',
    site: 'Notification.styles.root',
    roundedBy:
      '--notification-radius (defaultProps: { radius: 8 } on the same Notification.extend feeds ' +
      "Mantine's own varsResolver — Notification.mjs sets `--notification-radius: getRadius(8)` " +
      "on the root part; Mantine's own Notification.css declares `border-radius: var(--" +
      'notification-radius)` on that same root element the styles.root boxShadow targets).',
  },
  // ── charts/primitives ────────────────────────────────────────────────────────────────────────
  {
    file: 'charts/primitives/ChartCard.tsx',
    site: 'default',
    roundedBy:
      'Two shadowed boxes in this file, each co-declaring borderRadius: VX.radiusCard with its own ' +
      'boxShadow (both fall back to the file-level default label). (1) cardStyle — the outer card box ' +
      'co-declares borderRadius + boxShadow + backgroundColor, so the ring is bound to THIS radius and ' +
      'matches. It carries NO overflow: the chart body clips itself on a separate inner box ' +
      '(bodyClipStyle, identical bottom-corner radius, no shadow) so the header — and its info-tooltip ' +
      'bubble — can escape the clip; the ring is safe on the outer box either way (an element’s own ' +
      'overflow never clips its own shadow). (2) bubbleStyle — the info-tooltip bubble, a floating panel ' +
      'surface whose ring likewise follows its co-declared card radius.',
  },
  {
    file: 'charts/primitives/ChartTooltip.tsx',
    site: 'default',
    roundedBy: 'borderRadius: 8 (co-declared in the same TOOLTIP_STYLES object).',
  },
  // ── agent-chat ───────────────────────────────────────────────────────────────────────────────
  {
    file: 'agent-chat/composer.tsx',
    site: 'input',
    roundedBy: 'borderRadius: 8 (co-declared in the same styles.input object).',
  },
  {
    file: 'agent-chat/thread-outcome-card.tsx',
    site: 'default',
    roundedBy: 'borderRadius: VX.radiusCard (co-declared in the same inline style object).',
  },
  {
    file: 'agent-chat/thread-message.tsx',
    site: 'default',
    roundedBy: 'borderRadius: VX.radiusCard (co-declared in the same inline style object).',
  },
  // ── agent ────────────────────────────────────────────────────────────────────────────────────
  {
    file: 'agent/stick-to-bottom.tsx',
    site: 'default',
    roundedBy:
      'borderRadius: 999 (co-declared in the same inline style object — a circular button).',
  },
  // ── dashboard ────────────────────────────────────────────────────────────────────────────────
  {
    file: 'dashboard/settings-section.tsx',
    site: 'default',
    roundedBy:
      "Card.styles.root borderRadius: 'var(--vx-radius-card)' (theme/index.ts) — this DangerZone " +
      "call site's inline `style` prop only overrides boxShadow (layering the danger-red ring on " +
      "top); Card's themed border-radius stays active underneath on the same root element.",
  },
]

// ── Tests ────────────────────────────────────────────────────────────────────────────────────────

describe('SHADOW_SURFACES is well-formed', () => {
  test('every entry has a non-empty roundedBy reason', () => {
    for (const entry of SHADOW_SURFACES) {
      expect(entry.roundedBy.length).toBeGreaterThan(0)
    }
  })

  test('no duplicate site entries', () => {
    const keys = SHADOW_SURFACES.map(siteKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  test('no orphaned entries — every registered site is still a real application in source', () => {
    const found = new Set(scanShadowSites().map(siteKey))
    const orphaned = SHADOW_SURFACES.map(siteKey).filter((key) => !found.has(key))
    expect(orphaned).toEqual([])
  })
})

describe('every applied --vx-shadow-card / --vx-shadow-ctrl site is registered', () => {
  // The coverage assertion below is `expect(gaps).toEqual([])`, which passes VACUOUSLY if the scan
  // finds nothing. That is exactly the failure mode `border-coverage.test.ts` already had to guard
  // against once — this is the same tripwire: fail loudly here if the scan stops resolving real
  // sites, rather than quietly nodding a broken scan through as "full coverage".
  test('the scan actually resolves shadow-token application sites (guards against a vacuous pass)', () => {
    const sites = scanShadowSites()
    expect(sites.length).toBeGreaterThanOrEqual(8)
    // .buttonRoot and Card/Paper are the origin sites of the doctrine (docs/DESIGN-SPEC.md §5) —
    // if the scan can't see THEM, the scan is broken, whatever its total count says.
    expect(
      sites.some((s) => s.file === 'theme/controls.module.css' && s.site.includes('.buttonRoot')),
    ).toBe(true)
    expect(sites.some((s) => s.file === 'theme/index.ts' && s.site === 'Card.styles.root')).toBe(
      true,
    )
    expect(sites.some((s) => s.file === 'theme/index.ts' && s.site === 'Paper.styles.root')).toBe(
      true,
    )
  })

  test('every scanned site is registered with a reasoned roundedBy', () => {
    const registered = new Set(SHADOW_SURFACES.map(siteKey))

    const gaps = scanShadowSites()
      .filter((site) => !registered.has(siteKey(site)))
      .map(
        (site) =>
          `${site.file} (${site.site}): applies --vx-shadow-card/--vx-shadow-ctrl but has no ` +
          'entry in SHADOW_SURFACES (src/theme/shadow-surfaces.test.ts). The ring baked into the ' +
          "token follows THIS box's own border-radius — find where this box's radius comes from " +
          '(a co-declared border-radius, or a Mantine CSS var/prop, verified against the shipped ' +
          '@mantine/core CSS), and either register this site with a roundedBy reason, or fix the ' +
          "radius mismatch if the box doesn't actually carry the surface's shape.",
      )

    expect(gaps).toEqual([])
  })
})
