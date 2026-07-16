// oxlint-disable import/no-default-export -- oxlint's JS plugin loader requires a default export
/**
 * basalt — the shipped oxlint JS plugin (alpha `jsPlugins`, ESLint-v9-compatible `create(context)`
 * API). Three design-guard AST rules steering consumers onto the token/idiom system that
 * `src/guard` (the regex-based `check-theme` CLI) cannot see from a raw-text scan alone.
 *
 * Ships inside `configs/` so the shipped preset (`configs/oxlint.json`) can reference it as
 * `./oxlint-plugin.js` — a consumer `extends`-ing that preset inherits `jsPlugins` too, and the
 * path resolves relative to the preset file, not the consumer's own config.
 *
 * Every rule supports the same `theme-allow` escape as `src/guard`: skip a reported node if a line
 * comment containing `theme-allow` sits on the node's own line or the line immediately above it.
 *
 * ── About the shipped `configs/oxlint.json` preset ────────────────────────────────────────────
 * Consumers extend it from their own `.oxlintrc.json` via the node_modules-relative path:
 * `{ "extends": ["./node_modules/basalt-ui/configs/oxlint.json"] }` — oxlint rejects bare
 * specifiers, so the relative `./node_modules` path is required. NOTE: oxlint `extends` is
 * per-glob last-writer-wins for `no-restricted-imports` — a base ban does NOT merge into an
 * override glob, so any ban that must also hold inside an override is duplicated into that
 * override. `configs/oxlint.json` is generated from `SURFACES` by `scripts/gen-oxlint.ts`
 * (`--check` is the CI drift gate) — its top-level keys are limited to what oxlint's own parser
 * accepts (see `ALLOWED_TOP_LEVEL_KEYS` in that script); do not add ad hoc keys to that file.
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

// ── Plugin export ───────────────────────────────────────────────────────────────────────────────

export default {
  meta: { name: 'basalt' },
  rules: {
    'no-raw-font-size': noRawFontSize,
    'card-inset': cardInset,
    'chart-in-raw-surface': chartInRawSurface,
    'raw-scroll-container': rawScrollContainer,
  },
}
