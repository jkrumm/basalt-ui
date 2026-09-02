/**
 * The CSS-scan gates, consolidated: four source-coupled inventories that used to live as
 * `src/theme/{shadow-surfaces,border-coverage,ctl-tier-coverage,layout-rhythm-css}.test.ts` (C2,
 * "lint rules written as tests" per `.claude/maturation/audit-d-package-surface.md` §7). Each
 * section below is the SAME scan, the SAME registry, and the SAME failure condition as its former
 * file — moved here because none of the four asserts anything through `bun:test`'s runtime beyond
 * "these arrays are empty"; they belong beside `check-theme`, not inside the unit suite.
 *
 * Usage: bun scripts/check-theme-css.ts
 *
 * `tests/theme-css-gate.test.ts` runs this script as a subprocess and asserts exit 0, so `bun test`
 * still covers all four sections without re-implementing their scans.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_THEME, mergeMantineTheme } from '@mantine/core'
import type { MantineTheme } from '@mantine/core'
import * as MantineCore from '@mantine/core'

import { CTL_THEME, baseTheme, cssVariablesResolver } from '../src/theme/index'

const PKG_ROOT = join(import.meta.dir, '..')
const SRC_DIR = join(PKG_ROOT, 'src')

// ════════════════════════════════════════════════════════════════════════════════════════════════
// 1. Shadow-surface coverage — every `--vx-shadow-card`/`-ctrl`/`-raised` application site must be
//    registered with a `roundedBy` reason (moved verbatim from shadow-surfaces.test.ts).
// ════════════════════════════════════════════════════════════════════════════════════════════════

const SHADOW_DEFINITION_FILES = new Set(['tokens/index.ts', 'tokens/palette.ts'])

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

function stripTsComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const CSS_SHADOW_TOKEN =
  /(?<![\w-])(?:box-shadow|--[\w-]+)\s*:\s*[^;]*var\(--vx-shadow-(?:card|ctrl|raised)\)/

const TS_SHADOW_TOKEN =
  /\bboxShadow\s*:\s*(?:'[^']*var\(--vx-shadow-(?:card|ctrl|raised)\)[^']*'|`[^`]*(?:var\(--vx-shadow-(?:card|ctrl|raised)\)|VX\.shadow(?:Card|Ctrl|Raised))[^`]*`|VX\.shadow(?:Card|Ctrl|Raised))/

type ShadowSite = {
  readonly file: string
  readonly site: string
}

function cssShadowSites(relPath: string, text: string): ShadowSite[] {
  const clean = stripCssComments(text)
  const sites: ShadowSite[] = []
  const RULE = /([^{}]+)\{([^{}]*)\}/g
  let match: RegExpExecArray | null
  while ((match = RULE.exec(clean))) {
    const selector = match[1]!.trim().replace(/\s+/g, ' ')
    const body = match[2]!
    if (CSS_SHADOW_TOKEN.test(body)) sites.push({ file: relPath, site: selector })
  }
  return sites
}

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
      const jLine = lines[j]!
      if (slot === null) {
        const slotMatch = SLOT.exec(jLine)
        if (slotMatch) {
          slot = slotMatch[1]!
          continue
        }
      }
      const componentMatch = COMPONENT.exec(jLine)
      if (componentMatch) {
        component = componentMatch[1]!
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

function scanShadowSites(): ShadowSite[] {
  const files: string[] = []
  collectSourceFiles(SRC_DIR, files)
  const sites: ShadowSite[] = []
  for (const file of files) {
    const relPath = relative(SRC_DIR, file)
    if (SHADOW_DEFINITION_FILES.has(relPath)) continue
    const text = readFileSync(file, 'utf8')
    if (file.endsWith('.css')) sites.push(...cssShadowSites(relPath, text))
    else sites.push(...tsShadowSites(relPath, text))
  }
  return sites
}

function shadowSiteKey(site: ShadowSite): string {
  return `${site.file} :: ${site.site}`
}

type ShadowSurfaceEntry = ShadowSite & {
  readonly roundedBy: string
}

/**
 * The closed registry of every site in `src/**` that applies `--vx-shadow-card`/`-ctrl`/`-raised`,
 * each with a reasoned `roundedBy`. See this script's header for why it lives here now — the
 * registry text itself, and every reason in it, is unchanged from `shadow-surfaces.test.ts`.
 */
const SHADOW_SURFACES: readonly ShadowSurfaceEntry[] = [
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
    site:
      ".buttonRoot[data-variant='default'], .buttonRoot[data-variant='filled'], " +
      ".buttonRoot[data-variant='light']",
    roundedBy:
      "--button-radius (Mantine's own Button.css declares `border-radius: var(--button-radius, " +
      'var(--mantine-radius-default))` directly on the button root — the same element `.buttonRoot` ' +
      'targets). This is the raised family on the shared `shadow-raised`, and its ring is INSET — a ' +
      'radius mismatch would leak nubs on the INSIDE of each corner rather than the outside, so the ' +
      'invariant bites exactly as hard here as on an outset ring.',
  },
  {
    file: 'theme/controls.module.css',
    site: ".buttonRoot[data-variant='outline']",
    roundedBy:
      '--button-radius (same chain as the raised-family entry above — Button.css declares ' +
      '`border-radius: var(--button-radius, var(--mantine-radius-default))` on the button root; the ' +
      'variant changes only which depth token lands, never which element carries it). `outline` is ' +
      'the one raised variant on ring-FREE `shadow-ctrl`, because its real 1px accent border already ' +
      'IS its edge and an inset ring tucked just inside a border is muddy — so no ring is at risk ' +
      'here at all, and the registration exists to keep the inventory exhaustive.',
  },
  {
    file: 'theme/controls.module.css',
    site:
      ".actionIconRoot[data-variant='default'], .actionIconRoot[data-variant='filled'], " +
      ".actionIconRoot[data-variant='light']",
    roundedBy:
      "--ai-radius (Mantine's own ActionIcon.css declares `border-radius: var(--ai-radius, " +
      'var(--mantine-radius-default))` directly on the root — the same element `.actionIconRoot` ' +
      'targets). Same inset-ring reasoning as the Button raised-family entry above.',
  },
  {
    file: 'theme/controls.module.css',
    site: ".actionIconRoot[data-variant='outline']",
    roundedBy:
      '--ai-radius (same chain as the entry above — ActionIcon.css declares `border-radius: ' +
      'var(--ai-radius, var(--mantine-radius-default))` on the root). Ring-free `shadow-ctrl`, same ' +
      "reason as Button's `outline`. ActionIcon has no `subtle` counterpart to Button's " +
      "hover-materialized entry by design: its `subtle` IS the spec's separate ghost-icon-button " +
      'idiom (DESIGN-SPEC §5), whose hover state is an ink tint, not a raise.',
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
  {
    file: 'shell/app-mobile-nav.module.css',
    site: '.sheet',
    roundedBy:
      'border-top-left-radius / border-top-right-radius: var(--mantine-radius-lg) (co-declared in ' +
      'the same rule).',
  },
  {
    file: 'shell/sidebar-search.module.css',
    site: '.trigger',
    roundedBy:
      'border-radius: var(--vx-radius-ctrl) (co-declared in the same .trigger rule, on the same ' +
      "UnstyledButton root the box-shadow lands on — the ring follows this box's own corners). " +
      'The collapsed `.railBtn` in the same file carries no shadow (radius only), so it is not a site.',
  },
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
  {
    file: 'dashboard/widget-header.module.css',
    site: '.infoBubble',
    roundedBy:
      'border-radius: var(--vx-radius-card) (co-declared in the same .infoBubble rule as the ' +
      'box-shadow, so the ring follows this box’s own shape). This is the info-tooltip bubble that ' +
      'used to live in charts/primitives/ChartCard.tsx as `bubbleStyle`; it moved down into ' +
      'WidgetHeader when ChartCard started composing it, so every tier gets the same ' +
      'hover/focus/click affordance. Nothing clips it: its host `.info` span is `position: ' +
      'relative` with no overflow, and ChartCard deliberately keeps its header outside the chart ' +
      'body’s clip box for exactly this reason.',
  },
  {
    file: 'charts/primitives/ChartCard.tsx',
    site: 'default',
    roundedBy:
      'One shadowed box in this file: cardStyle — the outer card box co-declares borderRadius: ' +
      'VX.radiusCard + boxShadow + backgroundColor, so the ring is bound to THIS radius and ' +
      'matches. It carries NO overflow: the chart body clips itself on a separate inner box ' +
      '(bodyClipStyle, identical bottom-corner radius, no shadow) so the header — and the info ' +
      'bubble WidgetHeader opens under it — can escape the clip; the ring is safe on the outer box ' +
      'either way (an element’s own overflow never clips its own shadow). The second shadowed box ' +
      'this entry used to cover, `bubbleStyle`, now lives in widget-header.module.css’s ' +
      '.infoBubble (registered above).',
  },
  {
    file: 'charts/primitives/ChartTooltip.tsx',
    site: 'default',
    roundedBy: 'borderRadius: 8 (co-declared in the same TOOLTIP_STYLES object).',
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
  {
    file: 'agent-chat/thread-feed-row.tsx',
    site: 'default',
    roundedBy:
      'borderRadius: VX.radiusCard (co-declared in the same inline style object as the shadow). ' +
      'This box also carries overflow: hidden, which is what lets the header button and the ' +
      'expanded body square off against the row’s rounded corners; an element’s own overflow ' +
      'never clips its own ring, so the shadow is unaffected.',
  },
  {
    file: 'agent/stick-to-bottom.tsx',
    site: 'default',
    roundedBy:
      'borderRadius: 999 (co-declared in the same inline style object — a circular button).',
  },
  {
    file: 'dashboard/settings-section.tsx',
    site: 'default',
    roundedBy:
      "Card.styles.root borderRadius: 'var(--vx-radius-card)' (theme/index.ts) — this DangerZone " +
      "call site's inline `style` prop only overrides boxShadow (layering the danger-red ring on " +
      "top); Card's themed border-radius stays active underneath on the same root element.",
  },
]

function checkShadowSurfaces(): string[] {
  const failures: string[] = []

  for (const entry of SHADOW_SURFACES) {
    if (entry.roundedBy.length === 0) {
      failures.push(`shadow-surfaces: ${shadowSiteKey(entry)} has an empty roundedBy reason`)
    }
  }

  const keys = SHADOW_SURFACES.map(shadowSiteKey)
  if (new Set(keys).size !== keys.length) {
    failures.push('shadow-surfaces: SHADOW_SURFACES has duplicate site entries')
  }

  const sites = scanShadowSites()
  const found = new Set(sites.map(shadowSiteKey))
  const orphaned = SHADOW_SURFACES.map(shadowSiteKey).filter((key) => !found.has(key))
  for (const key of orphaned) {
    failures.push(
      `shadow-surfaces: ${key} is registered but no longer a real application in source`,
    )
  }

  // Guards against a vacuous pass — if the scan stops resolving real sites, fail loudly here rather
  // than quietly nodding a broken scan through as "full coverage".
  if (sites.length < 8) {
    failures.push(
      `shadow-surfaces: the scan found only ${sites.length} site(s) — expected at least 8; the scan ` +
        'itself may be broken',
    )
  }
  if (
    !sites.some((s) => s.file === 'theme/controls.module.css' && s.site.includes('.buttonRoot'))
  ) {
    failures.push('shadow-surfaces: the scan cannot see theme/controls.module.css .buttonRoot')
  }
  if (!sites.some((s) => s.file === 'theme/index.ts' && s.site === 'Card.styles.root')) {
    failures.push('shadow-surfaces: the scan cannot see theme/index.ts Card.styles.root')
  }
  if (!sites.some((s) => s.file === 'theme/index.ts' && s.site === 'Paper.styles.root')) {
    failures.push('shadow-surfaces: the scan cannot see theme/index.ts Paper.styles.root')
  }

  const registered = new Set(SHADOW_SURFACES.map(shadowSiteKey))
  for (const site of sites) {
    if (registered.has(shadowSiteKey(site))) continue
    failures.push(
      `shadow-surfaces: ${site.file} (${site.site}): applies --vx-shadow-card/-ctrl/-raised but has ` +
        "no entry in SHADOW_SURFACES (scripts/check-theme-css.ts) — find where this box's " +
        'border-radius comes from and register it with a roundedBy reason, or fix the radius ' +
        "mismatch if the box doesn't actually carry the surface's shape.",
    )
  }

  return failures
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// 2. Border coverage — every bordered @mantine/core component must be themed (baseTheme.components)
//    or allowlisted (moved verbatim from border-coverage.test.ts).
// ════════════════════════════════════════════════════════════════════════════════════════════════

const MANTINE_CORE_ROOT = dirname(fileURLToPath(import.meta.resolve('@mantine/core/styles.css')))
const MANTINE_STYLES_DIR = join(MANTINE_CORE_ROOT, 'styles')

const BORDER_DECLARATION =
  /(?<![\w-])border(-top|-bottom|-left|-right|-inline-start|-inline-end|-block-start|-block-end|-color|-width|-style)?\s*:|(?<![\w-])--[\w-]*-bd(-[\w-]+)?\s*:/

function isThemeableComponent(name: string): boolean {
  const candidate = (MantineCore as Record<string, unknown>)[name]
  return typeof candidate === 'function' && 'extend' in candidate
}

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

type BorderAllowlistEntry = {
  readonly component: string
  readonly kind: 'layout-divider' | 'not-a-surface'
  readonly reason: string
}

/** See border-coverage.test.ts's former header for the full doctrine; entries unchanged. */
const BORDER_ALLOWLIST: readonly BorderAllowlistEntry[] = [
  {
    component: 'AppShell',
    kind: 'layout-divider',
    reason:
      "The shell keeps every section's [data-with-border] ON — a structural boundary between page regions, not a default-variant control; colour is pinned to --vx-divider through AppShell.extend({ vars }).",
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

function checkBorderCoverage(): string[] {
  const failures: string[] = []

  for (const entry of BORDER_ALLOWLIST) {
    if (entry.reason.length === 0) {
      failures.push(`border-coverage: ${entry.component} has an empty allowlist reason`)
    }
  }
  const names = BORDER_ALLOWLIST.map((e) => e.component)
  if (new Set(names).size !== names.length) {
    failures.push('border-coverage: BORDER_ALLOWLIST has duplicate component entries')
  }

  const found = borderedMantineComponents()
  // Guards against a vacuous pass — an early version filtered on `typeof === 'object'` (Mantine
  // factory components are FUNCTIONS with a static `.extend`) and enumerated nothing while green.
  if (found.length <= 20) {
    failures.push(
      `border-coverage: the scan found only ${found.length} bordered component(s) — expected more ` +
        'than 20; the scan itself may be broken',
    )
  }
  if (!found.includes('Card')) {
    failures.push('border-coverage: the scan cannot see Card — the scan itself may be broken')
  }

  const themed = new Set(Object.keys(baseTheme.components ?? {}))
  const allowlisted = new Set(BORDER_ALLOWLIST.map((e) => e.component))
  for (const name of found) {
    if (themed.has(name) || allowlisted.has(name)) continue
    failures.push(
      `border-coverage: ${name} ships a stock Mantine border (@mantine/core/styles/${name}.css) but ` +
        'is neither a key in baseTheme.components (src/theme/index.ts) nor an entry in ' +
        'BORDER_ALLOWLIST (scripts/check-theme-css.ts). Classify it: theme it (panel bg + ' +
        'box-shadow: var(--vx-shadow-card), no border, scoped to variant="default" or its ' +
        'equivalent), or allowlist it as a layout divider / not-a-surface with a written reason. ' +
        'See docs/DESIGN-SPEC.md doctrine inversion #1.',
    )
  }

  return failures
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// 3. ctl-tier var coverage — every `getSize`/`getFontSize` prefix the tier's components read must
//    have a declared `-ctl` var (moved verbatim from ctl-tier-coverage.test.ts).
// ════════════════════════════════════════════════════════════════════════════════════════════════

const ctlTheme: MantineTheme = mergeMantineTheme(DEFAULT_THEME, baseTheme)

const MANTINE_CORE_ESM_COMPONENTS = join(
  dirname(require.resolve('@mantine/core/package.json')),
  'esm/components',
)

const CTL_TIER_COMPONENTS = [
  'Button',
  'ActionIcon',
  'Input',
  'SegmentedControl',
  'Combobox',
  'Select',
  'MultiSelect',
  'TextInput',
  'Menu',
  'Radio',
  'Checkbox',
  'Switch',
  'NativeSelect',
  'Slider',
  'NumberInput',
] as const

function collectMjsFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (/Group/.test(entry)) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) out.push(...collectMjsFiles(full))
    else if (entry.endsWith('.mjs')) out.push(full)
  }
  return out
}

function collectSizePrefixes(): Set<string> {
  const prefixes = new Set<string>()
  for (const component of CTL_TIER_COMPONENTS) {
    for (const file of collectMjsFiles(join(MANTINE_CORE_ESM_COMPONENTS, component))) {
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(/get(?:Size|Spacing)\(\s*[\w.?]+\s*,\s*["']([\w-]+)["']/g)) {
        prefixes.add(m[1]!)
      }
      if (/getFontSize\(/.test(src)) prefixes.add('mantine-font-size')
    }
  }
  return prefixes
}

function checkCtlTierCoverage(): string[] {
  const failures: string[] = []
  const prefixes = collectSizePrefixes()

  const sanityPrefixes = [
    'button-height',
    'button-padding-x',
    'ai-size',
    'input-height',
    'sc-padding',
    'combobox-option-padding',
    'combobox-chevron-size',
    'mantine-font-size',
  ]
  for (const prefix of sanityPrefixes) {
    if (!prefixes.has(prefix)) {
      failures.push(
        `ctl-tier-coverage: the scan cannot find prefix '${prefix}' — the scan itself may be broken`,
      )
    }
  }

  const radioCheckboxSwitchPrefixes = [
    'radio-size',
    'radio-icon-size',
    'checkbox-size',
    'switch-height',
    'switch-width',
    'switch-thumb-size',
    'switch-label-font-size',
    'switch-track-label-padding',
  ]
  for (const prefix of radioCheckboxSwitchPrefixes) {
    if (!prefixes.has(prefix)) {
      failures.push(
        `ctl-tier-coverage: the scan cannot reach prefix '${prefix}' (Radio/Checkbox/Switch)`,
      )
    }
  }

  if (prefixes.has('checkbox-icon-size')) {
    failures.push(
      'ctl-tier-coverage: unexpected prefix checkbox-icon-size — Checkbox derives its tick in CSS, ' +
        'not via getSize; declaring --checkbox-icon-size-ctl would be dead weight',
    )
  }

  const declared = cssVariablesResolver(ctlTheme).variables
  const missing = [...prefixes].filter((prefix) => !(`--${prefix}-ctl` in declared))
  for (const prefix of missing) {
    failures.push(
      `ctl-tier-coverage: '--${prefix}-ctl' is read by a scanned component but not declared in ` +
        'cssVariablesResolver (src/theme/index.ts)',
    )
  }

  if (declared['--ai-size-icon'] === undefined) {
    failures.push('ctl-tier-coverage: --ai-size-icon is not declared (ActionIcon size="icon")')
  }
  if (declared['--mantine-line-height-ctl'] === undefined) {
    failures.push('ctl-tier-coverage: --mantine-line-height-ctl is not declared')
  }

  const scanned = new Set<string>(CTL_TIER_COMPONENTS)
  const themed = Object.keys(CTL_THEME.components ?? {}).map((name) =>
    name.endsWith('Group') ? name.slice(0, -'Group'.length) : name,
  )
  const unscannedThemed = themed.filter((name) => !scanned.has(name))
  for (const name of unscannedThemed) {
    failures.push(
      `ctl-tier-coverage: ${name} defaults to size="ctl" in CTL_THEME but is not in the scanned ` +
        'CTL_TIER_COMPONENTS list (scripts/check-theme-css.ts)',
    )
  }

  return failures
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// 4. Layout-rhythm CSS-text regressions — two shell rules that broke silently because neither is
//    exercised by a render test (moved verbatim from layout-rhythm-css.test.ts).
// ════════════════════════════════════════════════════════════════════════════════════════════════

function extractMediaBlock(css: string, mediaStart: number): { body: string; end: number } {
  const braceStart = css.indexOf('{', mediaStart)
  let depth = 0
  for (let i = braceStart; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}') {
      depth--
      if (depth === 0) return { body: css.slice(braceStart + 1, i), end: i + 1 }
    }
  }
  throw new Error('unterminated @media block')
}

function checkLayoutRhythmCss(): string[] {
  const failures: string[] = []
  const appSidebarCss = readFileSync(join(SRC_DIR, 'shell/app-sidebar.module.css'), 'utf8')
  const pageBarCss = readFileSync(join(SRC_DIR, 'shell/page-bar.module.css'), 'utf8')

  const railStart = appSidebarCss.indexOf('@media (min-width: 48em)')
  if (railStart < 0) {
    failures.push('layout-rhythm-css: app-sidebar.module.css has no @media (min-width: 48em) block')
  } else {
    const rail = appSidebarCss.slice(railStart)
    if (!rail.includes('.root[data-collapsed] .footerVersion {\n    display: none;\n  }')) {
      failures.push(
        'layout-rhythm-css: .footerVersion hide is not scoped to .root[data-collapsed] inside the ' +
          'rail media query',
      )
    }
    for (const m of rail.matchAll(/([^{}\n]+)\{\s*display:\s*none;\s*\}/g)) {
      const selector = m[1]!.trim()
      if (!selector.endsWith('.footerVersion')) continue
      if (!selector.includes('[data-collapsed]')) {
        failures.push(
          `layout-rhythm-css: an unscoped .footerVersion rule ('${selector}') hides the version ` +
            'label at every desktop viewport, not just when collapsed',
        )
      }
    }
    if ([...rail.matchAll(/\.footerIconSlot\s*\{/g)].length > 0) {
      failures.push(
        'layout-rhythm-css: .footerIconSlot is duplicated inside the rail media query (should be ' +
          'declared once, outside it)',
      )
    }
  }

  const barStart = pageBarCss.indexOf('.bar {')
  if (barStart < 0) {
    failures.push('layout-rhythm-css: page-bar.module.css has no .bar rule')
  } else {
    const bar = pageBarCss.slice(barStart, pageBarCss.indexOf('\n}', barStart))
    if (!bar.includes('z-index: calc(var(--app-shell-header-z-index, 100) - 1);')) {
      failures.push(
        'layout-rhythm-css: .bar does not sit one layer below the AppShell header z-index',
      )
    }
    if (/z-index:\s*1\s*;/.test(bar)) {
      failures.push('layout-rhythm-css: .bar declares a bare z-index: 1, which a sibling can equal')
    }
  }

  const row2Start = pageBarCss.indexOf('.row2Band {')
  if (row2Start < 0) {
    failures.push('layout-rhythm-css: page-bar.module.css has no .row2Band rule')
  } else {
    const row2 = pageBarCss.slice(row2Start, pageBarCss.indexOf('\n}', row2Start))
    if (row2.includes('position:')) {
      failures.push(
        'layout-rhythm-css: .row2Band declares position: — the shell band owns geometry',
      )
    }
    if (row2.includes('z-index:')) {
      failures.push('layout-rhythm-css: .row2Band declares z-index:')
    }
    if (row2.includes('border-bottom')) {
      failures.push('layout-rhythm-css: .row2Band declares border-bottom')
    }
  }

  const decls = pageBarCss.replace(/\/\*[\s\S]*?\*\//g, '')
  const mediaStart = decls.indexOf('@media (max-width: 47.99375em)')
  if (mediaStart < 0) {
    failures.push(
      'layout-rhythm-css: page-bar.module.css has no @media (max-width: 47.99375em) block',
    )
  } else {
    const { body: mobileBlock, end: mediaEnd } = extractMediaBlock(decls, mediaStart)
    const desktopCss = decls.slice(0, mediaStart) + decls.slice(mediaEnd)

    const mobileRow2 = mobileBlock.match(/\.row2\s*\{([^}]*)\}/)
    if (mobileRow2 === null || !/flex-direction:\s*column/.test(mobileRow2[1] ?? '')) {
      failures.push(
        'layout-rhythm-css: the mobile media block does not set .row2 flex-direction: column',
      )
    }

    if (decls.includes('flex-wrap: wrap')) {
      failures.push('layout-rhythm-css: page-bar.module.css declares flex-wrap: wrap (law C7)')
    }
    if (decls.includes('overflow-x')) {
      failures.push('layout-rhythm-css: page-bar.module.css declares overflow-x (law C7)')
    }

    const pillsStart = decls.indexOf('.pills {')
    if (pillsStart < 0) {
      failures.push('layout-rhythm-css: page-bar.module.css has no .pills rule')
    } else {
      const pillsRule = decls.slice(pillsStart, decls.indexOf('\n}', pillsStart))
      if (!pillsRule.includes('flex-wrap: nowrap')) {
        failures.push('layout-rhythm-css: .pills does not declare flex-wrap: nowrap')
      }
    }

    const desktopRow2 = desktopCss.match(/\.row2\s*\{([^}]*)\}/)
    if (desktopRow2 === null) {
      failures.push('layout-rhythm-css: no .row2 rule outside the mobile media block')
    } else if (/flex-direction:\s*column/.test(desktopRow2[1] ?? '')) {
      failures.push('layout-rhythm-css: desktop .row2 declares flex-direction: column')
    }

    if (/\.tabs\s*>\s*\*\s*\{/.test(mobileBlock)) {
      failures.push(
        'layout-rhythm-css: the mobile tabs selector matches `.tabs > *` — the inert CtlSlot ' +
          'wrapper, never ViewTabs (display: contents means it must reach past it)',
      )
    }
    if (!/\.tabs\s*>\s*\[data-basalt-tier\]\s*>\s*\*\s*\{/.test(mobileBlock)) {
      failures.push(
        'layout-rhythm-css: the mobile tabs selector does not reach past the CtlSlot wrapper',
      )
    }
    if (
      !/\.tabs\s*>\s*\[data-basalt-tier\]\s*>\s*:global\(\.mantine-Select-root\)\s*\{/.test(
        mobileBlock,
      )
    ) {
      failures.push('layout-rhythm-css: the mobile tabs Select fallback selector is missing')
    }

    const emptyPillsRule = mobileBlock.match(/\.pills:not\(:has\(([^)]*)\)\)\s*\{([^}]*)\}/)
    if (emptyPillsRule === null) {
      failures.push(
        'layout-rhythm-css: no .pills:not(:has(...)) rule in the mobile media block (law C14)',
      )
    } else {
      if (!(emptyPillsRule[1] ?? '').includes('> .filters')) {
        failures.push('layout-rhythm-css: the empty-.pills selector does not exclude > .filters')
      }
      if (!(emptyPillsRule[1] ?? '').includes('> .panelPill')) {
        failures.push('layout-rhythm-css: the empty-.pills selector does not exclude > .panelPill')
      }
      if (!/display:\s*none/.test(emptyPillsRule[2] ?? '')) {
        failures.push('layout-rhythm-css: the empty-.pills rule does not display: none')
      }
    }
  }

  return failures
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// Report
// ════════════════════════════════════════════════════════════════════════════════════════════════

function main(): number {
  const failures = [
    ...checkShadowSurfaces(),
    ...checkBorderCoverage(),
    ...checkCtlTierCoverage(),
    ...checkLayoutRhythmCss(),
  ]

  if (failures.length === 0) {
    console.log('✓ check-theme-css: all 4 sections pass.')
    return 0
  }

  console.error(`✖ check-theme-css: ${failures.length} failure(s)`)
  for (const f of failures) console.error(`  ${f}`)
  return 1
}

if (import.meta.main) {
  process.exit(main())
}

export { main }
