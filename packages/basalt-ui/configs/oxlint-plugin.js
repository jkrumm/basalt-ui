// oxlint-disable import/no-default-export -- oxlint's JS plugin loader requires a default export
/**
 * basalt — the shipped oxlint JS plugin (alpha `jsPlugins`, ESLint-v9-compatible `create(context)`
 * API). Design-guard AST rules steering consumers onto the token/idiom system that `src/guard`
 * (the regex-based `check-theme` CLI) cannot see from a raw-text scan alone, plus three
 * independent architecture-boundary rules (see below).
 *
 * Ships inside `configs/` so the shipped preset (`configs/oxlint.json`) can reference it as
 * `./oxlint-plugin.js` — a consumer `extends`-ing that preset inherits `jsPlugins` too, and the
 * path resolves relative to the preset file, not the consumer's own config.
 *
 * The four design-guard rules below support the same `theme-allow` escape as `src/guard`: skip a
 * reported node if a line comment containing `theme-allow` sits on the node's own line or the line
 * immediately above it. The three boundary rules deliberately do NOT — see their own comment for
 * why.
 *
 * ── The three boundary rules (`visx-boundary` / `visx-tooltip` / `token-layer-boundary`) ─────────
 * These used to be one bundled `import-boundary` rule sharing a single on/off toggle — that meant
 * a consumer disabling the one check they disagreed with silently dropped the other two as well.
 * Each is now its own rule id with its own `meta`/`create`/registration, so a consumer can only
 * turn one off explicitly, by name — never accidentally take out the others with it.
 *
 * `basalt/token-layer-boundary` is registered ONLY in the repo-local `.oxlintrc.json`, NOT in the
 * shipped `configs/oxlint.json` preset — deliberately absent from what consumers inherit. It
 * protects two things.
 *
 * 1. Layering: `src/tokens/**` is pure data (zero React, zero Mantine) that `cssVariablesResolver`
 *    (Mantine-coupled, `src/theme/**`) reads to bind Mantine's surfaces to the same `--vx-*` vars
 *    `src/charts/**` reads — chrome and charts are ONE source. If `tokens` imported `@mantine/*`
 *    that would cycle (`tokens → theme → tokens`); if `charts` imported `@mantine/*` a chart could
 *    read Mantine's theme directly instead of going through `--vx-*`, forking chrome and charts
 *    apart. The rule keeps that arrow pointing one way.
 * 2. Packaging: `./charts` and `./tokens` resolve and render with NO `@mantine/*` installed — real
 *    and CI-tested, not aspirational (`scripts/pack-test.sh`'s "charts/tokens-only (no-Mantine)
 *    resolution + render" step scratch-installs the tarball with only react/react-dom and
 *    SSR-renders `basalt-ui/charts`; `scripts/check-dist-layering.mjs` walks the built dist graph
 *    and fails if those entries reach `@mantine/*`; the root barrel not re-exporting them is the
 *    third leg).
 *
 * The LAYER is Mantine-free — the FRAMEWORK is not: `.` requires Mantine (`@mantine/core`/
 * `@mantine/hooks` are required, non-optional peers); it's just `./charts`/`./tokens` that don't.
 * Both consequences govern basalt's OWN internal layering/packaging, not a consumer contract — a
 * consumer's own `charts/`/`tokens/`-named directories carry no such obligation, which is why
 * shipping this rule in the consumer preset would be meaningless.
 *
 * ── About the shipped `configs/oxlint.json` preset ────────────────────────────────────────────
 * Consumers extend it from their own `.oxlintrc.json` via the node_modules-relative path:
 * `{ "extends": ["./node_modules/basalt-ui/configs/oxlint.json"] }` — oxlint rejects bare
 * specifiers, so the relative `./node_modules` path is required. NOTE: oxlint `extends` is
 * per-glob last-writer-wins for `no-restricted-imports` — a base ban does NOT merge into an
 * override glob, so any ban that must also hold inside an override is duplicated into that
 * override, AND a consumer's own `no-restricted-imports` override on an overlapping glob silently
 * REPLACES basalt's ban rather than merging with it. That is exactly why the `@visx/*`-only-in-
 * charts and token-layer charts/tokens boundaries live in plugin rules below instead of
 * `no-restricted-imports`: a jsPlugin rule has its own rule id, so a consumer can only turn it off
 * explicitly, by name — never silently. `configs/oxlint.json` is generated from `SURFACES` by
 * `scripts/gen-oxlint.ts` (`--check` is the CI drift gate) — its top-level keys are limited to what
 * oxlint's own parser accepts (see `ALLOWED_TOP_LEVEL_KEYS` in that script); do not add ad hoc keys
 * to that file.
 */

// ── Shared helpers ──────────────────────────────────────────────────────────────────────────────

/** True when a `theme-allow` line comment sits on `node`'s own source line or the line above it. */
function hasThemeAllow(context, node) {
  const sourceCode = context.sourceCode ?? context.getSourceCode?.()
  const comments = sourceCode?.getAllComments?.() ?? []
  const nodeLine = node.loc.start.line
  return comments.some(
    (comment) =>
      comment.value.includes('theme-allow') &&
      (comment.loc.end.line === nodeLine || comment.loc.end.line === nodeLine - 1),
  )
}

function getFilename(context) {
  return context.filename ?? context.getFilename?.() ?? ''
}

function isNumericLiteral(node) {
  return node !== null && node.type === 'Literal' && typeof node.value === 'number'
}

/** Unwraps a JSXExpressionContainer to its inner expression; passes any other node through. */
function unwrapExpressionContainer(node) {
  return node !== null && node.type === 'JSXExpressionContainer' ? node.expression : node
}

// ── Rule 1 — no-raw-font-size ───────────────────────────────────────────────────────────────────

const NO_RAW_FONT_SIZE_MESSAGE =
  'Raw font-size literal — route through VX.text.* (numbers) or --vx-text-* (CSS); em/relative ' +
  'ratios are allowed. (basalt/no-raw-font-size)'

const noRawFontSize = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow hardcoded numeric font sizes outside the token system.',
    },
    schema: [],
  },
  create(context) {
    if (getFilename(context).includes('/src/tokens/')) return {}

    return {
      JSXAttribute(node) {
        const name = node.name?.name
        if (name !== 'fz' && name !== 'fontSize') return
        const value = unwrapExpressionContainer(node.value)
        if (!isNumericLiteral(value)) return
        if (hasThemeAllow(context, node)) return
        context.report({ node, message: NO_RAW_FONT_SIZE_MESSAGE })
      },
      Property(node) {
        const key = node.key
        const isFontSizeKey =
          (key.type === 'Identifier' && key.name === 'fontSize') ||
          (key.type === 'Literal' && key.value === 'fontSize')
        if (!isFontSizeKey) return
        if (!isNumericLiteral(node.value)) return
        if (hasThemeAllow(context, node)) return
        context.report({ node, message: NO_RAW_FONT_SIZE_MESSAGE })
      },
    }
  },
}

// ── Rule 2 — card-inset ─────────────────────────────────────────────────────────────────────────

const CARD_TAGS = new Set(['Card', 'Paper'])

const CARD_INSET_MESSAGE =
  'Card/Paper is off the card idiom — use the spacing xs/sm inset (py="xs" px="sm") and the ' +
  "theme's card radius, not an explicit p/padding or radius. (basalt/card-inset)"

function isStringLiteral(node) {
  return node !== null && node.type === 'Literal' && typeof node.value === 'string'
}

function attrValue(attr) {
  return unwrapExpressionContainer(attr.value)
}

const cardInset = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Steer Card/Paper padding and radius onto the shipped card idiom.',
    },
    schema: [],
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const tagName = node.name?.name
        if (!CARD_TAGS.has(tagName)) return

        for (const attr of node.attributes) {
          if (attr.type !== 'JSXAttribute') continue
          const attrName = attr.name?.name
          const value = attrValue(attr)

          const isOffPadding =
            (attrName === 'p' || attrName === 'padding') &&
            ((isStringLiteral(value) && value.value !== 'xs' && value.value !== 'sm') ||
              isNumericLiteral(value))
          const isOffPy = attrName === 'py' && isStringLiteral(value) && value.value !== 'xs'
          const isOffPx = attrName === 'px' && isStringLiteral(value) && value.value !== 'sm'
          const isRadius = attrName === 'radius'

          if (!isOffPadding && !isOffPy && !isOffPx && !isRadius) continue
          if (hasThemeAllow(context, attr)) continue
          context.report({ node: attr, message: CARD_INSET_MESSAGE })
        }
      },
    }
  },
}

// ── Rule 3 — chart-in-raw-surface ───────────────────────────────────────────────────────────────

const CHART_TAGS = new Set([
  'Bars',
  'Donut',
  'DualPanel',
  'Heatmap',
  'MultiLine',
  'StackedArea',
  'ZonedLine',
  'BarSparkline',
  'LineSparkline',
])

const CHART_IN_RAW_SURFACE_MESSAGE =
  'Chart rendered inside a raw Card/Paper — use the shipped ChartCard wrapper (title + ' +
  'info-tooltip + consistent inset). (basalt/chart-in-raw-surface)'

/** True when any JSXElement descendant of `node` opens with a chart-kind tag name. */
function subtreeHasChart(node) {
  if (node === null || node === undefined) return false

  if (node.type === 'JSXElement') {
    const tagName = node.openingElement?.name?.name
    if (CHART_TAGS.has(tagName)) return true
    return node.children.some((child) => subtreeHasChart(child))
  }

  if (node.type === 'JSXFragment') {
    return node.children.some((child) => subtreeHasChart(child))
  }

  if (node.type === 'JSXExpressionContainer') {
    return subtreeHasChart(node.expression)
  }

  if (node.type === 'ConditionalExpression') {
    return subtreeHasChart(node.consequent) || subtreeHasChart(node.alternate)
  }

  if (node.type === 'LogicalExpression') {
    return subtreeHasChart(node.left) || subtreeHasChart(node.right)
  }

  if (node.type === 'ArrayExpression') {
    return node.elements.some((el) => subtreeHasChart(el))
  }

  return false
}

const chartInRawSurface = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow rendering a chart kind directly inside a raw Card/Paper.',
    },
    schema: [],
  },
  create(context) {
    return {
      JSXElement(node) {
        const tagName = node.openingElement?.name?.name
        if (!CARD_TAGS.has(tagName)) return
        const hasChartDescendant = node.children.some((child) => subtreeHasChart(child))
        if (!hasChartDescendant) return
        if (hasThemeAllow(context, node)) return
        context.report({ node, message: CHART_IN_RAW_SURFACE_MESSAGE })
      },
    }
  },
}

// ── Rule 4 — raw-scroll-container ───────────────────────────────────────────────────────────────

const RAW_SCROLL_CONTAINER_MESSAGE =
  'Raw overflow: auto/scroll — use Mantine ScrollArea so the bar floats instead of reserving ' +
  'gutter width (AppSidebar nav is the reference). Legitimate where a library owns the scroll ' +
  'node (BasaltStickToBottom, BasaltVirtualList) — add a theme-allow comment there. ' +
  '(basalt/raw-scroll-container)'

// `overflowX` is deliberately absent: a horizontal bar doesn't reserve gutter width in a chrome
// column, so a horizontally-scrolling code block or pinned-column table is its own legitimate
// pattern, not a ScrollArea candidate. Only the vertical axis carries the doctrine.
const OVERFLOW_KEYS = new Set(['overflow', 'overflowY'])
const SCROLLING_VALUES = new Set(['auto', 'scroll'])

/**
 * Reports a `style` object property that turns a node into its own scroll container. Warning-level
 * by design: whether a raw scroll box is wrong depends on who owns the scroll node, which no AST
 * check can see — so this steers rather than blocks, and `theme-allow` opts out.
 */
const rawScrollContainer = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Steer scroll regions onto Mantine ScrollArea instead of raw overflow.',
    },
    schema: [],
  },
  create(context) {
    return {
      Property(node) {
        const key = node.key
        const keyName =
          key.type === 'Identifier' ? key.name : key.type === 'Literal' ? key.value : undefined
        if (typeof keyName !== 'string' || !OVERFLOW_KEYS.has(keyName)) return
        if (!isStringLiteral(node.value) || !SCROLLING_VALUES.has(node.value.value)) return
        if (hasThemeAllow(context, node)) return
        context.report({ node, message: RAW_SCROLL_CONTAINER_MESSAGE })
      },
    }
  },
}

// ── Rules 5–7 — the three architecture-boundary rules ───────────────────────────────────────────

// Message bodies mirror the wording that used to live in the shipped `no-restricted-imports`
// overrides (configs/oxlint.json) verbatim, so the DX doesn't regress.
const VISX_BOUNDARY_MESSAGE =
  'Direct @visx/* imports are only allowed inside the charts boundary (**/charts/**). ' +
  '(basalt/visx-boundary)'
const VISX_TOOLTIP_MESSAGE =
  'Use ChartTooltip + TooltipHeader/Row/Body from basalt-ui charts primitives. ' +
  '(basalt/visx-tooltip)'
const TOKEN_LAYER_BOUNDARY_MESSAGES = {
  charts:
    'charts must stay upstream-of-Mantine (no Mantine imports) — read color via --vx-* tokens, ' +
    'not the Mantine theme directly. (basalt/token-layer-boundary)',
  tokens:
    'tokens must stay upstream-of-Mantine (no Mantine imports) — importing Mantine here would ' +
    'cycle back through cssVariablesResolver. (basalt/token-layer-boundary)',
}

/** True when any path segment of `filename` equals `segment` (POSIX or Windows separators). */
function hasPathSegment(filename, segment) {
  return filename.split(/[\\/]/).includes(segment)
}

/** Import specifier for an ImportDeclaration or a dynamic `import()` call; undefined otherwise. */
function importSource(node) {
  if (node.type === 'ImportDeclaration') return node.source?.value
  if (node.type === 'ImportExpression' && node.source?.type === 'Literal') {
    return node.source.value
  }
  return undefined
}

/**
 * Import specifier for a source-bearing export (`export { x } from '…'` / `export * from '…'`);
 * undefined for a plain local `export { x }` (no `source`) or any other node shape.
 */
function exportSource(node) {
  if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') {
    return node.source?.value
  }
  return undefined
}

/**
 * Wires a `reportFor(node, source)` boundary check into the four import/export AST handlers shared
 * by all three boundary rules below.
 */
function boundaryVisitor(reportFor) {
  return {
    ImportDeclaration(node) {
      reportFor(node, importSource(node))
    },
    ImportExpression(node) {
      reportFor(node, importSource(node))
    },
    ExportNamedDeclaration(node) {
      reportFor(node, exportSource(node))
    },
    ExportAllDeclaration(node) {
      reportFor(node, exportSource(node))
    },
  }
}

// Rule 5 — visx-boundary: @visx/* only allowed inside a `charts` path segment. Matching any path
// segment named `charts` is deliberately permissive, not restrictive — it only ever widens where
// visx is allowed, never narrows where it's flagged elsewhere. "Your visx lives in a charts/ dir"
// is the intended convention.
const visxBoundary = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow direct @visx/* imports outside a charts/ directory.',
    },
    schema: [],
  },
  create(context) {
    const inCharts = hasPathSegment(getFilename(context), 'charts')

    // Deliberately NO `hasThemeAllow` escape here (unlike the four design-guard rules above).
    // `theme-allow` exists so the theme/palette source can opt out of DESIGN guidance (raw font
    // sizes, raw colors) — it is not a license to punch through an ARCHITECTURE boundary. The whole
    // point of moving this check into its own plugin rule instead of `no-restricted-imports` was
    // that it can only be turned off explicitly, by rule id (see the file-header comment); a stray
    // `theme-allow` comment (which also matches the line above the flagged node) must not silently
    // bypass it. Do not "restore consistency" by adding it back.
    function reportFor(node, source) {
      if (typeof source !== 'string' || !source.startsWith('@visx/')) return
      if (source === '@visx/tooltip') return // basalt/visx-tooltip owns this one, everywhere
      if (!inCharts) context.report({ node, message: VISX_BOUNDARY_MESSAGE })
    }

    return boundaryVisitor(reportFor)
  },
}

// Rule 6 — visx-tooltip: @visx/tooltip banned everywhere, including inside charts. Fires ahead of
// (and instead of) basalt/visx-boundary for that one specifier — basalt's own src/ never imports
// @visx/tooltip, so no theme-allow-style exemption is needed here either.
const visxTooltip = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow @visx/tooltip everywhere — use basalt-ui ChartTooltip instead.',
    },
    schema: [],
  },
  create(context) {
    function reportFor(node, source) {
      if (source !== '@visx/tooltip') return
      context.report({ node, message: VISX_TOOLTIP_MESSAGE })
    }

    return boundaryVisitor(reportFor)
  },
}

// Rule 7 — token-layer-boundary: @mantine/* banned inside `charts` OR `tokens` path segments —
// keeps the token layer upstream of Mantine AND keeps those two subpaths resolving with no
// @mantine/* installed (see the file-header comment for the cycle/fork + packaging rationale).
// Repo-local only — never registered in the shipped consumer preset, since this governs basalt's
// own internal layering/packaging, not a consumer contract.
const tokenLayerBoundary = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow @mantine/* imports inside charts/ or tokens/ directories.',
    },
    schema: [],
  },
  create(context) {
    const filename = getFilename(context)
    const inCharts = hasPathSegment(filename, 'charts')
    const inTokens = hasPathSegment(filename, 'tokens')

    // Deliberately NO `hasThemeAllow` escape — see basalt/visx-boundary's comment above for why.
    function reportFor(node, source) {
      if (typeof source !== 'string') return
      if (
        source !== '@mantine/core' &&
        source !== '@mantine/hooks' &&
        !source.startsWith('@mantine/')
      )
        return

      if (inCharts) {
        context.report({ node, message: TOKEN_LAYER_BOUNDARY_MESSAGES.charts })
      } else if (inTokens) {
        context.report({ node, message: TOKEN_LAYER_BOUNDARY_MESSAGES.tokens })
      }
    }

    return boundaryVisitor(reportFor)
  },
}

// ── Plugin export ───────────────────────────────────────────────────────────────────────────────

export default {
  meta: { name: 'basalt' },
  rules: {
    'no-raw-font-size': noRawFontSize,
    'card-inset': cardInset,
    'chart-in-raw-surface': chartInRawSurface,
    'raw-scroll-container': rawScrollContainer,
    'visx-boundary': visxBoundary,
    'visx-tooltip': visxTooltip,
    'token-layer-boundary': tokenLayerBoundary,
  },
}
