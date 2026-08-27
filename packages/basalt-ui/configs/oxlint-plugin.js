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
 * The design-guard rules below support the same `theme-allow` escape as `src/guard`, and the same
 * two-scope grammar: `theme-allow [<id>…] [— <why>]` at the START of a comment on the reported
 * node's own line or the line above skips THAT node; `theme-allow-file <id>… — <why>` anywhere in
 * the file skips every node of the named rules in it. Both halves are load-bearing — see
 * {@link parseThemeAllows} for why the prefix matters and {@link hasFileDeclaration} for why file
 * scope has to be spelled. The three boundary rules deliberately honour neither — see their own
 * comment for why.
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
  'hand-rolled-filter',
  'control-outside-home',
  'control-size-literal',
  'page-bar-budget',
  'responsive-twin',
  'search-literal-link',
  'use-search-from-literal',
  // `in-body-page-title` is BOTH a plugin rule and a guard kind — one id, two lanes, so one
  // annotation waives both. It is listed once, below, with the guard kinds.
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
  'in-body-page-title',
  'raw-selection-control',
])

const ALLOW_RULE_TOKEN = /^(?:basalt\/)?([a-z][a-z0-9-]*)(?=$|[\s,:—–])/
const ALLOW_REASON_SEPARATOR = /^(?:—|–|-{1,2}|:)\s*/
/** Shortest string accepted as a written reason — enough to exclude a stray separator. */
const MIN_ALLOW_REASON_LENGTH = 4

/**
 * The annotation token, with its optional `-file` suffix.
 *
 * `(?![\w-])` keeps the two forms apart AND stops a longer word from parsing as the bare form:
 * `theme-allow-unscoped` — the KIND NAME, written in prose constantly — used to consume no id, fall
 * through to `rules: []` and read as a blanket waiver.
 */
const ALLOW_TOKEN = /theme-allow(-file)?(?![\w-])/

/**
 * Everything permitted between the start of a line INSIDE the comment and the token.
 *
 * The annotation has to START its comment (or a line of one — the `*` is a block-comment gutter).
 * Without this the parser did a bare `indexOf('theme-allow')`, so a comment that merely MENTIONED
 * the token in prose parsed as the blanket form and switched every rule off on the node below it.
 * linewatch documented its own waivers in a docblock and thereby disarmed the file: a false
 * NEGATIVE, and worse than the whole-file hole 1.20.0 closed. `src/guard`'s `ANNOTATION_PREFIX` is
 * the same test against raw source text (which still carries its `//` / `/*` opener; a comment
 * NODE's `value` does not, hence the two spellings).
 */
const ALLOW_LINE_PREFIX = /^\s*\*?\s*$/

/** Parse the text following the token — ids, then the reason. See {@link parseThemeAllows}. */
function parseAllowBody(rest, scope) {
  let remainder = rest.replace(/^[\s,]+/, '')
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
  return { rules, unknownRules, hasReason: reason.length >= MIN_ALLOW_REASON_LENGTH, scope }
}

/**
 * Every annotation one comment carries. A docblock can hold more than one, so this returns a list.
 *
 * The grammar, and it is the same one `src/guard` parses:
 *
 * ```text
 * theme-allow                             → this node, EVERY rule (the legacy bare form)
 * theme-allow <id>[, <id>…] [— <why>]     → this node, those rules
 * theme-allow-file <id>[, <id>…] — <why>  → the WHOLE FILE, those rules
 * ```
 *
 * `{ rules: [], unknownRules: [] }` is the bare form; a non-empty `rules` scopes the exception to
 * exactly those ids. A word that occupies the id slot but names no known rule lands in
 * `unknownRules` and FAILS CLOSED — the annotation then waives only the ids it got right, never
 * everything. `theme-allow raw-hexx — reason` used to consume no id, fall through to the
 * empty-`rules` branch and be read as the blanket form, so one mistyped character escalated a
 * scoped waiver into a whole-line one, i.e. weaker than before the scoping existed.
 *
 * A prose reason is therefore introduced with a separator (`—`, `–`, `-`, `:`), which is how every
 * annotation in the wild already writes it.
 *
 * The id slot closes at the first space that no comma opened: the first word is always a claimed
 * id (that is where a typo lands), but after a resolved id only a `,` keeps the list open, so
 * `theme-allow raw-surface sub-scale legend corner` reads `sub-scale` as prose rather than as a
 * typo. See the guard's copy for the full reasoning.
 */
function parseThemeAllows(commentValue) {
  const out = []
  for (const rawLine of commentValue.split('\n')) {
    const token = ALLOW_TOKEN.exec(rawLine)
    if (token === null) continue
    if (!ALLOW_LINE_PREFIX.test(rawLine.slice(0, token.index))) continue
    const rest = rawLine.slice(token.index + token[0].length)
    out.push(parseAllowBody(rest, token[1] === undefined ? 'line' : 'file'))
  }
  return out
}

/**
 * Does one annotation cover `ruleId`?
 *
 * Only a BARE **node** annotation covers every rule. A bare `theme-allow-file` covers nothing: the
 * blanket form is tolerable on one line, where a reader sees what it sits on; over a whole file it
 * is a config exemption without the config review, so the widest waiver in the contract is the one
 * that has to name what it waives.
 */
function allowCovers(allow, ruleId) {
  if (allow.rules.includes(ruleId)) return true
  if (allow.scope === 'file') return false
  return allow.rules.length === 0 && allow.unknownRules.length === 0
}

function allComments(context) {
  const sourceCode = context.sourceCode ?? context.getSourceCode?.()
  return sourceCode?.getAllComments?.() ?? []
}

/**
 * Every comment that REACHES `nodeLine` — the comment on the node's own line, the one directly
 * above it, and any further comment separated from that one by nothing but comment.
 *
 * This is the plugin's half of "which node does this annotation scope to", and it has to answer the
 * same question `src/guard`'s forward walk answers: **an annotation reaches the first line below its
 * comment that is not itself comment.** The test used to be a flat `end.line === nodeLine ||
 * nodeLine - 1`, which is the same rule only when the annotation is the LAST comment above the node
 * — so anything sitting between the annotation and the node, comment included, was reported here
 * while the guard waived it:
 *
 * ```text
 * // theme-allow raw-hex — the vendor brand hex, kept in sync with     ← a reason that wrapped
 * // the marketing site's own palette                                     onto a second comment
 * const BRAND = '#ff0000'
 *
 * {/* theme-allow card-inset — … *\/}
 * {/* 3. the density row *\/}                                            ← an unrelated note
 * <Card p={0} />
 * ```
 *
 * The wrapped-reason one is not hypothetical: it is pinned in the guard's tests as a shape argo
 * writes. A blank line still separates, because a blank line is not comment — which is what makes
 * "this comment is not about the next statement" expressible in both halves.
 *
 * Returned bottom-up, which is also the cheap order to walk: stop at the first gap.
 */
function reachingComments(context, nodeLine) {
  const comments = allComments(context).toSorted((a, b) => a.loc.start.line - b.loc.start.line)
  const out = []
  let reach = nodeLine
  for (let i = comments.length - 1; i >= 0; i--) {
    const comment = comments[i]
    if (comment.loc.end.line > nodeLine) continue
    if (comment.loc.end.line < reach - 1) break
    out.push(comment)
    reach = Math.min(reach, comment.loc.start.line)
  }
  return out
}

/**
 * True when a NODE-scoped `theme-allow` covering `ruleId` reaches `node` (see
 * {@link reachingComments}) — or when the file carries a `theme-allow-file` declaration for it.
 *
 * The `ruleId` argument is what stops one exemption from being a blanket one: a `theme-allow
 * raw-hex — …` written for a color no longer silently switches off `card-inset` on the same line.
 * An annotation that reached for an id and missed covers only the ids it got right.
 */
function hasThemeAllow(context, node, ruleId) {
  if (hasFileDeclaration(context, ruleId)) return true
  return reachingComments(context, node.loc.start.line).some((comment) =>
    parseThemeAllows(comment.value).some(
      (allow) => allow.scope === 'line' && allowCovers(allow, ruleId),
    ),
  )
}

/**
 * True when the FILE carries a written declaration for `ruleId` — a `theme-allow-file` naming it,
 * anywhere in the file.
 *
 * File scope has to be SPELLED, and that is the second half of the 1.20.0 fix rather than a new
 * idea. The first half landed: `hand-rolled-plot` stopped granting a whole file permanent immunity
 * off any comment that happened to sit on its first assembly node, and now reports every node. The
 * second half did not, because the promotion rule was "names a rule AND gives a reason" — which is
 * exactly what the rule's own message asks a consumer to write, and what `theme-allow-unscoped`
 * reports them for omitting. So there was one legal annotation shape and it was whole-file:
 * `hasFileDeclaration` still returned early for every node, forever. linewatch ended up with one
 * whole-file declaration per chart file — the thing 1.20.0 set out to eliminate — because per-node
 * scoping was not expressible. Now it is: `theme-allow` is the node, `theme-allow-file` is the file.
 */
function hasFileDeclaration(context, ruleId) {
  return allComments(context).some((comment) =>
    parseThemeAllows(comment.value).some(
      (allow) => allow.scope === 'file' && allow.rules.includes(ruleId),
    ),
  )
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
  'BandStrip',
  'Bars',
  'Donut',
  'DualPanel',
  'Heatmap',
  'MirroredBars',
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

// `overflowX` is absent from the UNIVERSAL set for the original reason: a horizontal bar doesn't
// reserve gutter width in a chrome column, so a horizontally-scrolling code block or pinned-column
// table is its own legitimate pattern, not a ScrollArea candidate. It IS policed inside a home,
// where the doctrine is the opposite one — see RAW_SCROLL_CONTAINER_HOME_MESSAGE.
const OVERFLOW_KEYS = new Set(['overflow', 'overflowY'])
const SCROLLING_VALUES = new Set(['auto', 'scroll'])

/** The two home elements a horizontal scroll region is banned UNDER, slot or body alike (law C7). */
const SCROLL_HOME_TAGS = new Set(['Section', 'ChartCard'])

const RAW_SCROLL_CONTAINER_HOME_MESSAGE =
  'Horizontal scroll region inside a home — a page bar, a section header and a chart card never ' +
  'scroll sideways and never wrap: overflow folds into a `More` menu (actions) or a `Filters (n)` ' +
  'sheet (filters), computed by basalt from the typed BarAction[] (law C7). A sideways-scrolling ' +
  'row of controls is the shape that law replaces. (basalt/raw-scroll-container)'

/**
 * Is this node inside a home — a slot attribute, or anywhere under a `Section` / `ChartCard`?
 *
 * The widened half of the rule (C7) is scoped by ANCESTRY only, with no hoisted-binding lookup: a
 * style object hoisted to a `const` has no JSX ancestor at all, so a hoisted
 * `{ overflowX: 'auto' }` used inside a Section is a known false negative here — the same gap
 * `chart-legend-literal` documents for a hoisted `items` array, and for the same reason (following
 * it means local flow analysis for a bypass nobody reaches by accident).
 */
function isInHomeContext(node) {
  return enclosingSlotAttribute(node) !== undefined || hasAncestorTag(node, SCROLL_HOME_TAGS)
}

/**
 * Reports a `style` object property that turns a node into its own scroll container. Whether a raw
 * scroll box is wrong depends on who owns the scroll node, which no AST check can see — so the
 * `theme-allow` comment is a first-class part of the rule, not an escape valve for exceptional
 * cases: a component that legitimately owns its scroll node (`BasaltStickToBottom`,
 * `BasaltVirtualList`, `ThreadTranscript`'s virtualized pane) declares that ownership with the
 * comment and moves on. Severity went `off` → `warn` (1.12.0) → `error` (1.13.0) once every live
 * site in the repo carried that declaration; the opt-out mechanism is identical at either level.
 *
 * **The C7 widening (wave 6) inherits that `error` with no grace runway, and that is a LIMITATION,
 * not a decision.** oxlint severity is per rule ID, so a widened branch cannot ship `warn` while
 * the incumbent branch stays `error` — the only way to buy a runway would have been a second rule
 * id, which is the bundled-vs-split trade the three boundary rules were split apart over, in the
 * opposite direction. What the widening does instead is stay narrow: `overflowX` and
 * `ScrollArea scrollbars="x"` are policed ONLY inside a home (see {@link isInHomeContext}), which
 * is where C7 actually applies, so the set of newly-rejected code is small enough to fix rather
 * than schedule. A consumer who disagrees turns the whole rule down in their own config.
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
        if (typeof keyName !== 'string') return
        const universal = OVERFLOW_KEYS.has(keyName)
        if (!universal && keyName !== 'overflowX') return
        if (!isStringLiteral(node.value) || !SCROLLING_VALUES.has(node.value.value)) return
        // The C7 widening: `overflowX` is only a violation INSIDE a home (see isInHomeContext).
        if (!universal && !isInHomeContext(node)) return
        if (hasThemeAllow(context, node, 'raw-scroll-container')) return
        context.report({
          node,
          message: universal ? RAW_SCROLL_CONTAINER_MESSAGE : RAW_SCROLL_CONTAINER_HOME_MESSAGE,
        })
      },
      // `<ScrollArea scrollbars="x">` — the same horizontal scroll region written as a component.
      // Only inside a home, exactly like the `overflowX` half above; a ScrollArea is otherwise the
      // shape this whole rule steers people TOWARD.
      JSXAttribute(node) {
        if (node.name?.name !== 'scrollbars') return
        const value = unwrapExpressionContainer(node.value)
        if (!isStringLiteral(value) || value.value !== 'x') return
        const owner = node.parent
        if (owner?.type !== 'JSXOpeningElement' || jsxTagName(owner.name) !== 'ScrollArea') return
        if (!isInHomeContext(node)) return
        if (hasThemeAllow(context, node, 'raw-scroll-container')) return
        context.report({ node, message: RAW_SCROLL_CONTAINER_HOME_MESSAGE })
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
 *
 * **`roots` is consulted BEFORE the dependency, within one manifest**, and that ordering is the
 * whole fix. `init` produces exactly the layout that breaks the other way round: a monorepo ROOT
 * carrying `basalt-ui` as the devDependency the CLI is run from, AND `basalt.roots: ["apps/web/
 * src"]` naming where the app actually is. Dep-first returned in-scope on that root before `roots`
 * was ever read, so rb's `apps/api` — no basalt dependency, deliberately on a different `ai` major,
 * explicitly outside the declared roots — took three errors and needed a permanent override. The
 * more specific statement wins: `roots` says WHERE, the dependency only says whether.
 */
function isBasaltScopedFile(filename) {
  let dir = dirname(filename)
  for (;;) {
    const pkg = readPackageJson(resolvePath(dir, 'package.json'))
    if (pkg !== null) {
      const roots = pkg.basalt?.roots
      if (Array.isArray(roots) && roots.length > 0) {
        return roots.some((root) => filename.startsWith(`${resolvePath(dir, root)}/`))
      }
      const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies }
      if (deps['basalt-ui'] !== undefined) return true
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
  'ChartFrame instead — declare that with `theme-allow-file hand-rolled-plot — <why>` anywhere in ' +
  'the file. To waive just THIS node and stay policed on the rest, write `theme-allow ' +
  'hand-rolled-plot — <why>` on its own line above it. (basalt/hand-rolled-plot)'

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
 * A component-shaped NAME: starts uppercase and carries a lowercase letter, which excludes the
 * SCREAMING_CASE constants and the two-letter token namespaces in the same barrel.
 *
 * A name test alone is not a component test — see {@link isComponentInit}. Every PascalCase binding
 * passes this, which is how obsidian's `SlugTracker` (a plain data class in a React-free package)
 * became a "forked component" the moment 1.21.0 widened the rule to all nine barrels.
 */
const COMPONENT_NAME = /^[A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9]*$/

/** The two wrappers a function component is legitimately declared inside. */
const COMPONENT_WRAPPERS = new Set(['memo', 'forwardRef'])

/**
 * Is this initializer component-SHAPED — a function, an arrow, or one wrapped in `memo` /
 * `forwardRef`?
 *
 * The second half of the fix for obsidian's false positive. `const Foo = new Map()` and
 * `class SlugTracker {}` share a name with a basalt export and nothing else; a fork of a component
 * is a function (or, historically, a class that `extends` one). Narrowing here costs the rule
 * nothing it was ever meant to catch and removes the whole "PascalCase binding" false-positive
 * class, which the nine-barrel widening made large.
 */
function isComponentInit(init) {
  if (init === null || init === undefined) return false
  if (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression') return true
  if (init.type !== 'CallExpression') return false
  const callee = init.callee
  const name = callee?.type === 'MemberExpression' ? callee.property?.name : callee?.name
  return typeof name === 'string' && COMPONENT_WRAPPERS.has(name)
}

/**
 * The barrels a consumer can import a component FROM. The root one is not the whole surface: a
 * chart-layer fork (`ChartFrame`, `CartesianChart`, `ChartCard`, …) collided with nothing, because
 * `./charts` is deliberately NOT re-exported from `.` — so a consumer whose forks all live in the
 * chart layer, which is the layer forks actually live in, could never trip the rule. It was
 * correctly silent there for the wrong reason.
 *
 * Enumerated rather than globbed: `dist/**\/index.d.ts` would also sweep internal directory
 * barrels that are not published subpaths, and a name that is not importable is not a fork of
 * anything. Keep this in step with the `exports` map in package.json.
 */
const BASALT_BARRELS = [
  ['index.d.ts'],
  ['charts', 'index.d.ts'],
  ['content', 'index.d.ts'],
  ['data', 'index.d.ts'],
  ['forms', 'index.d.ts'],
  ['agent', 'index.d.ts'],
  ['commands', 'index.d.ts'],
  ['notifications', 'index.d.ts'],
  ['connectivity', 'index.d.ts'],
]

/**
 * Every component-shaped VALUE export of basalt's published barrels, read once at module load from
 * the real `.d.ts` files — not a hand-maintained list that would go stale the first time an export
 * was renamed. `type` specifiers are skipped: a local `StatCardProps` is a normal thing to write, a
 * local `StatCard` is not.
 *
 * Empty (rule silent) when `dist` is unreadable, exactly like `BASALT_AI_MAJOR` — a lint run must
 * not depend on a build having happened.
 */
const BASALT_EXPORTS = (() => {
  const names = new Set()
  for (const segments of BASALT_BARRELS) {
    let text
    try {
      text = readFileSync(resolvePath(PACKAGE_ROOT, 'dist', ...segments), 'utf8')
    } catch {
      continue
    }
    for (const block of text.matchAll(/export\s*\{([^}]*)\}(?:\s*from\s*['"]([^'"]*)['"])?/g)) {
      // A pass-through re-export of a THIRD-PARTY name is not a basalt composite. `./charts`
      // re-exports `Bar`, `Line`, `Pie`, `AreaClosed` … straight from `@visx/shape`, and a local
      // `Bar` is not a fork of anything basalt wrote — the playground's own demo tripped on it the
      // moment this rule started reading the charts barrel. Relative sources only.
      const source = block[2]
      if (source !== undefined && !source.startsWith('.')) continue
      for (const raw of block[1].split(',')) {
        const part = raw.trim()
        if (part === '' || part.startsWith('type ')) continue
        const name = (part.split(/\s+as\s+/).pop() ?? '').trim()
        if (COMPONENT_NAME.test(name)) names.add(name)
      }
    }
  }
  return names
})()

/**
 * Renames that ARE the collision, spelled out because the name no longer collides.
 *
 * `BASALT_EXPORTS` catches a fork that kept basalt's name. The commoner shape is a fork that
 * renamed it: argo's `PageHeader`, linewatch's `WindowSelector`, rb's `HeroCard`. Each of these is
 * the same composite under a different word, so the tripwire has to name the words — and unlike the
 * barrel read, this table is hand-maintained by construction: there is no artifact to derive
 * "someone else's word for `Section`" from. Keep it in step with `docs/CONTROLS-SPEC.md` §6.
 *
 * Advisory, permanently (see {@link PLUGIN_RULE_ADVISORY}): a name is evidence, never proof.
 */
const SHADOW_ALIASES = {
  PageSection: 'Section',
  SectionTitle: 'Section',
  SectionHeading: 'Section',
  WindowSelector: 'RangeFilter',
  RangeSelector: 'RangeFilter',
  DateFilter: 'RangeFilter',
  ViewSwitch: 'ViewTabs',
  ViewToggle: 'ViewTabs',
  RefreshButton: 'SyncButton',
  SyncControl: 'SyncButton',
  SyncStatusButton: 'SyncButton',
  PageHeader: 'PageBar',
  FilterBar: 'PageBar',
  HeroCard: 'StatCard',
  HeroStats: 'StatCard',
}

function shadowAliasMessage(name, canonical) {
  return (
    `Local component '${name}' is a renamed '${canonical}' — basalt ships that composite, and a ` +
    'renamed fork is the shape the name-collision half of this rule can never see (laws C8/C12). ' +
    `Import ${canonical} from 'basalt-ui' (or 'basalt-ui/controls') instead of re-rolling it; if ` +
    'this genuinely is a different component, rename it and the rule goes quiet. ' +
    '(basalt/shadow-basalt-export)'
  )
}

function shadowBasaltExportMessage(name) {
  return (
    `Local component '${name}' collides with the basalt-ui export of the same name — import it ` +
    "from 'basalt-ui' instead of re-rolling it. This is the one signal a forked composite emits: " +
    'the palette guard can never see it, because a fork written by a token-fluent author uses ' +
    'exactly the right tokens and passes every other check. A NAME collision is the whole of the ' +
    'signal, so this is a tripwire, not coverage: rename the fork and the rule goes quiet ' +
    "(linewatch's forks are `Cell` and `Box`, rb's is `Stat`). Silence here is not evidence that " +
    'nothing is forked. (basalt/shadow-basalt-export)'
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
    if (BASALT_EXPORTS.size === 0 || filename.startsWith(`${PACKAGE_ROOT}/`)) return {}
    if (isTestFile(context)) return {}
    // Scoped exactly like `ai-sdk-major`, and for the same reason: a package with no basalt-ui
    // dependency (or one outside a declared `basalt.roots`) cannot import the export it is accused
    // of forking, so the advice — "import it from 'basalt-ui' instead" — is not followable there.
    // obsidian's React-free `obsidian-vault-core` took the report and had to waive it.
    if (filename.length === 0 || !isBasaltScopedFile(filename)) return {}

    const report = (node, name) => {
      if (typeof name !== 'string') return
      const alias = Object.hasOwn(SHADOW_ALIASES, name) ? SHADOW_ALIASES[name] : undefined
      if (!BASALT_EXPORTS.has(name) && alias === undefined) return
      if (hasThemeAllow(context, node, 'shadow-basalt-export')) return
      const message =
        alias === undefined ? shadowBasaltExportMessage(name) : shadowAliasMessage(name, alias)
      context.report({ node, message })
    }

    return {
      FunctionDeclaration(node) {
        report(node, node.id?.name)
      },
      VariableDeclarator(node) {
        if (!isComponentInit(node.init)) return
        report(node, node.id?.name)
      },
      // A class only counts when it EXTENDS something — a legacy class component. basalt ships no
      // class components, so a standalone `class X {}` sharing a name with one of its exports is a
      // collision between two unrelated things, not a fork.
      ClassDeclaration(node) {
        if (node.superClass === null || node.superClass === undefined) return
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
  'tokens. Declare a deliberate exception with `theme-allow-file hand-rolled-shell — <why>`. ' +
  '(basalt/hand-rolled-shell)'

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

// ── Control homes — the shared slot-ancestry walk (C1/C5, docs/CONTROLS-SPEC.md §6) ─────────────

/**
 * The slot props a control enters a TIERED home through (law C1). A control is only ever IN one of
 * these homes by being the value of one of these props — never by sitting in a home's children,
 * which is the body form (a `Section`'s own content, a `SettingsSection`'s rows) and carries no tier
 * obligation at all.
 *
 * **`control` is deliberately absent, and `SettingsRow` with it** (see {@link SLOT_OWNER_TAGS}):
 * `SettingsRow.control` is law C1's THIRD home, the form row, and a form keeps Mantine's own `md`
 * tier (`controlHeight` 42 — `docs/CONTROLS-SPEC.md` §5, unchanged). So a raw `Select` bound to a
 * setting is legitimate there and a `size` literal there is not a tier violation; only
 * `control-outside-home` cares about a settings row at all, and it treats it as a home
 * (`CONTROL_HOST_TAGS`) so nothing fires inside one. The two tier rules would otherwise have told
 * every settings page in every consumer to drop a prop that is what keeps the row at the form tier
 * — `src/dashboard/settings-section.tsx` wraps `actions` in `CtlSlot`, never `control`.
 */
const SLOT_ATTRS = new Set(['actions', 'filters', 'tabs', 'sync', 'filtersEnd'])

/**
 * The elements whose slot props ARE tiered homes. Both halves of the test matter: `actions` on a
 * consumer's own `<Toolbar actions={…}>` is not a basalt home, and a `Section`'s CHILDREN are not
 * a slot — so the walk stops at the slot ATTRIBUTE, never at the element.
 *
 * `SettingsSection` is here for its `actions` header slot (`CtlSlot`-wrapped); `SettingsRow` is
 * NOT — its `control` is the form-row home and keeps Mantine's `md` tier. See {@link SLOT_ATTRS}.
 */
const SLOT_OWNER_TAGS = new Set([
  'PageBar',
  'Section',
  'WidgetHeader',
  'ChartCard',
  'StatCard',
  'BasaltDataTable',
  'SettingsSection',
  'FilterSet',
])

/**
 * Raw Mantine selection controls — the shape a store-bound basalt filter replaces. Membership is
 * checked against the file's `@mantine/*` IMPORTS, not the bare tag name: a consumer's own
 * `<Select>` (a wrapper, a re-export, a different component entirely) is not the Mantine one, and
 * these rules ship to consumers.
 */
const RAW_FILTER_TAGS = new Set([
  'SegmentedControl',
  'Select',
  'MultiSelect',
  'NativeSelect',
  'DatePickerInput',
  'DateInput',
  'TagsInput',
  'Chip.Group',
])

/** The bound controls a home is SUPPOSED to hold — `basalt-ui/controls`, each over a FieldHandle. */
const BOUND_TAGS = new Set([
  'RangeFilter',
  'CompareFilter',
  'SelectFilter',
  'MultiSelectFilter',
  'SearchFilter',
  'ToggleFilter',
  'ViewTabs',
])

/**
 * The names whose DECLARATION means this file defines a basalt control rather than consuming one —
 * the owner exemption, the same shape as `hand-rolled-plot`'s `notesOwnerDefinition`: a rule that
 * says "use a bound control" cannot fire inside the module that IS the bound control.
 */
const CONTROL_OWNER_NAMES = new Set([
  ...BOUND_TAGS,
  'FilterSet',
  'FilterPill',
  'SyncButton',
  'ActionGroup',
  'OverflowMenu',
  'CtlSlot',
])

/** How far an ancestry walk climbs before giving up — a JSX tree this deep is not a slot value. */
const ANCESTRY_MAX_DEPTH = 60

/** A JSX tag name as written: `Select`, or `Chip.Group` for a member tag. */
function jsxTagName(nameNode) {
  if (nameNode === null || nameNode === undefined) return undefined
  if (typeof nameNode.name === 'string') return nameNode.name
  const object = jsxTagName(nameNode.object)
  const property = nameNode.property?.name
  if (typeof object !== 'string' || typeof property !== 'string') return undefined
  return `${object}.${property}`
}

/** The BINDING a JSX tag resolves through — `Chip` for `<Chip.Group>`, `Select` for `<Select>`. */
function jsxRootName(nameNode) {
  if (nameNode === null || nameNode === undefined) return undefined
  if (typeof nameNode.name === 'string') return nameNode.name
  return jsxRootName(nameNode.object)
}

/** Local names imported from any `@mantine/*` entry — the provenance test the tag rules apply. */
function collectMantineImports(node, into) {
  const source = node.source?.value
  if (typeof source !== 'string' || !source.startsWith('@mantine/')) return
  for (const spec of node.specifiers ?? []) {
    if (spec.local?.name !== undefined) into.add(spec.local.name)
  }
}

/** Is this JSXAttribute a home's slot prop — the right NAME on the right OWNER? */
function isSlotAttribute(attr) {
  if (attr === null || attr === undefined || attr.type !== 'JSXAttribute') return false
  const name = attr.name?.name
  if (typeof name !== 'string' || !SLOT_ATTRS.has(name)) return false
  const owner = attr.parent
  if (owner === null || owner === undefined || owner.type !== 'JSXOpeningElement') return false
  return SLOT_OWNER_TAGS.has(jsxTagName(owner.name) ?? '')
}

/** The home slot attribute that ENCLOSES `node`, or undefined. Stops at the attribute, never the element. */
function enclosingSlotAttribute(node) {
  let current = node.parent
  for (let depth = 0; current !== null && current !== undefined; depth++) {
    if (depth > ANCESTRY_MAX_DEPTH || current.type === 'Program') return undefined
    if (isSlotAttribute(current)) return current
    current = current.parent
  }
  return undefined
}

/** The name of the nearest enclosing `const x = …` binding — the hoisted-slot-value lookup. */
function enclosingDeclaratorName(node) {
  let current = node.parent
  for (let depth = 0; current !== null && current !== undefined; depth++) {
    if (depth > ANCESTRY_MAX_DEPTH || current.type === 'Program') return undefined
    if (current.type === 'VariableDeclarator') {
      return typeof current.id?.name === 'string' ? current.id.name : undefined
    }
    current = current.parent
  }
  return undefined
}

/** True when any JSX ELEMENT ancestor of `node` opens with one of `tags`. */
function hasAncestorTag(node, tags) {
  let current = node.parent
  for (let depth = 0; current !== null && current !== undefined; depth++) {
    if (depth > ANCESTRY_MAX_DEPTH || current.type === 'Program') return false
    if (current.type === 'JSXElement' && tags.has(jsxTagName(current.openingElement?.name) ?? '')) {
      return true
    }
    current = current.parent
  }
  return false
}

/** Identifiers a slot attribute's value resolves through — `filters={pills}`, `actions={[a, b]}`. */
function collectSlotValueIdentifiers(node, into, depth = 0) {
  if (node === null || node === undefined || depth > 8) return
  if (node.type === 'Identifier') {
    into.add(node.name)
    return
  }
  if (node.type === 'ArrayExpression') {
    for (const el of node.elements) collectSlotValueIdentifiers(el, into, depth + 1)
    return
  }
  if (node.type === 'ConditionalExpression') {
    collectSlotValueIdentifiers(node.consequent, into, depth + 1)
    collectSlotValueIdentifiers(node.alternate, into, depth + 1)
    return
  }
  if (node.type === 'LogicalExpression') {
    collectSlotValueIdentifiers(node.left, into, depth + 1)
    collectSlotValueIdentifiers(node.right, into, depth + 1)
  }
}

/**
 * The shared "am I inside a home slot" resolver, and the one piece of state every control rule
 * needs the WHOLE file to answer: a hoisted `const pills = <Select …/>` handed to `filters={pills}`
 * further down is inside that slot (argo's hoisted `headerExtra`, `cost-over-time.tsx:54-68`), and
 * the binding is only known to be slot-bound once the attribute has been seen.
 *
 * So the ancestry facts are CAPTURED during the visit — while `node.parent` is walkable — and
 * resolved at `Program:exit`, when the slot-bound identifier set is complete. `capture()` returns a
 * descriptor, `resolve()` turns it into a verdict; nothing re-walks the tree after traversal ends.
 */
function createSlotContext() {
  const slotBoundIdentifiers = new Set()
  return {
    /** Feed every JSXAttribute here — a slot attribute contributes its value's identifiers. */
    note(attr) {
      if (!isSlotAttribute(attr)) return
      collectSlotValueIdentifiers(unwrapExpressionContainer(attr.value), slotBoundIdentifiers)
    },
    /** Snapshot `node`'s ancestry while it is walkable. */
    capture(node) {
      return {
        direct: enclosingSlotAttribute(node) !== undefined,
        declaratorName: enclosingDeclaratorName(node),
      }
    },
    /** Is a captured node inside a home slot — directly, or via a hoisted binding? */
    resolve(captured) {
      if (captured.direct) return true
      return (
        captured.declaratorName !== undefined && slotBoundIdentifiers.has(captured.declaratorName)
      )
    },
  }
}

/** Collects an owner-definition flag for the control layer — see {@link CONTROL_OWNER_NAMES}. */
function createControlOwnerProbe() {
  const state = { definesControl: false }
  const note = (name) => {
    if (typeof name === 'string' && CONTROL_OWNER_NAMES.has(name)) state.definesControl = true
  }
  return {
    state,
    visitors: {
      FunctionDeclaration(node) {
        note(node.id?.name)
      },
      VariableDeclarator(node) {
        note(node.id?.name)
      },
    },
  }
}

// ── Rule 16 — hand-rolled-filter ────────────────────────────────────────────────────────────────

const HAND_ROLLED_FILTER_MESSAGE =
  'Raw Mantine selection control inside a home slot — a filter or tab in a PageBar / Section / ' +
  'WidgetHeader slot takes a `field` (a FieldHandle) and owns both the URL write and the ' +
  'localStorage mirror, so it cannot carry value/onChange at all (laws C1–C3). Use ' +
  'RangeFilter / SelectFilter / MultiSelectFilter / SearchFilter / ToggleFilter / ViewTabs from ' +
  "basalt-ui/controls. Two shapes are NOT this rule: a control in a home's CHILDREN (a Section " +
  "body form), and a SettingsRow's `control` — the form-row home, where a raw input at Mantine's " +
  'md tier is the right answer. (basalt/hand-rolled-filter)'

/**
 * A raw Mantine selection control handed to a home slot (laws C1/C3).
 *
 * Ships `error` from the start, unlike its sibling `control-outside-home`: "this element is inside
 * a slot" is a structural fact with no heuristic in it, and the wave-1..4 migrations left no
 * incumbents. Two shapes are deliberately outside the rule: the body form (the ancestry walk stops
 * at the slot ATTRIBUTE, so a `<Select>` in a `Section`'s children never reaches it) and
 * `SettingsRow.control`, the form-row home — see {@link SLOT_ATTRS} for why a raw input is right
 * there.
 */
const handRolledFilter = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow a raw Mantine selection control inside a basalt home slot.' },
    schema: [],
  },
  create(context) {
    if (isTestFile(context)) return {}
    const slots = createSlotContext()
    const mantineImports = new Set()
    const candidates = []

    return {
      ImportDeclaration(node) {
        collectMantineImports(node, mantineImports)
      },
      JSXAttribute(node) {
        slots.note(node)
      },
      JSXOpeningElement(node) {
        const tag = jsxTagName(node.name)
        if (tag === undefined || !RAW_FILTER_TAGS.has(tag)) return
        candidates.push({ node, root: jsxRootName(node.name), captured: slots.capture(node) })
      },
      'Program:exit'() {
        for (const { node, root, captured } of candidates) {
          if (root === undefined || !mantineImports.has(root)) continue
          if (!slots.resolve(captured)) continue
          if (hasThemeAllow(context, node, 'hand-rolled-filter')) continue
          context.report({ node, message: HAND_ROLLED_FILTER_MESSAGE })
        }
      },
    }
  },
}

// ── Rule 17 — control-outside-home ──────────────────────────────────────────────────────────────

/**
 * Where a raw selection control legitimately lives outside a TIERED home: a settings row, an
 * overlay, a composer. Every one of these is a place the tier does not apply, so the advice ("move
 * it into a home slot") would be wrong rather than merely unwelcome.
 *
 * `SettingsRow` is the form row — law C1's third home, not an exception to C1 — so this rule
 * treating it as a home is the whole of the enforcement a settings page gets, and the two tier
 * rules deliberately do not reach inside it (see {@link SLOT_ATTRS}).
 */
const CONTROL_HOST_TAGS = new Set([
  'SettingsRow',
  'Modal',
  'Drawer',
  'Popover.Dropdown',
  'Menu.Dropdown',
  'Composer',
])

const CONTROL_OUTSIDE_HOME_MESSAGE =
  'Raw Mantine selection control with no home — a filter, tab or action belongs in exactly one of ' +
  'the three homes (a PageBar / Section / WidgetHeader slot, or a form row), and a home is entered ' +
  'through a slot prop (law C1). A settings row, an overlay (Modal/Drawer/Popover/Menu) and a ' +
  'form (@mantine/form) are the declared non-homes and never report. ' +
  '(basalt/control-outside-home)'

/**
 * The cross-file half of C1, and the one rule here that is openly a HEURISTIC: "this control has
 * no home" is a claim about layout intent, which no AST can see. It ships `warn` for that reason
 * and stays warn until the playground and the five consumer repos run it with ≤3 waivers
 * (docs/CONTROLS-SPEC.md §9 wave 7).
 *
 * Three exemptions carry the false-positive load: an overlay/settings-row ancestor, a file that
 * imports `@mantine/form` (a form is the third home and its inputs are not filters), and the owner
 * exemption — a file DEFINING a basalt control cannot be told to use one.
 */
const controlOutsideHome = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Warn on a raw Mantine selection control that is in no basalt home.' },
    schema: [],
  },
  create(context) {
    if (isTestFile(context)) return {}
    const slots = createSlotContext()
    const owner = createControlOwnerProbe()
    const mantineImports = new Set()
    const candidates = []
    let importsMantineForm = false

    return {
      ...owner.visitors,
      ImportDeclaration(node) {
        collectMantineImports(node, mantineImports)
        if ((node.source?.value ?? '') === '@mantine/form') importsMantineForm = true
      },
      JSXAttribute(node) {
        slots.note(node)
      },
      JSXOpeningElement(node) {
        const tag = jsxTagName(node.name)
        if (tag === undefined || !RAW_FILTER_TAGS.has(tag)) return
        candidates.push({
          node,
          root: jsxRootName(node.name),
          captured: slots.capture(node),
          hosted: hasAncestorTag(node, CONTROL_HOST_TAGS),
        })
      },
      'Program:exit'() {
        if (importsMantineForm || owner.state.definesControl) return
        for (const { node, root, captured, hosted } of candidates) {
          if (root === undefined || !mantineImports.has(root)) continue
          if (hosted || slots.resolve(captured)) continue
          if (hasThemeAllow(context, node, 'control-outside-home')) continue
          context.report({ node, message: CONTROL_OUTSIDE_HOME_MESSAGE })
        }
      },
    }
  },
}

// ── Rule 18 — control-size-literal ──────────────────────────────────────────────────────────────

/** The props a home already owns — the tier, the width, and the responsive swap (laws C5/C9). */
const CONTROL_SIZE_ATTRS = new Set(['size', 'w', 'fullWidth', 'visibleFrom', 'hiddenFrom'])

const CONTROL_SIZE_LITERAL_MESSAGE =
  'Size/width/breakpoint prop inside a tiered home slot — the HOME sets the tier (`size="ctl"` = 30px, ' +
  "mounted by the slot's own MantineThemeProvider), the control owns its own responsive swap, and " +
  'the overflow fold is computed by basalt from typed data. A `size`/`w`/`fullWidth`/`visibleFrom`/' +
  '`hiddenFrom` written here fights all three (laws C5/C7/C9) — drop the prop. ' +
  '(basalt/control-size-literal)'

/**
 * Every element inside a tiered home slot, not just the raw filters: a `Button size="xs"` dropped
 * into `PageBar.actions` is the same defect as a `Select size="xs"` there — one control in the bar
 * that is not 30px. The slot's hoisted `MantineThemeProvider` already resolves the tier with no
 * prop. A `SettingsRow`'s `control` is NOT a tiered slot (see {@link SLOT_ATTRS}): a form row keeps
 * Mantine's `md`, so the `size` written there is load-bearing rather than redundant.
 */
const controlSizeLiteral = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Warn on a size/width/breakpoint prop written inside a home slot.' },
    schema: [],
  },
  create(context) {
    if (isTestFile(context)) return {}
    const slots = createSlotContext()
    const candidates = []

    return {
      JSXAttribute(node) {
        slots.note(node)
        const name = node.name?.name
        if (typeof name !== 'string' || !CONTROL_SIZE_ATTRS.has(name)) return
        candidates.push({ node, captured: slots.capture(node) })
      },
      'Program:exit'() {
        for (const { node, captured } of candidates) {
          if (!slots.resolve(captured)) continue
          if (hasThemeAllow(context, node, 'control-size-literal')) continue
          context.report({ node, message: CONTROL_SIZE_LITERAL_MESSAGE })
        }
      },
    }
  },
}

// ── Rule 19 — page-bar-budget ───────────────────────────────────────────────────────────────────

/** `PageBar.actions.secondary` — 4, because the one `primary` makes 5 (law C6). */
const PAGE_BAR_SECONDARY_BUDGET = 4
/** A `Section`'s `actions` — 3 (law C6). */
const SECTION_ACTION_BUDGET = 3

const PAGE_BAR_BUDGET_MESSAGES = {
  duplicate:
    'Second PageBar in one file — a page has exactly one page bar, and row 1 portals into the app ' +
    'shell header, so two of them race for the same node (law C6). (basalt/page-bar-budget)',
  secondary:
    `More than ${PAGE_BAR_SECONDARY_BUDGET} secondary PageBar actions — the bar holds ≤5 entries ` +
    'including the one `primary`, and everything past that folds into the `More` menu basalt ' +
    'computes from the typed BarAction[] (laws C6/C7). Move the rest into a `kind: "menu"` entry. ' +
    '(basalt/page-bar-budget)',
  section:
    `More than ${SECTION_ACTION_BUDGET} Section actions — a section header holds ≤3 (law C6). ` +
    '(basalt/page-bar-budget)',
  filled:
    'Second variant="filled" inside one slot — a home has exactly one primary action, and two ' +
    'filled buttons side by side name neither (law C6). (basalt/page-bar-budget)',
}

/** The `actions` attribute of a JSXOpeningElement, unwrapped, or undefined. */
function actionsAttributeValue(node) {
  for (const attr of node.attributes ?? []) {
    if (attr.type !== 'JSXAttribute' || attr.name?.name !== 'actions') continue
    return { attr, value: unwrapExpressionContainer(attr.value) }
  }
  return undefined
}

/**
 * The four countable halves of C6. `error` from the start: every one of them is arithmetic over a
 * literal the file wrote down, with no heuristic and no layout intent to guess at.
 */
const pageBarBudget = {
  meta: {
    type: 'problem',
    docs: { description: 'Enforce the PageBar / Section action budgets and the single primary.' },
    schema: [],
  },
  create(context) {
    if (isTestFile(context)) return {}
    const pageBars = []
    const findings = []
    /** Slot attribute node → the `variant="filled"` attributes written inside it. */
    const filledPerSlot = new Map()

    return {
      JSXOpeningElement(node) {
        const tag = jsxTagName(node.name)
        if (tag === 'PageBar') {
          pageBars.push(node)
          const actions = actionsAttributeValue(node)
          if (actions?.value?.type === 'ObjectExpression') {
            for (const prop of actions.value.properties) {
              if (prop.type !== 'Property' || propertyKeyName(prop) !== 'secondary') continue
              if (prop.value?.type !== 'ArrayExpression') continue
              if (prop.value.elements.length <= PAGE_BAR_SECONDARY_BUDGET) continue
              findings.push({ node: prop, message: PAGE_BAR_BUDGET_MESSAGES.secondary })
            }
          }
          return
        }
        if (tag !== 'Section') return
        const actions = actionsAttributeValue(node)
        if (actions?.value?.type !== 'ArrayExpression') return
        if (actions.value.elements.length <= SECTION_ACTION_BUDGET) return
        findings.push({ node: actions.attr, message: PAGE_BAR_BUDGET_MESSAGES.section })
      },
      JSXAttribute(node) {
        if (node.name?.name !== 'variant') return
        const value = unwrapExpressionContainer(node.value)
        if (!isStringLiteral(value) || value.value !== 'filled') return
        const slot = enclosingSlotAttribute(node)
        if (slot === undefined) return
        const written = filledPerSlot.get(slot) ?? []
        written.push(node)
        filledPerSlot.set(slot, written)
      },
      'Program:exit'() {
        for (const node of pageBars.slice(1)) {
          findings.push({ node, message: PAGE_BAR_BUDGET_MESSAGES.duplicate })
        }
        for (const written of filledPerSlot.values()) {
          for (const node of written.slice(1)) {
            findings.push({ node, message: PAGE_BAR_BUDGET_MESSAGES.filled })
          }
        }
        for (const { node, message } of findings) {
          if (hasThemeAllow(context, node, 'page-bar-budget')) continue
          context.report({ node, message })
        }
      },
    }
  },
}

// ── Rule 20 — in-body-page-title ────────────────────────────────────────────────────────────────

/** Where an `order={1|2}` Title is a DOCUMENT heading rather than a page title. */
const PAGE_TITLE_HOST_TAGS = new Set(['Prose', 'ArticleLayout', 'Modal', 'Drawer'])

const IN_BODY_PAGE_TITLE_MESSAGE =
  'In-body page title — the page is named ONCE, by the breadcrumb (`staticData.title`) or by ' +
  '`PageBar.title` in a shell-less app, and every section/card/table title is a `WidgetHeader` ' +
  '(law C8). An `<Title order={1|2}>` in the body is a second, drifting name for the same page. ' +
  'Prose / ArticleLayout / an overlay and anything under a `content/` path are document headings ' +
  'and never report. (basalt/in-body-page-title)'

/** The `order` prop as a number literal, or undefined. */
function titleOrderOf(node) {
  for (const attr of node.attributes ?? []) {
    if (attr.type !== 'JSXAttribute' || attr.name?.name !== 'order') continue
    const value = unwrapExpressionContainer(attr.value)
    return isNumericLiteral(value) ? value.value : undefined
  }
  return undefined
}

/**
 * The AST half of C8. Its text-level twin is the `in-body-page-title` GUARD KIND — same id in both
 * lanes on purpose, so one `theme-allow in-body-page-title — <why>` waives both rather than
 * needing a different word per enforcement surface.
 */
const inBodyPageTitle = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Warn on an in-body <Title order={1|2}> outside prose/overlay context.' },
    schema: [],
  },
  create(context) {
    if (isTestFile(context) || hasPathSegment(getFilename(context), 'content')) return {}

    return {
      JSXOpeningElement(node) {
        if (jsxTagName(node.name) !== 'Title') return
        const order = titleOrderOf(node)
        if (order !== 1 && order !== 2) return
        if (hasAncestorTag(node, PAGE_TITLE_HOST_TAGS)) return
        if (hasThemeAllow(context, node, 'in-body-page-title')) return
        context.report({ node, message: IN_BODY_PAGE_TITLE_MESSAGE })
      },
    }
  },
}

// ── Rule 21 — responsive-twin ───────────────────────────────────────────────────────────────────

const RESPONSIVE_TWIN_MESSAGE =
  'The same control mounted twice under visibleFrom/hiddenFrom — a responsive swap belongs to the ' +
  'CONTROL, which owns one mount and switches its own presentation in CSS (law C9). Two mounts are ' +
  'two states: the hidden half keeps its own value, its own focus and its own store writes. ' +
  'Render it once. (basalt/responsive-twin)'

/** The breakpoint a `visibleFrom` / `hiddenFrom` prop names, as a string literal. */
function breakpointAttr(element, attrName) {
  for (const attr of element.openingElement?.attributes ?? []) {
    if (attr.type !== 'JSXAttribute' || attr.name?.name !== attrName) continue
    const value = unwrapExpressionContainer(attr.value)
    return isStringLiteral(value) ? value.value : undefined
  }
  return undefined
}

/** Every control tag rendered anywhere in `node`'s subtree, itself included. */
function subtreeControlTags(node, into = new Set(), depth = 0) {
  if (node === null || node === undefined || depth > 16) return into
  if (node.type === 'JSXElement') {
    const tag = jsxTagName(node.openingElement?.name)
    if (tag !== undefined && (RAW_FILTER_TAGS.has(tag) || BOUND_TAGS.has(tag))) into.add(tag)
    for (const child of node.children ?? []) subtreeControlTags(child, into, depth + 1)
    return into
  }
  if (node.type === 'JSXFragment') {
    for (const child of node.children ?? []) subtreeControlTags(child, into, depth + 1)
    return into
  }
  if (node.type === 'JSXExpressionContainer')
    return subtreeControlTags(node.expression, into, depth + 1)
  if (node.type === 'ConditionalExpression') {
    subtreeControlTags(node.consequent, into, depth + 1)
    return subtreeControlTags(node.alternate, into, depth + 1)
  }
  if (node.type === 'LogicalExpression') {
    subtreeControlTags(node.left, into, depth + 1)
    return subtreeControlTags(node.right, into, depth + 1)
  }
  return into
}

/**
 * Law C9 — linewatch shipped three doubled controls this way. The pair test is deliberately narrow:
 * two SIBLING elements, one `visibleFrom="X"` and one `hiddenFrom="X"` on the SAME breakpoint, whose
 * subtrees both render the same control tag. A file that DEFINES a basalt control is exempt — the
 * one legitimate double mount is the CSS swap inside the control itself.
 */
const responsiveTwin = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Warn on one control mounted twice under visibleFrom/hiddenFrom.' },
    schema: [],
  },
  create(context) {
    if (isTestFile(context)) return {}
    const owner = createControlOwnerProbe()
    const twins = []

    const inspectChildren = (node) => {
      const children = (node.children ?? []).filter((child) => child.type === 'JSXElement')
      for (let i = 0; i < children.length; i++) {
        for (let j = i + 1; j < children.length; j++) {
          const a = children[i]
          const b = children[j]
          const visibleA = breakpointAttr(a, 'visibleFrom')
          const hiddenA = breakpointAttr(a, 'hiddenFrom')
          const visibleB = breakpointAttr(b, 'visibleFrom')
          const hiddenB = breakpointAttr(b, 'hiddenFrom')
          const paired =
            (visibleA !== undefined && visibleA === hiddenB) ||
            (hiddenA !== undefined && hiddenA === visibleB)
          if (!paired) continue
          const tagsA = subtreeControlTags(a)
          if (tagsA.size === 0) continue
          const shared = [...subtreeControlTags(b)].some((tag) => tagsA.has(tag))
          if (!shared) continue
          twins.push(b)
        }
      }
    }

    return {
      ...owner.visitors,
      JSXElement: inspectChildren,
      JSXFragment: inspectChildren,
      'Program:exit'() {
        if (owner.state.definesControl) return
        for (const node of twins) {
          if (hasThemeAllow(context, node, 'responsive-twin')) continue
          context.report({ node, message: RESPONSIVE_TWIN_MESSAGE })
        }
      },
    }
  },
}

// ── Rule 22 — search-literal-link ───────────────────────────────────────────────────────────────

/** The two calls that build a typed nav definition — `search:` inside one is a nav link's search. */
const NAV_DEFINITION_CALLEES = new Set(['defineNav', 'navGroup'])

const SEARCH_LITERAL_LINK_MESSAGE =
  "Object literal as a nav link's `search` — it PINS those values on every click, so a nav link " +
  'always navigates back to the fallback and the persisted selection is silently discarded (law ' +
  "C10; argo's reader had zero call sites because of exactly this). Pass `store.linkSearch` BY " +
  'REFERENCE instead — never a literal, never `search: true`, never a global link callback. ' +
  '(basalt/search-literal-link)'

/** True when `node` sits inside a `defineNav()` / `navGroup()` argument. */
function insideNavDefinition(node) {
  let current = node.parent
  for (let depth = 0; current !== null && current !== undefined; depth++) {
    if (depth > ANCESTRY_MAX_DEPTH || current.type === 'Program') return false
    if (
      current.type === 'CallExpression' &&
      current.callee?.type === 'Identifier' &&
      NAV_DEFINITION_CALLEES.has(current.callee.name)
    ) {
      return true
    }
    current = current.parent
  }
  return false
}

const searchLiteralLink = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Warn on a `search:` object literal inside defineNav/navGroup.' },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee?.type !== 'Identifier' || node.callee.name !== 'linkOptions') return
        const arg0 = node.arguments?.[0]
        if (arg0 === undefined || arg0.type !== 'ObjectExpression') return
        for (const prop of arg0.properties) {
          if (prop.type !== 'Property' || propertyKeyName(prop) !== 'search') continue
          if (prop.value?.type !== 'ObjectExpression') continue
          if (!insideNavDefinition(node)) continue
          if (hasThemeAllow(context, prop, 'search-literal-link')) continue
          context.report({ node: prop, message: SEARCH_LITERAL_LINK_MESSAGE })
        }
      },
    }
  },
}

// ── Rule 23 — use-search-from-literal ───────────────────────────────────────────────────────────

const USE_SEARCH_FROM_LITERAL_MESSAGE =
  "useSearch({ from: '<route>' }) — a `from` literal pins the reader to ONE route id, so the same " +
  'component throws the moment it renders on a sibling or child route. A store field reads ' +
  '`useSearch({ strict: false })` internally, which sees the merged search of every matched route ' +
  '(law C10) — take the value as a prop, or read it through the store field. ' +
  '(basalt/use-search-from-literal)'

const useSearchFromLiteral = {
  meta: {
    type: 'suggestion',
    docs: { description: "Warn on useSearch({ from: '<literal>' })." },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee
        const name =
          callee?.type === 'MemberExpression' ? callee.property?.name : (callee?.name ?? undefined)
        if (name !== 'useSearch') return
        const arg0 = node.arguments?.[0]
        if (arg0 === undefined || arg0.type !== 'ObjectExpression') return
        for (const prop of arg0.properties) {
          if (prop.type !== 'Property' || propertyKeyName(prop) !== 'from') continue
          if (!isStringLiteral(prop.value)) continue
          if (hasThemeAllow(context, prop, 'use-search-from-literal')) continue
          context.report({ node: prop, message: USE_SEARCH_FROM_LITERAL_MESSAGE })
        }
      },
    }
  },
}

// ── Grace ledger ────────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {{ since: string; promote: string; why: string }} GraceEntry
 * @typedef {{ since: string; why: string }} AdvisoryEntry
 */

/**
 * Plugin rules still inside their grace minor — `warn` in the shipped consumer preset, `error`
 * repo-locally. This is the plugin's counterpart to `src/guard`'s `GRACE_PERIOD_KINDS`, and it
 * exists because its ABSENCE is what let three rules sit at `warn` for up to twelve minors with
 * nothing tracking them: `configs/oxlint.json` is generated and its top-level keys are fixed by
 * oxlint's own parser, so the ledger cannot live there.
 *
 * `oxlint-plugin.test.ts` asserts the two agree in both directions — a rule listed here or in
 * {@link PLUGIN_RULE_ADVISORY} must be `warn` in the shipped preset, and one absent from both must
 * be `error`. Deleting a `PLUGIN_RULE_GRACE` entry IS the promotion, and the test makes the config
 * change mandatory in the same commit.
 *
 * Each entry is `{ since, promote, why }` (semver strings, C16 — `docs/CONTROLS-SPEC.md` §1): a
 * version-gated test fails the build once `package.json`'s version reaches `promote` while the
 * entry is still here — the four entries that used to live here (D4) sat at `warn` for up to five
 * minors because a bare promotion-note string carried no expiry a test could check.
 *
 * @type {Record<string, GraceEntry>}
 */
export const PLUGIN_RULE_GRACE = {
  'control-outside-home': {
    since: '1.28.0',
    promote: '1.29.0',
    why:
      'the wave-6 control guards (docs/CONTROLS-SPEC.md §6). The one openly HEURISTIC rule of the ' +
      'set — "this control has no home" is a claim about layout intent, so its false-positive load ' +
      'is carried by three exemptions (overlay/settings-row ancestor, @mantine/form, owner ' +
      'definition) rather than by certainty. Promotion is additionally gated on running the ' +
      'shipped preset over argo, linewatch, image-share, rb, image-gen and the playground with ≤3 ' +
      'total waivers (§9 wave 7); the spec dated it 1.28.0, which is the minor it SHIPS in, so the ' +
      'gate would have fired on the release commit.',
  },
  'control-size-literal': {
    since: '1.28.0',
    promote: '1.29.0',
    why:
      'the wave-6 control guards (docs/CONTROLS-SPEC.md §6). Rejects a prop that was correct one ' +
      'minor ago — every `size="xs"` written into a bar before the tier existed — so it takes the ' +
      'grace minor the doctrine exists for. The spec dated it 1.27.0 when waves 3/4 were expected ' +
      'to carry it; it lands in 1.28.0, so the promote moves with it (a promote at the shipping ' +
      'version fails the C16 gate on the release commit itself).',
  },
  'in-body-page-title': {
    since: '1.28.0',
    promote: '1.29.0',
    why:
      'the wave-6 control guards (docs/CONTROLS-SPEC.md §6, law C8). Its text-level twin is the ' +
      'guard kind of the SAME id, which carries the same dates in GRACE_PERIOD_KINDS — one law, ' +
      'two lanes, one promotion. Warn because an in-body h1/h2 is a judgement about which name ' +
      'the page already has, and the fix is a route/breadcrumb change rather than a prop edit.',
  },
  'responsive-twin': {
    since: '1.28.0',
    promote: '1.29.0',
    why:
      'the wave-6 control guards (docs/CONTROLS-SPEC.md §6, law C9 — linewatch shipped three ' +
      'doubled controls). Warn for one minor because the fix is a real edit (delete one mount, ' +
      'move the swap into the control), not a prop removal, and the pair test is a heuristic over ' +
      'sibling structure.',
  },
  'search-literal-link': {
    since: '1.28.0',
    promote: '1.29.0',
    why:
      'the wave-6 control guards (docs/CONTROLS-SPEC.md §6, law C10 — argo nav.tsx:132 pinned the ' +
      'fallback on every click, which is why its reader had zero call sites). Warn for one minor ' +
      'because the fix needs a store to exist at the call site, which is a wave-2 dependency for ' +
      'consumers still on the old enum-only pair.',
  },
  'use-search-from-literal': {
    since: '1.28.0',
    promote: '1.29.0',
    why:
      'the wave-6 control guards (docs/CONTROLS-SPEC.md §6, law C10). Same runway as ' +
      'search-literal-link and for the same reason: the remedy is `createSearchStore` + a prop, ' +
      'so a consumer needs the wave-2 store before the finding is actionable.',
  },
}

/**
 * Plugin rules that stay `warn` in the shipped preset PERMANENTLY — outside the C16 version gate,
 * and not expected to ever promote. `oxlint-plugin.test.ts` still requires `warn` in the shipped
 * preset and a `why` long enough to justify it, but skips these when checking `promote`.
 *
 * `shadow-basalt-export` is the one entry: a name collision is strong evidence a component was
 * forked rather than imported, but not proof, and renaming the fork defeats the check outright — so
 * there is no version at which flipping it to `error` is safe to promise in advance.
 *
 * @type {Record<string, AdvisoryEntry>}
 */
export const PLUGIN_RULE_ADVISORY = {
  'shadow-basalt-export': {
    since: '1.20.0',
    why:
      'new in the round-4 guard minor (1.20.0), widened in round-5 (1.21.0 — reads every ' +
      'published barrel, not just the root one, so a chart-layer fork is visible), narrowed at ' +
      '1.22.0 (`isBasaltScopedFile` plus a component-shaped declaration). A name collision is ' +
      'strong evidence and not proof, and renaming defeats it outright, so this stays a permanent ' +
      'warn rather than a grace entry with no honest promote date.',
  },
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
    'hand-rolled-filter': handRolledFilter,
    'control-outside-home': controlOutsideHome,
    'control-size-literal': controlSizeLiteral,
    'page-bar-budget': pageBarBudget,
    'in-body-page-title': inBodyPageTitle,
    'responsive-twin': responsiveTwin,
    'search-literal-link': searchLiteralLink,
    'use-search-from-literal': useSearchFromLiteral,
    'visx-boundary': visxBoundary,
    'visx-tooltip': visxTooltip,
    'token-layer-boundary': tokenLayerBoundary,
    'agent-resume-guard': agentResumeGuard,
    'agent-no-raw-usechat': agentNoRawUseChat,
    'ai-sdk-major': aiSdkMajor,
  },
}
