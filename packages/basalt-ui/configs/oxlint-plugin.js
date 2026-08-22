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
 * ── The two agent-chat guard rules (`agent-resume-guard` / `agent-no-raw-usechat`) + `ai-sdk-major` ──
 * These are also correctness/architecture boundaries, not design guidance, so they do NOT honour
 * `theme-allow`. All three instead honour their own line-comment escape, `basalt-agent-allow`
 * (`hasAgentAllow`, a copy of `hasThemeAllow` with a different needle) — deliberately a separate
 * token, so a color exemption can never double as a license to switch off a streaming guard or an
 * intentional `ai` major skew. `ai-sdk-major`'s escape is line-level and per-import, distinct from
 * `basalt.aiMajorSkewReason` — the repo-wide, mandatory-reason config exemption for the SAME skew
 * read by `doctor`'s `ai-major-parity` check (`src/cli/index.ts`): a lint run only ever sees one
 * file, so there's no reason string to echo here, just a marker on the import that intentionally
 * crosses the declared skew. `ai-sdk-major` is the one rule in this file that touches the
 * filesystem (reads ancestor `package.json`s, memoized per directory so a lint run does one walk
 * per directory, not per file) — every other rule here is pure AST + filename-string matching.
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
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'

// ── Shared helpers ──────────────────────────────────────────────────────────────────────────────

/**
 * Rule ids a `theme-allow` may name — this plugin's own rules plus `src/guard`'s kinds. Duplicated
 * by hand for the same reason `majorOf` is: this file loads standalone out of a consumer's
 * node_modules and must not import from the package.
 *
 * Exported, and `oxlint-plugin.test.ts` asserts it is EXACTLY the plugin's own rule ids plus
 * `GUARD_RULES`'s keys. Forgetting an entry here is not a cosmetic omission — an id this set does
 * not know is treated as a typo, so the annotation naming it waives nothing (see
 * {@link parseThemeAllow}); before the fail-closed change it was worse still, silently widening to
 * a blanket waiver.
 */
export const KNOWN_RULE_IDS = new Set([
  // this plugin
  'no-raw-font-size',
  'raw-size-literal',
  'card-inset',
  'chart-in-raw-surface',
  'hand-rolled-plot',
  'chart-legend-literal',
  'hand-rolled-shell',
  'shadow-basalt-export',
  'raw-scroll-container',
  'visx-boundary',
  'visx-tooltip',
  'token-layer-boundary',
  // These three honour `basalt-agent-allow`, never `theme-allow` — but they are real ids, so an
  // annotation naming one must parse as a (useless) scoped annotation rather than as prose.
  'agent-resume-guard',
  'agent-no-raw-usechat',
  'ai-sdk-major',
  // src/guard kinds
  'raw-hex',
  'raw-color-fn',
  'localstorage-theme',
  'off-identity-accent',
  'mantine-shade-index',
  'raw-spacing',
  'raw-radius',
  'raw-surface',
  'card-with-border',
  'off-system-surface-var',
  'raw-html-layout',
  'inline-spacing',
  'inline-display',
  'raw-visx-axis',
  'raw-motion-value',
  'unframed-chart',
  'chart-missing-aria-label',
  'raw-form-control',
  'sub-16-input-font',
  'raw-font-family',
  'theme-allow-unscoped',
  'surface-shadow-override',
  'css-raw-surface',
  'inline-font-size',
  'hidden-inline-style',
])

const ALLOW_RULE_TOKEN = /^(?:basalt\/)?([a-z][a-z0-9-]*)(?=$|[\s,:—–])/
const ALLOW_REASON_SEPARATOR = /^(?:—|–|-{1,2}|:)\s*/
/** Shortest string accepted as a written reason — enough to exclude a stray separator. */
const MIN_ALLOW_REASON_LENGTH = 4

/**
 * Parse one comment's `theme-allow` annotation, or `null` when it carries none.
 *
 * `{ rules: [], unknownRules: [] }` is the legacy bare form and covers every rule; a non-empty
 * `rules` scopes the exception to exactly those ids. A word that occupies the id slot but names no
 * known rule lands in `unknownRules` and FAILS CLOSED — the annotation then waives only the ids it
 * got right, never everything. `theme-allow raw-hexx — reason` used to consume no id, fall through
 * to the empty-`rules` branch and be read as the blanket form, so one mistyped character escalated
 * a scoped waiver into a whole-line one, i.e. weaker than before the scoping existed.
 *
 * A prose reason is therefore introduced with a separator (`—`, `–`, `-`, `:`), which is how every
 * annotation in the wild already writes it. Mirrors `parseAllowAnnotation` in `src/guard/index.ts`.
 *
 * The id slot closes at the first space that no comma opened: the first word is always a claimed
 * id (that is where a typo lands), but after a resolved id only a `,` keeps the list open, so
 * `theme-allow raw-surface sub-scale legend corner` reads `sub-scale` as prose rather than as a
 * typo. See the guard's copy for the full reasoning.
 */
function parseThemeAllow(commentValue) {
  const at = commentValue.indexOf('theme-allow')
  if (at === -1) return null
  let remainder = commentValue.slice(at + 'theme-allow'.length).replace(/^[\s,]+/, '')
  const rules = []
  const unknownRules = []
  let inIdSlot = true
  for (;;) {
    const token = ALLOW_RULE_TOKEN.exec(remainder)
    if (token === null) break
    if (!KNOWN_RULE_IDS.has(token[1])) {
      if (inIdSlot) unknownRules.push(token[1])
      break
    }
    rules.push(token[1])
    const after = remainder.slice(token[0].length)
    remainder = after.replace(/^[\s,]+/, '')
    inIdSlot = /^\s*,/.test(after)
  }
  const reason = remainder.replace(ALLOW_REASON_SEPARATOR, '').trim()
  return { rules, unknownRules, hasReason: reason.length >= MIN_ALLOW_REASON_LENGTH }
}

/**
 * True when a `theme-allow` covering `ruleId` sits on `node`'s own source line or the line above.
 *
 * The `ruleId` argument is what stops one exemption from being a blanket one: a `theme-allow
 * raw-hex — …` written for a color no longer silently switches off `card-inset` on the same line.
 * Only a BARE `theme-allow` still covers everything — that is the shape every existing consumer
 * has, and `src/guard`'s `theme-allow-unscoped` is the (warning) nudge off it, not a hard break.
 * An annotation that reached for an id and missed covers only the ids it got right.
 */
function hasThemeAllow(context, node, ruleId) {
  const sourceCode = context.sourceCode ?? context.getSourceCode?.()
  const comments = sourceCode?.getAllComments?.() ?? []
  const nodeLine = node.loc.start.line
  return comments.some((comment) => {
    if (comment.loc.end.line !== nodeLine && comment.loc.end.line !== nodeLine - 1) return false
    const allow = parseThemeAllow(comment.value)
    if (allow === null) return false
    if (allow.rules.includes(ruleId)) return true
    return allow.rules.length === 0 && allow.unknownRules.length === 0
  })
}

/**
 * True when the FILE carries a written declaration for `ruleId` — a `theme-allow` that both names
 * the rule and gives a reason, anywhere in the file.
 *
 * This is what a file-scoped exception costs now. `hand-rolled-plot` used to grant a whole file
 * permanent immunity off any `theme-allow` that happened to sit on its first assembly node — a
 * 604-line chart file went unpoliced forever, and a comment written about a colour disabled the
 * chart rule as a side effect. Splitting the two placements apart is the fix: a bare or unrelated
 * comment waives ONE node, a named-with-a-reason comment declares the whole file.
 */
function hasFileDeclaration(context, ruleId) {
  const sourceCode = context.sourceCode ?? context.getSourceCode?.()
  const comments = sourceCode?.getAllComments?.() ?? []
  return comments.some((comment) => {
    const allow = parseThemeAllow(comment.value)
    return allow !== null && allow.hasReason && allow.rules.includes(ruleId)
  })
}

/** Test/spec files — design guidance does not apply to a fixture. Mirrors `src/cli`'s own SKIP. */
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|[\\/])__tests__[\\/]/

function isTestFile(context) {
  return TEST_FILE.test(getFilename(context))
}

/**
 * True when a `basalt-agent-allow` line comment sits on `node`'s own source line or the line above
 * it. A copy of `hasThemeAllow` with a different needle — deliberately NOT the same token, so a
 * color exemption can never double as a license to switch off a streaming guard (see the file-header
 * comment for the two agent-chat rules).
 */
function hasAgentAllow(context, node) {
  const sourceCode = context.sourceCode ?? context.getSourceCode?.()
  const comments = sourceCode?.getAllComments?.() ?? []
  const nodeLine = node.loc.start.line
  return comments.some(
    (comment) =>
      comment.value.includes('basalt-agent-allow') &&
      (comment.loc.end.line === nodeLine || comment.loc.end.line === nodeLine - 1),
  )
}

function getFilename(context) {
  return context.filename ?? context.getFilename?.() ?? ''
}

function isNumericLiteral(node) {
  return node !== null && node.type === 'Literal' && typeof node.value === 'number'
}

/**
 * An absolute CSS length written as a STRING — `'10px'`, `"1.5rem"`, `'0.75em'`.
 *
 * Mantine's `size` / `fz` props accept a scale token (`"xs"`…`"xl"`) OR any CSS length, and the
 * second form is the one that leaves the token system. A string is not a numeric literal, so every
 * `size="10px"` in an app slipped past the numeric-only check these two rules used to be.
 *
 * `em`/relative ratios are included on `size` (a `2em` icon is still an off-scale dimension) but
 * the message names the right escape for each rule, so the two are not merged into one check.
 */
const CSS_LENGTH_STRING = /^-?\d*\.?\d+(?:px|rem|em)$/

function isCssLengthString(node) {
  return (
    node !== null &&
    node.type === 'Literal' &&
    typeof node.value === 'string' &&
    CSS_LENGTH_STRING.test(node.value.trim())
  )
}

/** Unwraps a JSXExpressionContainer to its inner expression; passes any other node through. */
function unwrapExpressionContainer(node) {
  return node !== null && node.type === 'JSXExpressionContainer' ? node.expression : node
}

// ── Rule 1 — no-raw-font-size ───────────────────────────────────────────────────────────────────

const NO_RAW_FONT_SIZE_MESSAGE =
  'Raw font-size literal — route through VX.text.* (numbers) or --vx-text-* (CSS); em/relative ' +
  'ratios are allowed. (basalt/no-raw-font-size)'

/** JSX attributes whose value IS a style object — the only object literals this rule reaches into. */
const STYLE_ATTRS = new Set(['style', 'styles', 'sx'])
/** A binding or key whose name says the object is styling — `wrapperStyle`, `styles`, `rowStyles`. */
const STYLE_NAME = /styles?$/i
/** How far up the tree the style-context walk goes before giving up. */
const STYLE_CONTEXT_MAX_DEPTH = 12

/**
 * Is this object property part of a STYLE object?
 *
 * `fontSize` is not a reserved word. The rule used to report every object property spelled that
 * way, which fired on an Obsidian `data.json` fixture — `{ settings: { fontSize: 16 } }` inside a
 * string, in a package with no React and no Mantine — where the "route it through VX.text.*" advice
 * is not merely unhelpful, it is about a different domain. Requiring a style context (a
 * `style`/`styles`/`sx` JSX attribute, a `…Style(s)` binding or key, or a `CSSProperties`
 * annotation) keeps every shape that is really styling and drops the ones that never reach CSS.
 */
function isInStyleContext(context, node) {
  const sourceCode = context.sourceCode ?? context.getSourceCode?.()
  let current = node.parent
  for (let depth = 0; current !== undefined && current !== null; depth++) {
    if (depth > STYLE_CONTEXT_MAX_DEPTH) return false
    if (current.type === 'JSXAttribute') return STYLE_ATTRS.has(current.name?.name)
    if (current.type === 'Property') {
      const key = current.key
      const name = key?.type === 'Identifier' ? key.name : key?.value
      if (typeof name === 'string' && STYLE_NAME.test(name)) return true
    }
    if (current.type === 'VariableDeclarator') {
      const id = current.id
      if (typeof id?.name === 'string' && STYLE_NAME.test(id.name)) return true
      const annotation = id?.typeAnnotation
      return (
        annotation !== undefined &&
        annotation !== null &&
        (sourceCode?.getText?.(annotation) ?? '').includes('CSSProperties')
      )
    }
    if (current.type === 'FunctionDeclaration' || current.type === 'Program') return false
    current = current.parent
  }
  return false
}

const noRawFontSize = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow hardcoded numeric font sizes outside the token system.',
    },
    schema: [],
  },
  create(context) {
    if (getFilename(context).includes('/src/tokens/') || isTestFile(context)) return {}

    return {
      JSXAttribute(node) {
        const name = node.name?.name
        if (name !== 'fz' && name !== 'fontSize') return
        const value = unwrapExpressionContainer(node.value)
        if (!isNumericLiteral(value)) return
        if (hasThemeAllow(context, node, 'no-raw-font-size')) return
        context.report({ node, message: NO_RAW_FONT_SIZE_MESSAGE })
      },
      Property(node) {
        const key = node.key
        const isFontSizeKey =
          (key.type === 'Identifier' && key.name === 'fontSize') ||
          (key.type === 'Literal' && key.value === 'fontSize')
        if (!isFontSizeKey) return
        if (!isNumericLiteral(node.value)) return
        if (!isInStyleContext(context, node)) return
        if (hasThemeAllow(context, node, 'no-raw-font-size')) return
        context.report({ node, message: NO_RAW_FONT_SIZE_MESSAGE })
      },
    }
  },
}

// ── Rule 2 — raw-size-literal ───────────────────────────────────────────────────────────────────

const RAW_SIZE_LITERAL_MESSAGE =
  'Raw CSS length on a size prop — use the scale ("xs".."xl"), or fz={VX.text.*} when the type ' +
  'scale has no step for it. (basalt/raw-size-literal)'

/** The size-ish JSX props a CSS-length string can leave the token system through. */
const SIZE_ATTRS = new Set(['size', 'fz', 'fontSize'])

/**
 * A CSS length written as a STRING on a size prop — `<Text size="10px">`, `<ThemeIcon size="2rem">`,
 * `<Text fz="0.8rem">`. This is the hole `no-raw-font-size` left open: it only ever tested for a
 * NUMERIC literal, so every string form walked straight past it.
 *
 * Its own rule id rather than a widening of `no-raw-font-size`, for two reasons. It covers `size`,
 * which is not always a font size — on `Text` it is, on `ThemeIcon`/`ActionIcon` it is a box
 * dimension — so one shared id would mean a consumer silencing the icon case also silences every
 * off-scale font size, the bundled-rule mistake the three boundary rules were split apart to avoid.
 * And a separate id can carry its own severity: this rule ships `warn` in the consumer preset for
 * one minor (the grace-minor doctrine in the package CLAUDE.md — it rejects code that previously
 * passed, and majors are banned here, so a consumer has no semver channel warning them). Widening
 * `no-raw-font-size` in place would have promoted it to `error` on upgrade with no such runway.
 *
 * Numeric `size={32}` is deliberately NOT flagged. It is the documented Mantine idiom for icon
 * dimensions and flagging it would fire on nearly every icon in an app for no design-system gain —
 * the token system has an opinion about type scale and spacing, not about how many pixels wide one
 * glyph box is.
 */
const rawSizeLiteral = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow raw CSS-length strings on size/fz/fontSize props.',
    },
    schema: [],
  },
  create(context) {
    if (getFilename(context).includes('/src/tokens/')) return {}

    return {
      JSXAttribute(node) {
        const name = node.name?.name
        if (typeof name !== 'string' || !SIZE_ATTRS.has(name)) return
        const value = unwrapExpressionContainer(node.value)
        if (!isCssLengthString(value)) return
        if (hasThemeAllow(context, node, 'raw-size-literal')) return
        context.report({ node, message: RAW_SIZE_LITERAL_MESSAGE })
      },
    }
  },
}

// ── Rule 3 — card-inset ─────────────────────────────────────────────────────────────────────────

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
          if (hasThemeAllow(context, attr, 'card-inset')) continue
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
        if (hasThemeAllow(context, node, 'chart-in-raw-surface')) return
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
 * Reports a `style` object property that turns a node into its own scroll container. Whether a raw
 * scroll box is wrong depends on who owns the scroll node, which no AST check can see — so the
 * `theme-allow` comment is a first-class part of the rule, not an escape valve for exceptional
 * cases: a component that legitimately owns its scroll node (`BasaltStickToBottom`,
 * `BasaltVirtualList`, `ThreadTranscript`'s virtualized pane) declares that ownership with the
 * comment and moves on. Severity went `off` → `warn` (1.12.0) → `error` (1.13.0) once every live
 * site in the repo carried that declaration; the opt-out mechanism is identical at either level.
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
        if (hasThemeAllow(context, node, 'raw-scroll-container')) return
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

// ── Rule 8 — agent-resume-guard ─────────────────────────────────────────────────────────────────

const AGENT_RESUME_GUARD_MESSAGE =
  'Unguarded stream resume — useAgentThreadRuns owns single-consumer discipline and ' +
  'StrictMode-safe reconnection; a raw resume re-fires on every effect re-run (vercel/ai#7891, no ' +
  "merged fix). Mark the line 'basalt-agent-allow' if you own the guard. (basalt/agent-resume-guard)"

/** True for `resumeStream()` and `<anything>.resumeStream()` call expressions. */
function isResumeStreamCall(callee) {
  if (callee.type === 'Identifier') return callee.name === 'resumeStream'
  return (
    callee.type === 'MemberExpression' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'resumeStream'
  )
}

/** The `key` of an object Property as a string, covering both Identifier and Literal keys. */
function propertyKeyName(node) {
  const key = node.key
  if (key.type === 'Identifier') return key.name
  if (key.type === 'Literal') return key.value
  return undefined
}

// Deliberately NO `hasThemeAllow` escape — see basalt/visx-boundary's comment for why these
// guards use their own token (`basalt-agent-allow`, see the file-header comment) instead.
const agentResumeGuard = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow unguarded useChat({ resume: true }) / resumeStream() calls outside useAgentThreadRuns.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee

        if (callee.type === 'Identifier' && callee.name === 'useChat') {
          const arg0 = node.arguments[0]
          if (arg0 === undefined || arg0.type !== 'ObjectExpression') return
          for (const prop of arg0.properties) {
            if (prop.type !== 'Property') continue
            if (propertyKeyName(prop) !== 'resume') continue
            if (prop.value.type !== 'Literal' || prop.value.value !== true) continue
            if (hasAgentAllow(context, prop)) continue
            context.report({ node: prop, message: AGENT_RESUME_GUARD_MESSAGE })
          }
          return
        }

        if (!isResumeStreamCall(callee)) return
        if (hasAgentAllow(context, node)) return
        context.report({ node, message: AGENT_RESUME_GUARD_MESSAGE })
      },
    }
  },
}

// ── Rule 9 — agent-no-raw-usechat ───────────────────────────────────────────────────────────────

const AGENT_NO_RAW_USECHAT_MESSAGE =
  'Raw @ai-sdk/react useChat — use useAgentStream / useAgentThreadRuns over aiSdkTransport ' +
  "(unmount abort, supersede guards, single-consumer resume). Mark the line 'basalt-agent-allow' to " +
  'opt out. (basalt/agent-no-raw-usechat)'

const RAW_USE_CHAT_SOURCES = new Set(['@ai-sdk/react', 'ai/react'])
const RAW_USE_CHAT_NAMES = new Set(['useChat', 'useCompletion'])

// Deliberately NO `hasThemeAllow` escape — see the file-header comment.
const agentNoRawUseChat = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow importing useChat/useCompletion directly from @ai-sdk/react or ai/react.',
    },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source?.value
        if (typeof source !== 'string' || !RAW_USE_CHAT_SOURCES.has(source)) return
        // A whole `import type { … } from '…'` is erased at compile time — nothing to guard.
        if (node.importKind === 'type') return

        for (const specifier of node.specifiers) {
          if (specifier.type !== 'ImportSpecifier') continue
          // `import { type useChat } from '…'` — the individual specifier is type-only.
          if (specifier.importKind === 'type') continue
          const imported = specifier.imported
          const importedName = imported.type === 'Identifier' ? imported.name : imported.value
          if (typeof importedName !== 'string' || !RAW_USE_CHAT_NAMES.has(importedName)) continue
          if (hasAgentAllow(context, specifier)) continue
          context.report({ node: specifier, message: AGENT_NO_RAW_USECHAT_MESSAGE })
        }
      },
    }
  },
}

// ── Rule 10 — ai-sdk-major ──────────────────────────────────────────────────────────────────────

/**
 * First run of digits in a semver range string (`^7.0.15` → `7`), or null if there is none.
 *
 * Duplicated verbatim in `src/cli/index.ts` — kept separate deliberately: this file must stay
 * import-free from the package (it loads via `jsPlugins` out of a consumer's node_modules), so it
 * cannot import the CLI's copy. Keep both copies in sync by hand; a future parsing fix (pre-release
 * suffixes, say) must land in both.
 */
function majorOf(range) {
  if (typeof range !== 'string') return null
  const match = range.match(/\d+/)
  return match === null ? null : Number(match[0])
}

/**
 * `ai`'s declared major off one parsed package.json, checked in ONE fixed order shared by every
 * reader in this file (basalt's own major below, and the linted file's nearest package.json in
 * `aiMajorAtPackageJson`) — `dependencies` → `devDependencies` → `peerDependencies`. Chosen
 * deliberately: `dependencies` is what actually gets installed and resolved at runtime, so it wins
 * over a `devDependencies` pin (test-only) or a `peerDependencies` range (a floor, not a pin). Two
 * readers disagreeing on this order is exactly the kind of skew this rule exists to catch — see
 * `cli/index.ts`'s `aiMajorAt`, which uses the same order for doctor's cross-package walk.
 */
function aiMajorFromPkg(pkg) {
  return majorOf(pkg.dependencies?.ai ?? pkg.devDependencies?.ai ?? pkg.peerDependencies?.ai)
}

/**
 * basalt-ui's OWN declared `ai` peer major, read once at module load from the package.json
 * sitting next to this file's `configs/` directory — `../package.json` relative to this module,
 * which resolves to `packages/basalt-ui/package.json` repo-locally AND to
 * `node_modules/basalt-ui/package.json` when this file runs from a consumer's installed copy
 * (`configs/oxlint-plugin.js` is one directory below the package root in both places). `null` when
 * unreadable or undeclared — the rule then has nothing to compare against and stays silent.
 */
const PLUGIN_DIR = dirname(fileURLToPath(import.meta.url))
const BASALT_AI_MAJOR = (() => {
  try {
    const pkg = JSON.parse(readFileSync(resolvePath(PLUGIN_DIR, '..', 'package.json'), 'utf8'))
    // Peer-first, unlike aiMajorFromPkg's dependencies-first order: `ai` is an optional PEER of
    // basalt-ui, never its runtime dependency, so the "dependencies wins because runtime" rationale
    // above does not apply to this self-read — a devDependencies test pin must not masquerade as
    // the declared peer major.
    return majorOf(pkg.peerDependencies?.ai ?? pkg.devDependencies?.ai ?? pkg.dependencies?.ai)
  } catch {
    return null
  }
})()

// One JSON.parse per package.json path, and one directory-walk result per starting directory — so
// a lint run over N files in the same package does one filesystem walk total, not N.
const packageJsonMajorCache = new Map()
const nearestAiMajorCache = new Map()

function aiMajorAtPackageJson(pkgPath) {
  if (packageJsonMajorCache.has(pkgPath)) return packageJsonMajorCache.get(pkgPath)
  let major = null
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    major = aiMajorFromPkg(pkg)
  } catch {
    major = null
  }
  packageJsonMajorCache.set(pkgPath, major)
  return major
}

/** Walks up from `startDir` to the nearest ancestor `package.json`'s declared `ai` major. */
function nearestAiMajor(startDir) {
  if (nearestAiMajorCache.has(startDir)) return nearestAiMajorCache.get(startDir)

  const visited = []
  let dir = startDir
  let result = null
  for (;;) {
    if (nearestAiMajorCache.has(dir)) {
      result = nearestAiMajorCache.get(dir)
      break
    }
    visited.push(dir)
    const pkgPath = resolvePath(dir, 'package.json')
    if (existsSync(pkgPath)) {
      result = aiMajorAtPackageJson(pkgPath)
      break
    }
    const parent = dirname(dir)
    if (parent === dir) break // filesystem root — no package.json found
    dir = parent
  }
  for (const d of visited) nearestAiMajorCache.set(d, result)
  return result
}

// One parsed manifest per path — the scope walk below re-reads the same ancestors for every file.
const packageJsonCache = new Map()

function readPackageJson(pkgPath) {
  if (packageJsonCache.has(pkgPath)) return packageJsonCache.get(pkgPath)
  let pkg = null
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  } catch {
    pkg = null
  }
  packageJsonCache.set(pkgPath, pkg)
  return pkg
}

/**
 * Is this file inside a package that actually consumes basalt-ui?
 *
 * Without this the rule compared EVERY package's `ai` major against basalt's own peer major, and
 * fired three errors in an rb workspace package (`apps/api`) that has no basalt-ui dependency, is
 * outside `basalt.roots`, and pins `ai@6` deliberately. `doctor`'s `ai-major-parity` scopes the same
 * concern correctly — two shipped enforcement surfaces disagreeing about one fact leaves a consumer
 * unable to tell which is right, which is worse than either being wrong.
 *
 * In scope when an ancestor package.json either depends on `basalt-ui`, or declares `basalt.roots`
 * that the file sits under. A declared `basalt.roots` that the file is NOT under is a positive
 * statement that this code is not basalt's — the walk stops there rather than continuing up to a
 * workspace root that happens to carry the dependency.
 */
function isBasaltScopedFile(filename) {
  let dir = dirname(filename)
  for (;;) {
    const pkg = readPackageJson(resolvePath(dir, 'package.json'))
    if (pkg !== null) {
      const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies }
      if (deps['basalt-ui'] !== undefined) return true
      const roots = pkg.basalt?.roots
      if (Array.isArray(roots) && roots.length > 0) {
        return roots.some((root) => filename.startsWith(`${resolvePath(dir, root)}/`))
      }
    }
    const parent = dirname(dir)
    if (parent === dir) return false
    dir = parent
  }
}

function aiSdkMajorMessage(consumerMajor) {
  return (
    `This file's nearest package.json declares ai@${consumerMajor}, but basalt-ui declares the ` +
    `ai@${BASALT_AI_MAJOR} peer major — a producer/consumer pair on different ai majors can throw ` +
    "'Unknown chunk type' at runtime (argo defect 1: apps/api on ai@5 vs apps/dashboard on ai@7). " +
    '(basalt/ai-sdk-major)'
  )
}

// Honours `basalt-agent-allow` (NOT `theme-allow`) like its two agent-chat siblings above — a
// version skew is still a fact about two package.json files, but a written, intentional
// producer/consumer pair (see `doctor`'s `aiMajorSkewReason`) needs a way to say so at the import
// site too, not just be permanently blocked.
const aiSdkMajor = {
  meta: {
    type: 'problem',
    docs: {
      description:
        "Disallow importing 'ai'/'@ai-sdk/*' from a package whose declared ai major differs from basalt-ui's.",
    },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (BASALT_AI_MAJOR === null) return
        const source = node.source?.value
        if (typeof source !== 'string') return
        if (source !== 'ai' && !source.startsWith('@ai-sdk/')) return

        const filename = getFilename(context)
        if (filename.length === 0) return
        if (!isBasaltScopedFile(filename)) return
        const consumerMajor = nearestAiMajor(dirname(filename))
        if (consumerMajor === null) return // no `ai` in the nearest package.json — nothing to compare
        if (consumerMajor === BASALT_AI_MAJOR) return
        if (hasAgentAllow(context, node)) return

        context.report({ node, message: aiSdkMajorMessage(consumerMajor) })
      },
    }
  },
}

// ── Rule 12 — hand-rolled-plot ───────────────────────────────────────────────────────────────────

/**
 * The primitives `CartesianChart` assembles. Rendering one of these directly means the file is
 * re-implementing the plot assembly — margins, scales, axes, cursor, crosshair, tooltip — that the
 * primitive owns for every other chart, which is exactly how charts drift apart from each other.
 */
const PLOT_ASSEMBLY_TAGS = new Set([
  'AxisLeftNumeric',
  'AxisRightNumeric',
  'AxisBottomDate',
  'HoverOverlay',
  'Crosshair',
])

/**
 * KNOWN LIMIT, deliberately not closed: a chart drawn out of DOM instead of the chart layer is
 * structurally invisible here.
 *
 * argo has two — a 3×3 Mantine `SimpleGrid` matrix and absolutely-positioned `Box` bullet bars —
 * that import only `ChartCard` and `VX`, render no basalt primitive, and therefore cannot trip any
 * tag-name check. The candidate widenings all fail on false positives in a rule that SHIPS to
 * consumers: adding `ChartTooltipFloat`/`useChartSize` to this set flags `Donut` and `Heatmap`,
 * which compose them legitimately; "renders `ChartCard` and a raw `<svg>`" flags an inline icon in
 * a card header. Detecting "this Box grid is a chart" needs intent, not syntax. Naming the gap here
 * is the honest answer — a noisy rule gets switched off, and then it guards nothing at all.
 */

/**
 * Composing this means the file is USING the chart system rather than re-implementing it.
 * `ChartFrame` deliberately does NOT count: composing the frame directly and then hand-assembling
 * axes and a cursor on top of it IS the drift this rule exists to catch. A genuinely non-single-
 * plot shape does exactly that — and declares it with a `theme-allow` comment, so the exception is
 * a decision someone wrote down rather than a default anyone can fall into.
 */
const PLOT_OWNER_TAGS = new Set(['CartesianChart'])

/**
 * Import sources that make a JSX tag one of BASALT's chart primitives rather than a component the
 * consumer happens to have named `Crosshair`. Matching bare tag names would false-positive on any
 * app with its own overlay component — and this rule ships to consumers, so that matters.
 */
const CHART_IMPORT_SOURCE = /(^|\/)basalt-ui\/charts|(^|\/)charts(\/|$)|(^|\.\.\/)primitives\//

/** Local names imported from a basalt charts entry — the only tags either chart rule considers. */
function collectChartImports(node, into) {
  if (!CHART_IMPORT_SOURCE.test(node.source?.value ?? '')) return
  for (const spec of node.specifiers ?? []) {
    if (spec.local?.name !== undefined) into.add(spec.local.name)
  }
}

const HAND_ROLLED_PLOT_MESSAGE =
  'Chart assembly primitive rendered without composing CartesianChart — that primitive already ' +
  'owns the measured margins, both y scales, the axes, grid, shared cursor, crosshair and ' +
  'tooltip. Hand-assembling them is how two charts stop matching. Compose CartesianChart and ' +
  'render only marks. A genuinely non-single-plot shape (multi-pane, radial, matrix) composes ' +
  'ChartFrame instead — add a theme-allow comment to declare that. (basalt/hand-rolled-plot)'

const handRolledPlot = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow assembling a cartesian plot by hand instead of composing CartesianChart.',
    },
    schema: [],
  },
  create(context) {
    if (isTestFile(context)) return {}
    // File-scoped, not node-scoped: the verdict depends on whether a plot OWNER appears anywhere
    // in the file, which is only known once the whole file has been walked.
    const assemblyNodes = []
    const chartImports = new Set()
    let ownsPlot = false
    let definesOwner = false

    // A rule that says "compose CartesianChart" cannot fire inside the module that DEFINES
    // CartesianChart — that file is the assembly. Detected by declaration rather than by path so
    // it stays honest: this is definitional, not basalt exempting itself for convenience (the
    // self-exemption habit is what let the 1.4.0 regression reach consumers — see docs/STATUS.md).
    const notesOwnerDefinition = (name) => {
      if (name === 'CartesianChart') definesOwner = true
    }

    return {
      ImportDeclaration(node) {
        collectChartImports(node, chartImports)
      },
      FunctionDeclaration(node) {
        notesOwnerDefinition(node.id?.name)
      },
      VariableDeclarator(node) {
        notesOwnerDefinition(node.id?.name)
      },
      JSXOpeningElement(node) {
        const tagName = node.name?.name
        if (PLOT_OWNER_TAGS.has(tagName)) ownsPlot = true
        else if (PLOT_ASSEMBLY_TAGS.has(tagName)) assemblyNodes.push(node)
      },
      'Program:exit'() {
        if (ownsPlot || definesOwner) return
        // The CHECK stays file-scoped — forced by the shape of the correct pattern:
        // `<CartesianChart>{() => <AxisLeftNumeric …/>}</CartesianChart>` puts the axis inside a
        // render-prop arrow, a different function from the component that owns the chart, so
        // component scope would flag the canonical usage.
        //
        // The SUPPRESSION no longer is. Reporting only the first node and testing the waiver there
        // meant one comment — any comment, about anything — bought a whole file permanent immunity:
        // every axis, overlay and crosshair added to that file afterwards went unreported forever
        // (linewatch: three files, one 604 lines). Now every assembly node is reported and waived on
        // its own, EXCEPT when the file carries a written declaration — a `theme-allow` that names
        // `basalt/hand-rolled-plot` and gives a reason. That is the shape a genuinely non-single-plot
        // kind already uses (`DualPanel`), and it is the difference between a line waiver and a
        // decision about the file.
        const nodes = assemblyNodes.filter((node) => chartImports.has(node.name?.name))
        if (nodes.length === 0) return
        if (hasFileDeclaration(context, 'hand-rolled-plot')) return
        for (const node of nodes) {
          if (hasThemeAllow(context, node, 'hand-rolled-plot')) continue
          context.report({ node, message: HAND_ROLLED_PLOT_MESSAGE })
        }
      },
    }
  },
}

// ── Rule 13 — chart-legend-literal ───────────────────────────────────────────────────────────────

const CHART_LEGEND_LITERAL_MESSAGE =
  'Hand-authored ChartLegend items — the legend must be DERIVED from the same `series` array the ' +
  'chart draws (deriveLegend, or just let ChartFrame/CartesianChart do it). A hand-written list ' +
  'is a second source of truth that silently goes stale: it keeps naming a series after the plot ' +
  'stops drawing it. (basalt/chart-legend-literal)'

/**
 * Does this expression derive from the chart's own `series`?
 *
 * The contract is derivation from `series` — not derivation from *an* array. `items={refLines.map(
 * (r) => ({ key, label, color, shape }))}` and `items={PACE_ZONES.map(…)}` are hand-authored
 * legends by any reading: every field is written at the call site, and the list can name a band the
 * plot no longer draws exactly like a `[...]` literal can. Walks the base of a member/call chain so
 * `visibleSeries.filter(…).map(…)` and `deriveLegend(series)` both read as derived.
 */
function derivesFromSeries(node, depth = 0) {
  if (node === null || node === undefined || depth > 8) return false
  if (node.type === 'Identifier') return /series$/i.test(node.name ?? '')
  if (node.type === 'MemberExpression') {
    return derivesFromSeries(node.object, depth + 1) || derivesFromSeries(node.property, depth + 1)
  }
  if (node.type === 'CallExpression') {
    if (node.callee?.type === 'Identifier' && node.callee.name === 'deriveLegend') return true
    return (
      derivesFromSeries(node.callee, depth + 1) ||
      (node.arguments ?? []).some((arg) => derivesFromSeries(arg, depth + 1))
    )
  }
  return false
}

/** `X.map(…)` — the derivation-shaped form that is only derivation when `X` is the series. */
function isMapCall(node) {
  return (
    node?.type === 'CallExpression' &&
    node.callee?.type === 'MemberExpression' &&
    node.callee.property?.name === 'map'
  )
}

const chartLegendLiteral = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Require ChartLegend items to be derived from the series descriptor.' },
    schema: [],
  },
  create(context) {
    if (isTestFile(context)) return {}
    const chartImports = new Set()

    return {
      ImportDeclaration(node) {
        collectChartImports(node, chartImports)
      },
      JSXOpeningElement(node) {
        if (node.name?.name !== 'ChartLegend' || !chartImports.has('ChartLegend')) return
        const items = node.attributes?.find(
          (attr) => attr.type === 'JSXAttribute' && attr.name?.name === 'items',
        )
        const expression = items?.value?.expression
        // The `.map()` half — a list built by mapping over something that is NOT the series. See
        // `derivesFromSeries`. Reported under the same id as the array-literal half because it is
        // the same defect (a second source of truth for the legend), just written as a call.
        if (isMapCall(expression) && !derivesFromSeries(expression.callee?.object)) {
          if (hasThemeAllow(context, node, 'chart-legend-literal')) return
          context.report({ node, message: CHART_LEGEND_LITERAL_MESSAGE })
          return
        }
        if (expression?.type !== 'ArrayExpression') return
        // Only a list that is ENTIRELY object literals is a hand-authored legend. An array that
        // spreads or calls something (`[...deriveLegend(series), note]`) is derived-and-extended,
        // which is legitimate — flagging it would push people to disable the rule.
        //
        // Known and accepted gap: hoisting the literal to a `const` one line up
        // (`const items = [...]; <ChartLegend items={items} />`) reads as an Identifier here and
        // is not flagged. Following that would mean local flow analysis for a bypass nobody
        // reaches by accident; the rule targets the shape people actually write.
        const allObjectLiterals =
          expression.elements.length > 0 &&
          expression.elements.every((el) => el?.type === 'ObjectExpression')
        if (!allObjectLiterals) return
        if (hasThemeAllow(context, node, 'chart-legend-literal')) return
        context.report({ node, message: CHART_LEGEND_LITERAL_MESSAGE })
      },
    }
  },
}

// ── Rule 14 — shadow-basalt-export ───────────────────────────────────────────────────────────────

/** The package root — one directory above `configs/`, repo-locally AND inside node_modules. */
const PACKAGE_ROOT = resolvePath(PLUGIN_DIR, '..')

/**
 * A component-shaped name: starts uppercase and carries a lowercase letter, which excludes the
 * SCREAMING_CASE constants and the two-letter token namespaces in the same barrel.
 */
const COMPONENT_NAME = /^[A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9]*$/

/**
 * Every component-shaped VALUE export of the root barrel, read once at module load from
 * `../dist/index.d.ts` — the real barrel, not a hand-maintained list that would go stale the first
 * time an export was renamed. `type` specifiers are skipped: a local `StatCardProps` is a normal
 * thing to write, a local `StatCard` is not.
 *
 * Empty (rule silent) when `dist` is unreadable, exactly like `BASALT_AI_MAJOR` — a lint run must
 * not depend on a build having happened.
 */
const BASALT_ROOT_EXPORTS = (() => {
  const names = new Set()
  try {
    const text = readFileSync(resolvePath(PACKAGE_ROOT, 'dist', 'index.d.ts'), 'utf8')
    for (const block of text.matchAll(/export\s*\{([^}]*)\}/g)) {
      for (const raw of block[1].split(',')) {
        const part = raw.trim()
        if (part === '' || part.startsWith('type ')) continue
        const name = (part.split(/\s+as\s+/).pop() ?? '').trim()
        if (COMPONENT_NAME.test(name)) names.add(name)
      }
    }
  } catch {
    return names
  }
  return names
})()

function shadowBasaltExportMessage(name) {
  return (
    `Local component '${name}' collides with the basalt-ui export of the same name — import it ` +
    "from 'basalt-ui' instead of re-rolling it. This is the one signal a forked composite emits: " +
    'the palette guard can never see it, because a fork written by a token-fluent author uses ' +
    'exactly the right tokens and passes every other check. (basalt/shadow-basalt-export)'
  )
}

/**
 * Flags a local declaration whose name collides with a live basalt export.
 *
 * The cheapest possible detector for the whole absorption class: argo shipped its own `EmptyState`
 * (a full duplicate of the shipped one) and rb a local `StatCard`, and both passed `check-theme`,
 * `oxlint` and `doctor` clean — off-palette code fails, a forked component that uses the correct
 * tokens does not. `warn`, not `error`: a name collision is evidence, not proof, and a consumer
 * with a genuinely different `Composer` should be told once, not blocked.
 */
const shadowBasaltExport = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Warn on a local component whose name collides with a basalt-ui export.' },
    schema: [],
  },
  create(context) {
    const filename = getFilename(context)
    // basalt's own source DEFINES these names; a consumer's does not.
    if (BASALT_ROOT_EXPORTS.size === 0 || filename.startsWith(`${PACKAGE_ROOT}/`)) return {}
    if (isTestFile(context)) return {}

    const report = (node, name) => {
      if (typeof name !== 'string' || !BASALT_ROOT_EXPORTS.has(name)) return
      if (hasThemeAllow(context, node, 'shadow-basalt-export')) return
      context.report({ node, message: shadowBasaltExportMessage(name) })
    }

    return {
      FunctionDeclaration(node) {
        report(node, node.id?.name)
      },
      VariableDeclarator(node) {
        report(node, node.id?.name)
      },
      ClassDeclaration(node) {
        report(node, node.id?.name)
      },
    }
  },
}

// ── Rule 15 — hand-rolled-shell ──────────────────────────────────────────────────────────────────

/** Mantine parts that only ever appear when someone is assembling an application shell by hand. */
// `NavLink` is deliberately NOT here: Mantine's NavLink is a legitimate standalone list row, and a
// rule that fires on one inside a settings page would be switched off within a day. `Burger` and the
// `AppShell.*` parts have no use outside assembling a shell.
const SHELL_ASSEMBLY_TAGS = new Set(['Burger'])
const SHELL_ASSEMBLY_MEMBER_OBJECT = 'AppShell'

const HAND_ROLLED_SHELL_MESSAGE =
  'Application shell assembled by hand — AppShell parts / Burger / NavLink in a file that does not ' +
  'render BasaltShell. The shell is the framework: BasaltShell owns the sidebar, the mobile tab ' +
  'bar and its More sheet, breadcrumbs, the page header and the collapse state, all driven by ONE ' +
  'typed nav definition (defineNav + useNav). A hand-rolled AppShell + burger drawer is the exact ' +
  'layer the 1.19 nav contract replaces, and no palette guard can see it — it uses the right ' +
  'tokens. (basalt/hand-rolled-shell)'

/**
 * The `hand-rolled-plot` shape, one layer up. rb shipped 266 lines of `AppShell` + `NavLink` +
 * `Burger` + `useDisclosure` mobile drawer and every gate passed it green.
 *
 * File-scoped and reported once: which shell a file uses is one decision, so one comment settles
 * it. The module that DEFINES `BasaltShell` is exempt by declaration, not by path — a rule saying
 * "compose X" cannot fire inside X.
 */
const handRolledShell = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Disallow assembling an app shell by hand instead of using BasaltShell.' },
    schema: [],
  },
  create(context) {
    if (isTestFile(context)) return {}

    const assemblyNodes = []
    let mantineImported = false
    let ownsShell = false

    const notesOwnerDefinition = (name) => {
      if (name === 'BasaltShell') ownsShell = true
    }

    return {
      ImportDeclaration(node) {
        if ((node.source?.value ?? '').startsWith('@mantine/')) mantineImported = true
      },
      FunctionDeclaration(node) {
        notesOwnerDefinition(node.id?.name)
      },
      VariableDeclarator(node) {
        notesOwnerDefinition(node.id?.name)
      },
      JSXOpeningElement(node) {
        const name = node.name
        if (name?.type === 'JSXMemberExpression') {
          if (name.object?.name === SHELL_ASSEMBLY_MEMBER_OBJECT) assemblyNodes.push(node)
          return
        }
        if (name?.name === 'BasaltShell') ownsShell = true
        else if (SHELL_ASSEMBLY_TAGS.has(name?.name)) assemblyNodes.push(node)
      },
      'Program:exit'() {
        if (ownsShell || !mantineImported) return
        const [first] = assemblyNodes
        if (first === undefined) return
        if (hasThemeAllow(context, first, 'hand-rolled-shell')) return
        if (hasFileDeclaration(context, 'hand-rolled-shell')) return
        context.report({ node: first, message: HAND_ROLLED_SHELL_MESSAGE })
      },
    }
  },
}

// ── Grace ledger ────────────────────────────────────────────────────────────────────────────────

/**
 * Plugin rules still inside their grace minor — `warn` in the shipped consumer preset, `error`
 * repo-locally, with the promotion note as the value. This is the plugin's counterpart to
 * `src/guard`'s `GRACE_PERIOD_KINDS`, and it exists because its ABSENCE is what let three rules sit
 * at `warn` for up to twelve minors with nothing tracking them: `configs/oxlint.json` is generated
 * and its top-level keys are fixed by oxlint's own parser, so the ledger cannot live there.
 *
 * `oxlint-plugin.test.ts` asserts the two agree in both directions — a rule listed here must be
 * `warn` in the shipped preset, and one absent from here must be `error`. Deleting an entry IS the
 * promotion, and the test makes the config change mandatory in the same commit.
 */
export const PLUGIN_RULE_GRACE = {
  'hand-rolled-plot':
    'widened in the round-4 guard minor (suppression scoped to the node; a file-scoped waiver now ' +
    'needs a written declaration) — promote to error one minor later, once consumers have moved ' +
    'their bare `theme-allow` comments to the declaration form.',
  'chart-legend-literal':
    'widened in the round-4 guard minor (a `.map()` over a non-series array now counts) — promote ' +
    'to error one minor later, for the same reason as hand-rolled-plot above.',
  'shadow-basalt-export':
    'new in the round-4 guard minor — promote to error one minor later, if ever. A name collision ' +
    'is strong evidence and not proof; this may be a permanent warn.',
  'hand-rolled-shell': 'new in the round-4 guard minor — promote to error one minor later.',
}

// ── Plugin export ───────────────────────────────────────────────────────────────────────────────

export default {
  meta: { name: 'basalt' },
  rules: {
    'no-raw-font-size': noRawFontSize,
    'raw-size-literal': rawSizeLiteral,
    'card-inset': cardInset,
    'chart-in-raw-surface': chartInRawSurface,
    'hand-rolled-plot': handRolledPlot,
    'chart-legend-literal': chartLegendLiteral,
    'shadow-basalt-export': shadowBasaltExport,
    'hand-rolled-shell': handRolledShell,
    'raw-scroll-container': rawScrollContainer,
    'visx-boundary': visxBoundary,
    'visx-tooltip': visxTooltip,
    'token-layer-boundary': tokenLayerBoundary,
    'agent-resume-guard': agentResumeGuard,
    'agent-no-raw-usechat': agentNoRawUseChat,
    'ai-sdk-major': aiSdkMajor,
  },
}
