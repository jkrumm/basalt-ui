/**
 * ./guard — headless policy core. Mantine-free, dependency-free.
 *
 * GUARD_RULES: the closed registry of all 27 violation kinds.
 * checkSource:  pure (text, relPath, cfg) → Finding[]. No FS, no walk, no console.
 */
import type { Finding, GuardConfig, GuardKind, GuardSeverity } from './types'

export type { Finding, GuardConfig, GuardKind, GuardSeverity }

// ── Static regex consts ──────────────────────────────────────────────────────────────────────────

/**
 * A raw hex color literal.
 *
 * The `(?!(?<=&#)\d+;)` guard drops an HTML NUMERIC CHARACTER REFERENCE. `&#123;` is the escaped
 * `{` and `&#125;` the escaped `}` — the two an Astro/JSX template writes to show a literal brace
 * in prose — and their `#123` / `#125` read as three-digit hex. It is not markup-specific: the same
 * string produced the same two findings in `.html`, `.tsx`, `.css` and `.vue`, so this was a hole
 * in the kind itself that `.astro` merely walked into first (rollhook, round 9).
 *
 * The lookahead is deliberately the FULL reference — `&#`, digits, `;` — not a bare `(?<!&)`. Only
 * the decimal form can collide at all (`&#x1F600;` never matches: `x` is not a hex digit), and a
 * `#` that follows an `&` without terminating in `;` is not an entity, so `color: red&#fff` still
 * flags. Nothing is exempted by file type; a real `#ff0000` in an `.astro` file fires exactly as it
 * does in a `.tsx` one.
 *
 * The sibling raw-text kinds do NOT share this blind spot, and the reason is structural rather than
 * lucky: a character reference contains no `(`, so `raw-color-fn`'s `rgba?|hsla?\(` anchor cannot
 * occur inside one, and every other raw-text kind is anchored on a property name, `var(`, or a JSX
 * `=`. Probed across `.html`/`.astro`/`.tsx` over 20 entity shapes — `raw-hex` was the only kind
 * that fired.
 *
 * Known and NOT covered, because the fix would cost real findings: an all-hex URL fragment or SVG
 * reference (`href="#cafe"`, `fill="url(#abcdef)"`) is indistinguishable from a color by text
 * alone, and both still report. `theme-allow` is the escape there.
 */
const HEX = /#(?!(?<=&#)\d+;)[0-9a-fA-F]{3,8}\b/g

/**
 * A raw `rgb()`/`rgba()`/`hsl()`/`hsla()` color function.
 *
 * The `(?!\s*\$\{)` guard drops a call whose FIRST channel is a `${…}` interpolation — that is a
 * color being COMPUTED, not chosen: an imaging app reporting a sampled pixel
 * (`` `rgb(${px[0]}, ${px[1]}, ${px[2]})` ``), a debug log quoting one, a readout label. There is
 * no token that could be correct for a measurement, and the three cases image-gen reported were
 * all this shape. A literal first channel (`rgba(0, 0, 0, ${o})`) is still a hardcoded color with
 * a variable alpha, and still flags — `alpha(token, a)` is exactly the escape for it.
 */
const FUNC = /\b(?:rgba?|hsla?)\((?!\s*\$\{)/g
const LOCALSTORAGE_THEME = /localStorage\s*\.\s*getItem\s*\(\s*['"]theme['"]\s*\)/g

// A hardcoded fontFamily/font-family literal — camelCase (JSX prop / object property, quoted
// value) or kebab-case (CSS text in a template literal, quoted OR bare value — kebab-case is never
// a valid unquoted JS identifier, so a bare `font-family: Inter` can only be literal CSS text).
// The escape is ANY `var(--…)` reference. It used to be restricted to the two entry-point prefixes
// (`--basalt-font-*` / `--mantine-font-family-*`), which reported `font-family: var(--font-sans)`
// — a variable REFERENCE — as "a hardcoded fontFamily literal", with a fix pointing at the
// React-only `createBasaltTheme`. A framework-free consumer defining its own custom property IS
// routing through a variable; the single-entry-point invariant is a doctrine for basalt's own
// theme layer, not something this regex can tell apart from a legitimate consumer indirection.
// A CSS-wide keyword (inherit/initial/unset/revert) never flags either: it defers to the cascade
// rather than hardcoding a font.
const RAW_FONT_FAMILY_VAR_ESCAPE = /var\(\s*--/.source
const RAW_FONT_FAMILY_KEYWORD = /(?:inherit|initial|unset|revert)\b/.source
const RAW_FONT_FAMILY = new RegExp(
  `\\bfontFamily\\s*[:=]\\s*\\{?(?!['"\`]?\\s*${RAW_FONT_FAMILY_VAR_ESCAPE})(?!['"\`]?\\s*${RAW_FONT_FAMILY_KEYWORD})['"\`][^'"\`]+['"\`]` +
    `|\\bfont-family\\s*:\\s*(?!['"\`]?\\s*${RAW_FONT_FAMILY_VAR_ESCAPE})(?!['"\`]?\\s*${RAW_FONT_FAMILY_KEYWORD})(?:['"\`][^'"\`]+['"\`]|[A-Za-z][\\w-]*)`,
  'g',
)

// Ad-hoc inline surface styling — border* / borderRadius / boxShadow with literal values.
// Three escapes pass (the value is already system-routed, not a hardcoded surface literal):
//   • a `var(--…)` reference — the CSS-var system itself;
//   • a `${…}` template-literal interpolation — the value is JS-composed, typically from `VX.*`
//     tokens; any raw color inside it is separately caught by raw-hex / raw-color-fn;
//   • for `border*` only, a bare `none`/`transparent`/`inherit`/`unset`/`revert` keyword — a reset,
//     not a surface definition.
const SURFACE_BORDER =
  /\bborder(?:Top|Bottom|Left|Right)?\s*:\s*(?!['"`]?[^'"`]*(?:var\(|\$\{))(?!['"`]?(?:none|transparent|inherit|unset|revert)\b)['"`][^'"`]+['"`]/g
const SURFACE_RADIUS = /\bborderRadius\s*:\s*(?:[0-9]+|['"`](?!\s*var\()[^'"`]*[0-9])/g

/**
 * A `boxShadow` / `box-shadow` declaration with its whole value captured, so the value can be
 * JUDGED rather than merely pattern-excluded.
 *
 * The old `SURFACE_SHADOW` skipped any value containing `var(` or `${`, which reads as "already
 * system-routed" and is wrong for the shape a token-fluent consumer actually writes:
 * `` boxShadow: `0 0 0 2px ${VX.accent}` `` on a `Paper` is built entirely from tokens and still
 * REPLACES `--vx-shadow-card`, leaving that one card with no depth while every other card in the
 * app has it. Composing WITH card depth (`` `${VX.shadowCard}, 0 0 0 1px …` ``) is the legitimate
 * shape and the one this must not touch — so the discriminator is whether the value still names
 * card depth, not whether it contains a token at all. See `surface-shadow-override`.
 */
const SHADOW_DECL = /\b(?:boxShadow|box-shadow)\s*:\s*(['"`])((?:[^'"`\\]|\\.)*)\1/g
/** A shadow value that still carries basalt's card depth — composes with it rather than replacing it. */
const SHADOW_KEEPS_CARD_DEPTH = /--vx-shadow-|\bVX\.shadow/
/** A shadow value routed through SOME variable/interpolation (vs. a hardcoded literal). */
const SHADOW_IS_COMPOSED = /var\(|\$\{/

/**
 * The kebab-case surface literals a CSS Module writes. `raw-surface` is camelCase-only — the TSX
 * inline-style dialect — so `border-radius: 4px` beside a flagged `borderRadius: 2` was invisible.
 * `src/guard/index.ts`'s `INLINE_SPACING` records that the same asymmetry was deliberately fixed
 * for spacing; this is that fix for the surface kinds.
 *
 * Reaching CSS is a NEW file type for these checks, so they land under their own kind
 * (`css-raw-surface`, warn for one minor) instead of widening `raw-surface` — see
 * {@link GuardSeverity}. `border`/`border-top` are deliberately NOT covered: nearly every CSS
 * module in every consumer declares one, and the token answer (`var(--vx-surface-border)`) is a
 * COLOR, not a whole shorthand, so the rule would be advice nobody can act on line-by-line.
 */
const CSS_SURFACE_RADIUS = /(?<![\w-])border-radius\s*:\s*([^;}]+)/g
const CSS_SURFACE_SHADOW = /(?<![\w-])box-shadow\s*:\s*([^;}]+)/g

/** The largest CSS radius literal treated as a sub-scale micro-corner, in px — below the 4px floor. */
const MICRO_RADIUS_CEILING_PX = 3
/** Radius values that name a SHAPE rather than a surface corner — a circle and the pill idiom. */
const SHAPE_RADIUS_VALUES = new Set(['50%', '9999px', '999px', '100%'])

/**
 * Is this `border-radius` value already system-routed or sub-scale? `var(...)` components are
 * dropped first (same treatment as `isSubScaleCssSpacing`), then a value survives when every
 * remaining literal is a shape keyword or a length at/below {@link MICRO_RADIUS_CEILING_PX}.
 */
function isAllowedCssRadius(value: string): boolean {
  const rest = value.replace(/var\([^)]*\)/g, ' ').trim()
  if (rest === '') return true
  return rest.split(/\s+/).every((part) => {
    if (SHAPE_RADIUS_VALUES.has(part)) return true
    const literal = /^[-+]?(\d+(?:\.\d+)?|\.\d+)(px|rem)?$/.exec(part)
    if (literal === null) return false
    const px = literal[2] === 'rem' ? Number(literal[1]) * ROOT_FONT_SIZE_PX : Number(literal[1])
    return px <= MICRO_RADIUS_CEILING_PX
  })
}

/**
 * An inline `fontSize` / `font-size` literal — the `check-theme` counterpart to the oxlint plugin's
 * `basalt/no-raw-font-size`. A consumer whose CI runs only `check-theme` (the documented
 * `configs/check.yml` step) never saw a `style={{ fontSize: 11 }}` at all.
 *
 * Unitless integers and `px` only, matching React's inline-style convention and CSS's absolute
 * form. `rem`/`em`/`%` are deliberately out: they are ratios against something else, and the type
 * scale has no opinion on a relative step.
 */
// The `(?<![\w-;])` guard is what keeps this out of query strings and URL fragments: argo builds a
// Static Maps legend as `…;fontSize:10;dpi:96`, which is a REMOTE renderer's parameter, not a type
// choice, and no `--vx-text-*` could be correct for it. A declaration written by a formatter always
// has whitespace or an opening brace in front of the property; a packed key/value string does not.
const INLINE_FONT_SIZE =
  /(?<![\w-;])font-?[Ss]ize\s*:\s*['"]?(\d+(?:\.\d+)?)(?:px)?['"]?(?=[,;\s}]|$)/g

// A `Card` / `Paper` opening tag carrying `withBorder`. Card depth is `--vx-shadow-card`, whose 1px
// ring lives INSIDE the shadow value; `withBorder` therefore adds a SECOND, real `border` property
// on top of it (the theme's `styles.root` pins bg/shadow/radius but never clears `border`), and the
// card reads heavy/boxed. Bounded full-text tag scan, same shape as CHART_ENTRY_POINT_TAG below, so
// a multi-line-formatted tag still resolves to one match.
//
// Two deliberate non-matches:
//   • `<Card.Section withBorder>` — a section DIVIDER, not card depth. Excluded by the `(?![\w.])`
//     lookahead, which also rejects `<CardHeader>`-style names.
//   • `withBorder={false}` — an explicit opt-out (what the shell's AppShell parts do). Excluded by
//     the lookahead on WITH_BORDER_PROP.
const CARD_SURFACE_TAG = /<(?:Card|Paper)(?![\w.])(?:=>|[^>])*?>/g
const WITH_BORDER_PROP = /\bwithBorder\b(?!\s*=\s*\{\s*false\s*\})/

// Raw Mantine ramp step used for surface color — gray/dark + a step digit.
const OFF_SYSTEM_SURFACE_VAR = /var\(--mantine-color-(gray|dark)-\d/g

// A SHADE-PINNED Mantine color: the dotted JSX form (`c="yellow.7"`) or the var() form
// (`var(--mantine-color-red-6)`). Both name one fixed swatch that does NOT flip across color
// schemes — see the `mantineShadeIndex` doc in guard/types.ts for why the bare hue name is fine and
// the pinned step is not.
//
// The var() half deliberately excludes gray-/dark-, which `off-system-surface-var` already owns, so
// a surface violation reports once under one kind rather than twice under two.
//
// The JSX half is prop-shaped (`c="yellow.7"` needs the `=`), which CSS text has no syntax for, so
// it cannot fire in a `.css` file; the var() half is a real violation in CSS and is meant to fire
// there. That split is why this kind, unlike its prop-only neighbours, carries no `appliesTo` gate.
const MANTINE_SHADE_INDEX =
  /\b(?:color|c|bg|backgroundColor|borderColor)\s*=\s*\{?\s*['"][a-z]+\.\d\b|var\(--mantine-color-(?!gray-|dark-)[a-z]+-\d/g

/**
 * A raw lowercase JSX layout/surface element's own OPENING TAG — bounded full-text scan, the same
 * shape `CARD_SURFACE_TAG` uses.
 *
 * This kind used to be a three-condition conjunction evaluated per LINE, so the identical
 * violation was reported or not depending purely on how the formatter had broken the tag:
 * `<div style={{ position: 'relative', … }}>` on one line fired, while the same `<div>` with
 * `className=` and `style=` on separate lines did not. `card-with-border` already had the answer.
 */
const RAW_HTML_TAG_NAME = '<(?:div|span|section|header|nav|footer|aside|main|article|ul|ol)\\b'
const RAW_HTML_TAG = new RegExp(RAW_HTML_TAG_NAME)
const RAW_HTML_LAYOUT_TAG = new RegExp(`${RAW_HTML_TAG_NAME}(?:=>|[^>])*?>`, 'g')
const INLINE_STYLE = /style=\{\{/
/** `style={someStyleConst}` — the hoisted form that defeats every text-local check. */
const STYLE_IDENTIFIER = /style=\{\s*([A-Za-z_$][\w$]*)\s*\}/
const LAYOUT_SURFACE_PROP =
  /\b(?:display|padding|margin|gap|flex|grid|border|background|width|height)\b/

/**
 * The object body of a `const <name> = { … }` declaration, or `''` when there is none.
 *
 * Hoisting the style object out of the tag (`const wrapperStyle: CSSProperties = {…}` then
 * `style={wrapperStyle}`) is the general escape from every text-local kind, and it is what a
 * formatter nudges people toward. One non-nested lookup closes the common case; a style object
 * assembled across statements is out of reach of a regex scanner and stays out of reach.
 */
function hoistedObjectBody(codeText: string, name: string): string {
  // `name` comes from source text and reaches a RegExp — a `$`-prefixed identifier is legal JS and
  // is an anchor in a pattern, so it gets escaped rather than trusted.
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const decl = new RegExp(`\\b(?:const|let|var)\\s+${escaped}\\b[^=;]*=\\s*\\{([^}]*)\\}`).exec(
    codeText,
  )
  return decl?.[1] ?? ''
}

// Spacing/sizing literals — anchored on the property name; `var()` and a plain `0` pass.
//
// Composed rather than written out because it must cover BOTH spellings of the same property: the
// camelCase form a TSX inline style uses (`paddingInlineStart`) and the kebab form CSS uses
// (`padding-inline-start`). Enumerating one and not the other is how `padding: 18px` came to flag in
// a CSS module while `padding-top: 18px` beside it did not — a distinction shaped by regex history
// rather than by any decision, and invisible from the author's seat.
//
// Case-insensitivity would be the short way to unify them and is deliberately not used: it would
// also match `Padding`/`PADDING`, neither of which is a property in either dialect.
const BOX_SIDE = '(?:Top|Bottom|Left|Right|Block|Inline)(?:Start|End)?'
const BOX_SIDE_KEBAB = '(?:top|bottom|left|right|block|inline)(?:-(?:start|end))?'
const SPACING_PROP = `(?:padding|margin)(?:${BOX_SIDE}|-${BOX_SIDE_KEBAB})?|gap|rowGap|columnGap|row-gap|column-gap`
// A bare `0` needs no unit and no token, so it is never a finding — but the guard for it has to
// stop at the zero ITSELF. `(?!0\b)` did not: `\b` sits between `0` and `.`, so every value
// starting `0.` matched the guard and dropped out of the scan entirely. `0.75rem` is 12px, a real
// spacing value, and it was invisible. `(?!0(?![.\d]))` excuses only a zero that ends there.
//
// The property is preceded by `(?<![\w-])`, not `\b`: a `\b` boundary sits inside a hyphenated
// identifier, so every custom property whose NAME ends in a spacing word — the token layer's own
// `--vx-space-article-header-padding-bottom`, a consumer's `--card-padding-inline` — matched as if
// it were a declaration. A custom property is a definition, not a rendered spacing decision.
//
// The number does two things at once. CSS lets a value carry an explicit `+` and omit the integer
// part, so `.75rem` and `+12px` are the same spacing as `0.75rem` and `12px`; requiring a leading
// digit skipped both — the same silent-skip the zero guard above was fixed for, one spelling over.
//
// But admitting a fractional part also admits values that are not lengths at all. A UNITLESS
// fraction is never a spacing literal: `padding: 4` in an inline style is 4px by React's convention,
// while `padding: 0.3` is a RATIO — visx's band padding (`scalePoint({ padding: 0.3 })`) found this,
// ten times over in one consumer, and the guard's own advice ("use p/m/gap with xs..xl") is
// meaningless for it. So the discriminator is the UNIT, not the digit shape: a fraction must carry
// one (`.75rem`), and a unitless number must be an integer (`padding: 4` — still 4px, still a
// finding). `0.3` matches neither and drops out. `(?=[a-z%])` covers every CSS unit without
// enumerating them, and the sign stays outside so the zero guard still sees `-0` as a zero.
const SPACING_NUMBER = '(?:\\d*\\.\\d+(?=[a-z%])|\\d+(?!\\.\\d))'
const INLINE_SPACING = new RegExp(
  `(?<![\\w-])(?:${SPACING_PROP})\\s*:\\s*(?!var\\()['"]?[-+]?(?!0(?![.\\d]))${SPACING_NUMBER}`,
  'g',
)

/**
 * The sub-scale micro-spacing ceiling, in px — the largest literal `inline-spacing` tolerates in a
 * CSS file. Below the smallest spacing scale stop (`SPACE_SCALE.xs`), which is the whole point: a
 * value under that stop has NO token to prefer, so flagging it asks for something that does not
 * exist. Pinned against the real scale by `check-source.test.ts` so a density retune of the ladder
 * cannot leave this stranded above it.
 *
 * Deliberately CSS-ONLY. In TSX the same shape means something different: `pl={4}` is a Mantine
 * PROP and never matches this pattern in the first place, while `style={{ paddingLeft: 4 }}` does —
 * and there the finding is right, because the prop form exists and should have been used. In CSS
 * there is no prop form, and the emitted `--vx-space-*` set is basalt's own component one-offs
 * (`--vx-space-toc-sub-indent`), not a consumer surface. Without this escape a consumer's CSS
 * module had no legal way to write a 4px cluster gap: no token to reach for, `theme-allow` on every
 * line (which `basalt-tokens.md` explicitly warns against), or `exemptRules` — which at the time
 * matched whole path segments only and so could not express `*.module.css` (it can now, see
 * `exemptPatternMatches`; the escape stays because a per-file exemption is still the wrong shape
 * for a value that has no token).
 */
const MICRO_SPACING_CEILING_PX = 10

/**
 * Object-literal openers that make the properties under them CSS.
 *
 * A UNITLESS spacing number is only a length by React's inline-style convention, and that
 * convention only holds inside a style object. `const FIT_BOUNDS_OPTIONS = { padding: 48, duration:
 * 0 }` is a maplibre viewport inset measured in MAP pixels — there is no Mantine token that could
 * express it, and "use p/m/gap with xs..xl" is not a thing that can be done to it. The same shape
 * arrives from every canvas/map/layout library a consumer wraps, so this is a class, not a case.
 *
 * A value carrying a UNIT (`'12px'`, `1.5rem`) is exempt from this test entirely — a unit IS the
 * evidence that the number is CSS, wherever it was written.
 */
/** `style={{`, `styles={{`, `sx={{`, `css={{` — the object under it IS CSS by construction. */
const STYLE_ATTRIBUTE_OPENER = /\b(?:style|styles|sx|css)\s*=\s*\{?\s*$/

/** `const wrapperStyle: CSSProperties = {` — the hoisted form; name and type are both evidence. */
const OBJECT_DECLARATION = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::([^=]*))?=\s*$/

/** A name that says "these are styles" on its own, without a `style={…}` use site to confirm it. */
const STYLE_OBJECT_NAME = /(?:Style|Styles|Css)$|^(?:style|styles|css|sx)$/

/** A type annotation that says the same thing — `CSSProperties`, `CSSObject`, `MantineStyleProp`. */
const STYLE_OBJECT_TYPE = /\bCSS(?:Properties|Object)\b|\bStyle(?:s|Prop)?\b/

/** `style={someStyleConst}` / `styles={parts}` — collected file-wide, so a hoisted object is known. */
const STYLE_BOUND_IDENTIFIER = /\b(?:style|styles|sx|css)=\{\s*([A-Za-z_$][\w$]*)\s*\}/g

/** A property key introducing a nested object — `input: {`, `'&:hover': {`, `root: {`. */
const NESTED_OBJECT_KEY = /(?:[\w$]+|'[^']*'|"[^"]*"|\[[^\]]*\])\s*:\s*$/

/** How far back {@link isStyleObjectContext} walks before giving up. Bounded so a huge file can't stall. */
const MAX_STYLE_CONTEXT_SCAN = 4000

/**
 * Is the match at `at` inside an inline-style object literal?
 *
 * Walks out through enclosing `{` openers (a nested part like `styles={{ input: { … } }}` keeps
 * walking) and asks what introduced the outermost one: a style ATTRIBUTE, or a `const` whose name
 * says styles or which some `style={…}` in the file binds. Everything else — a call argument, an
 * options bag, a plain record — is not CSS.
 *
 * Consulted only for a UNITLESS number, where the alternative is reporting a violation with no
 * possible remedy. A value carrying a unit is CSS wherever it was written and never reaches here.
 */
function isStyleObjectContext(
  codeText: string,
  at: number,
  styleIdentifiers: ReadonlySet<string>,
): boolean {
  let depth = 0
  const stop = Math.max(0, at - MAX_STYLE_CONTEXT_SCAN)
  for (let i = at - 1; i >= stop; i--) {
    const ch = codeText[i]
    if (ch === '}') depth++
    else if (ch === '{') {
      if (depth > 0) {
        depth--
        continue
      }
      const before = codeText.slice(Math.max(0, i - 120), i)
      if (STYLE_ATTRIBUTE_OPENER.test(before)) return true
      const declaration = OBJECT_DECLARATION.exec(before)
      if (declaration !== null) {
        const [, name = '', annotation = ''] = declaration
        return (
          STYLE_OBJECT_NAME.test(name) ||
          STYLE_OBJECT_TYPE.test(annotation) ||
          styleIdentifiers.has(name)
        )
      }
      // `{{` — a JSX expression container around the style object; keep walking out to the `=`.
      if (before.endsWith('{')) continue
      // A nested style part (`styles={{ input: { … } }}`) — the key names a part, not a context.
      if (NESTED_OBJECT_KEY.test(before)) continue
      return false
    }
  }
  return false
}

/** The root font size `rem` values resolve against — the same 16 the token layer's `pxRem` uses. */
const ROOT_FONT_SIZE_PX = 16

/**
 * Is this CSS declaration entirely sub-scale? True when every literal in the value is a bare px (or
 * unitless) number at or below {@link MICRO_SPACING_CEILING_PX}. `var(...)` components are dropped
 * before the check — a value that mixes a token with a micro literal (`padding: 4px var(--x)`) is
 * already tokenized where it counts.
 *
 * Multi-value shorthands are judged as a whole: `padding: 4px 8px` passes, `padding: 4px 16px` does
 * not — the 16 has a scale stop and should use it.
 *
 * `rem` is resolved against the 16px root, the same conversion `pxRem` in the token layer applies,
 * so `0.25rem` and `4px` get the same answer. Writing the identical spacing two ways and having the
 * guard accept one is the same arbitrariness the kebab gap produced. Units that cannot be resolved
 * to px without layout context — `em`, `%`, `ch`, `vw` — are not micro-spacing claims and still
 * flag.
 */
function isSubScaleCssSpacing(line: string, matchIndex: number): boolean {
  const colon = line.indexOf(':', matchIndex)
  if (colon === -1) return false
  const rest = line.slice(colon + 1)
  const end = rest.search(/[;}]/)
  const value = (end === -1 ? rest : rest.slice(0, end)).replace(/var\([^)]*\)/g, ' ').trim()
  if (value === '') return true
  return value.split(/\s+/).every((part) => {
    const literal = /^[-+]?(\d+(?:\.\d+)?|\.\d+)(px|rem)?$/.exec(part)
    if (literal === null) return false
    const px = literal[2] === 'rem' ? Number(literal[1]) * ROOT_FONT_SIZE_PX : Number(literal[1])
    return px <= MICRO_SPACING_CEILING_PX
  })
}

// display:flex/grid/inline-flex/inline-grid in an inline style.
const INLINE_DISPLAY = /\bdisplay\s*:\s*['"](?:inline-)?(?:flex|grid)['"]/g

// Raw visx axis JSX — only inside chart files, not in the Axes.tsx wrapper.
const RAW_VISX_AXIS = /<Axis(?:Left|Bottom|Right)\b/g
const AXIS_WRAPPER_FILE = /(?:^|\/)Axes\.tsx$/

// radius prop with a numeric literal (module-level so it is not re-created per call).
const RADIUS_PROP_RE = /\bradius=(?:\{[0-9]+\}|"[0-9]+")/g

// Hardcoded motion transition params — a duration/spring/ease literal inline in `transition={{}}`
// instead of the shared MOTION_DURATION / MOTION_SPRING / MOTION_EASE_STANDARD tokens.
const MOTION_TRANSITION_NUMERIC =
  /\btransition\s*=\s*\{\{[^}]*\b(?:duration|stiffness|damping|mass)\s*:\s*-?\d/g
const MOTION_TRANSITION_EASE_ARRAY = /\btransition\s*=\s*\{\{[^}]*\bease\s*:\s*\[/g

// A hand-rolled <ChartLegend items={[ …array literal… ]}> — legend entries authored inline
// instead of derived (`items={deriveLegend(series)}`, a call expression, which must NOT match).
// Scoped to the JSX tag itself ([^>]* is bounded by the tag's own closing `>`, which also makes
// this a full-text scan rather than the per-line style every other kind uses — a multi-line-
// formatted <ChartLegend ...\n  items={[...\n/> still resolves to one match). Bounded scans over
// text this small are not a performance concern.
const RAW_CHART_LEGEND_ARRAY = /<ChartLegend\b[^>]*?\bitems\s*=\s*\{\s*\[/g

// A chart entry-point JSX tag (the 7 kinds + 2 sparklines) — full opening/self-closing tag,
// scanned for a missing `ariaLabel` prop (an accessible text alternative for the SVG graphic).
// Bounded, full-text scan (like RAW_CHART_LEGEND_ARRAY above) so a multi-line-formatted tag still
// resolves to one match. The scan must survive two `>` decoys inside an opening tag: an explicit
// JSX generic argument (`<MultiLine<Point>`) — consumed by the optional `<[^<>]*>` group — and
// arrow functions in prop expressions (`getX={(d) => d.date}`) — consumed atomically by the `=>`
// alternative so their `>` never terminates the tag early. A bare `>` comparison inside a prop
// expression still ends the match (accepted limitation of the bounded scan).
const CHART_ENTRY_POINT_TAG =
  /<(MultiLine|Bars|BandStrip|Donut|DualPanel|Heatmap|MirroredBars|ZonedLine|StackedArea|LineSparkline|BarSparkline)\b(?:<[^<>]*>)?(?:=>|[^>])*?>/g
const HAS_ARIA_LABEL_PROP = /\bariaLabel\s*=/

// ── Tag provenance, shared by the two chart tag rules ────────────────────────────────────────────
//
// Both `chart-missing-aria-label` and `unframed-chart` key on a JSX tag NAME, which is the whole of
// their signal — so a consumer's OWN component that merely shares a shipped kind's name collected
// the finding too. Reported by a consumer on 1.23.0: a hand-composed local `<MirroredBars>` was
// told to pass an `ariaLabel` prop it does not accept, by a rule that presents as a correctness
// finding rather than as a naming one. `shadow-basalt-export` / `ai-sdk-major` scope through
// `isBasaltScopedFile` (package-level); the analogous file-level signal here is where the name in
// THIS file came from.
//
// The gate is deliberately a one-directional NARROWING: a tag is skipped only when the file DEFINES
// a component of that name and does not also import it from basalt-ui. Everything else still fires
// — a tag imported from basalt-ui, one imported from a consumer barrel that re-exports it (`import
// { MultiLine } from '../charts'`, the shape a downstream component library uses), and one the scan
// cannot attribute at all. Requiring a POSITIVE basalt import instead would have silently switched
// both rules off for every barrel-wrapping consumer and for every file with no import statements —
// a far bigger hole than the false positive it closes.
const LOCAL_COMPONENT_DEF =
  /(?:^|[\n;}])\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Z]\w*)/g
// `from 'basalt-ui'` and every subpath (`basalt-ui/charts`, `basalt-ui/tokens`, …).
const BASALT_NAMED_IMPORT =
  /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]basalt-ui(?:\/[^'"]*)?['"]/g

/** Component-shaped names DEFINED in this file — the provable "not the shipped kind" signal. */
function localComponentNames(codeText: string): ReadonlySet<string> {
  const out = new Set<string>()
  for (const m of codeText.matchAll(LOCAL_COMPONENT_DEF)) out.add(m[1] as string)
  return out
}

/** Names bound in this file by a named import from `basalt-ui` — the local binding, so
 * `{ Bars as BasaltBars }` records `BasaltBars`, which is the name the JSX tag will use. */
function basaltImportedNames(codeText: string): ReadonlySet<string> {
  const out = new Set<string>()
  for (const m of codeText.matchAll(BASALT_NAMED_IMPORT)) {
    for (const raw of (m[1] as string).split(',')) {
      const spec = raw.trim().replace(/^type\s+/, '')
      if (spec.length === 0) continue
      const parts = spec.split(/\s+as\s+/)
      const bound = (parts[parts.length - 1] as string).trim()
      if (bound.length > 0) out.add(bound)
    }
  }
  return out
}

// Raw lowercase form-control element — line-scoped, same shape as RAW_VISX_AXIS. `\b` after the
// tag name rejects a same-prefixed custom component (`<inputRef`, `<selectAll`).
const RAW_FORM_CONTROL = /<(?:input|select|textarea)\b/g

// A raw form-control's own opening tag — bounded full-text scan (same shape as CARD_SURFACE_TAG /
// CHART_ENTRY_POINT_TAG), used ONLY by sub-16-input-font to search the tag's own inline `style`
// for a sub-floor fontSize.
const RAW_FORM_CONTROL_TAG = /<(?:input|select|textarea)\b(?:=>|[^>])*?>/g

// ── Control-home patterns (docs/CONTROLS-SPEC.md §6 — the text lane of laws C1/C8) ──────────────
//
// Bounded full-text tag scans, the CARD_SURFACE_TAG / CHART_ENTRY_POINT_TAG shape: a `<Title>` and a
// `<Select>` are both routinely formatted across lines, so a per-line regex would see neither.

/** A `<Title …>` opening tag, however it is wrapped. `order` is judged separately, on the tag text. */
const PAGE_TITLE_TAG = /<Title(?![\w.])(?:=>|[^>])*?>/g
/** `order={1}` / `order={2}` — the two orders that name a PAGE rather than a section. */
const PAGE_TITLE_ORDER_PROP = /\border\s*=\s*\{\s*([12])\s*\}/

/**
 * A raw Mantine selection control's opening tag — the text-lane twin of the oxlint plugin's
 * RAW_FILTER_TAGS. `Chip.Group` carries a dot, so the name class allows one.
 */
const RAW_SELECTION_CONTROL_TAG =
  /<(SegmentedControl|Select|MultiSelect|NativeSelect|DatePickerInput|DateInput|TagsInput|Chip\.Group)(?![\w])(?:=>|[^>])*?>/g

/**
 * A tag whose presence makes an `order={1|2}` Title a DOCUMENT heading rather than a page title.
 * File-scoped on purpose — see the scan's own comment for why the coarser test is the honest one.
 */
const PROSE_CONTEXT_TAG = /<(?:Prose|ArticleLayout|Modal|Drawer)(?![\w])/

/** An opening tag for one of the declared non-homes — a settings row, an overlay, a composer. */
const CONTROL_HOST_TAG =
  /<(?:SettingsRow|Modal|Drawer|Popover\.Dropdown|Menu\.Dropdown|Composer)(?![\w])/

/**
 * How far ABOVE a control the host-tag window reaches, in lines.
 *
 * The text lane has no ancestry, so "inside a SettingsRow" is approximated by "a SettingsRow opens
 * within the last N lines". 12 covers every row shape in the five consumer repos (label +
 * description + the `control={` line); past that the window would start swallowing the next row's
 * control, which is the direction that makes the kind silent rather than noisy. The plugin rule
 * (`basalt/control-outside-home`) is the one that answers this exactly — this kind exists for the
 * PreToolUse hook lane, which sees one file's TEXT and no AST at all.
 */
const CONTROL_HOST_WINDOW_LINES = 12

/**
 * A file whose BASENAME declares it is an overlay's or a form's own body — the cross-file half of
 * {@link CONTROL_HOST_TAG}, and the same regex the plugin's `OVERLAY_CONVENTION_FILE` applies to
 * `basalt/control-outside-home` (one law, two lanes, one exemption).
 *
 * Law C1's cross-file case is advisory by declaration (`docs/CONTROLS-SPEC.md` §6, "Honest
 * coverage"), and this kind was paying for it: a `<Select>` inside `edit-session-modal.tsx` whose
 * `<Modal>` is rendered by the parent route is outside BOTH the 12-line host window and any
 * ancestry walk, because the host tag is not in the file at all. argo carried 9 of them.
 *
 * The trade is that a whole file goes unscanned on a naming convention — the same bargain
 * {@link MANTINE_FORM_IMPORT} already buys, and a smaller one than promoting the kind with 9 known
 * false positives. Basename only: a `modal/` DIRECTORY holds the page pieces around the modals too.
 */
const OVERLAY_CONVENTION_FILE = /(?:^|\/)[^/]*-(?:modal|drawer|popover|panel|form)\.[jt]sx$/

/** A name whose DECLARATION means this file DEFINES a basalt control rather than consuming one. */
const CONTROL_OWNER_DEF =
  /\b(?:function|const|class)\s+(?:RangeFilter|CompareFilter|SelectFilter|MultiSelectFilter|NumberFilter|SearchFilter|ToggleFilter|ViewTabs|FilterSet|FilterPill|EnumFilter|PanelRow|SliderControl|SyncButton|ActionGroup|OverflowMenu|CtlSlot)(?![\w])/

/** `@mantine/form` — a form is C1's third home, and its inputs are not filters. */
const MANTINE_FORM_IMPORT = /from\s+['"]@mantine\/form['"]/

// A Mantine `styles={{ input: {...} }}` per-part style — the `input` key specifically targets the
// rendered <input>/<textarea> part of TextInput/Select/Textarea/etc. Requires `input` be the FIRST
// key in the styles object (see the sub-16-input-font doc comment for the scoping trade-off this
// implies) so an unrelated object that happens to carry an `input` key elsewhere in consumer code
// is never mistaken for a Mantine per-part style. `[^}]*` stops at the first `}`, i.e. the close of
// the `input` sub-object (or its first nested object) — either way any fontSize inside is still
// genuinely part of the input's own styling.
const STYLES_INPUT_PART = /\bstyles\s*=\s*\{\{\s*input\s*:\s*\{([^}]*)\}/g

// A fontSize/font-size value below the 16px floor. Unitless numbers and an explicit `px` suffix
// both count as px (React inline-style convention); any other unit (rem/em/%) is deliberately NOT
// matched — ambiguous relative to a *px* floor, and matching it would risk a false positive.
const SUB_16_FONT_SIZE = /font-?[Ss]ize\s*:\s*['"]?(-?\d+(?:\.\d+)?)(?:px)?['"]?(?=[,\s}]|$)/g

// ── Defaults ─────────────────────────────────────────────────────────────────────────────────────

/** Default spacing steps (px) flagged as raw spacing props. */
/**
 * The `xs…xl` spacing scale, as raw numbers — what `raw-spacing` flags, because a prop value that
 * EQUALS a step should be written as the token (`p="md"`, not `p={18}`).
 *
 * Mirrors `SPACE_SCALE` at level 0. Kept as a literal rather than imported from `tokens/palette` so
 * the headless guard core stays a single file: it runs on every Write/Edit through the PreToolUse
 * hook, and pulling the palette in would drag `derive.ts` + `hct.ts`'s color math along with it.
 * `check-source.test.ts` asserts the two agree, so the copy cannot drift — which it did: this list
 * still read `[10, 12, 16, 20, 32]` after the level-0 retune, telling consumers to replace `p={16}`
 * with a `p="md"` that resolves to 18.
 *
 * A consumer whose theme moves the scale (`createBasaltTheme({ density })`, or its own overrides)
 * sets `basalt.spacingSteps` in package.json rather than living with this default.
 */
const DEFAULT_SPACING_STEPS: readonly number[] = [11, 13, 18, 20, 26]
/** Default off-identity Mantine accent families. */
const DEFAULT_FORBIDDEN_ACCENTS: readonly string[] = ['teal', 'violet', 'grape', 'indigo', 'pink']

/** Shared default config — CLI and tests import this to avoid duplication. */
export const DEFAULT_GUARD_CONFIG: GuardConfig = {
  spacingSteps: DEFAULT_SPACING_STEPS,
  rawRadius: true,
  forbiddenAccents: DEFAULT_FORBIDDEN_ACCENTS,
  mantineShadeIndex: true,
  rawSurface: true,
  cardWithBorder: true,
  offSystemSurfaceVar: true,
  rawHtmlLayout: true,
  inlineSpacing: true,
  inlineDisplay: true,
  rawVisxAxis: true,
  rawMotionValue: true,
  unframedChart: true,
  chartMissingAriaLabel: true,
  rawFormControl: true,
  sub16InputFont: true,
  allowComment: 'theme-allow',
  exemptRules: {},
  severity: {},
}

/**
 * A grace-ledger entry: `since` and `promote` are plain `x.y.z` semver strings (C16,
 * `docs/CONTROLS-SPEC.md` §1). `grace.test.ts` fails the build once `package.json`'s version
 * reaches `promote` while the entry is still here — the version-gate that replaces the honor
 * system a bare promotion-note string used to run on. `since` must be strictly before `promote`,
 * also asserted there.
 */
export type GraceEntry = { since: string; promote: string; why: string }

/**
 * Kinds still inside their grace minor — reported, not fatal, until the next minor promotes them.
 * See {@link GuardSeverity} for the doctrine and why basalt-ui in particular needs it.
 *
 * Adding a kind here is part of shipping it; removing the entry IS the promotion, and belongs in
 * its own commit so the changelog says enforcement got stricter. `grace.test.ts` is the other half
 * of "belongs in its own commit": it fails once `package.json`'s version reaches an entry's
 * `promote` while the entry is still here, so a kind can no longer sit at `warn` with nothing
 * tracking it — which is exactly what happened to the five entries this ledger shipped in the
 * round-4 guard minor (D4, `docs/CONTROLS-SPEC.md` §6): all five stayed `warn` for five minors
 * because deleting the entry was the only enforcement, and nothing checked that anyone had.
 *
 * The runway is measured in consumer UPGRADES, not in version numbers: `mantine-shade-index`
 * (the table's first tenant, promoted and gone) sat here across two minors because 1.8.0 shipped
 * the same day as 1.7.0 and 1.9.0 carried the chart batch the same consumer was upgrading for —
 * bundling a build-breaking promotion into the minor they take for the fixes turns a routine bump
 * into an unplanned refactor, which is exactly what the grace minor exists to prevent.
 *
 * **A `SCANNABLE_EXT` widening cannot be expressed here, and 1.23.2's was deliberately not.**
 * Adding `.astro`/`.jsx`/`.vue` widens the FILE SET for all 25 kinds at once — there is no kind to
 * key an entry on, and the nearest one (`raw-hex`, which is what actually fired) is keyed per KIND,
 * not per extension: an entry for it would demote basalt's most load-bearing kind to `warn` in
 * every `.tsx` and `.css` in every consumer for a minor, to buy runway on a file type only one
 * consumer has. `css-raw-surface` is the shape that DOES fit — the new dialect got its own kind
 * because kebab CSS is a distinct pattern set; more files running the same patterns is not.
 *
 * The measurement agreed with the structure. Once the two defects the widening exposed were fixed
 * (`&#123;` read as a hex; `<!-- … -->` never stripped in an SFC), rollhook's marketing site scans
 * 6 files with 0 findings, and no other consumer has a single `.astro`, `.vue` or `.jsx` file — so
 * grace would have covered zero incumbent violations. The doctrine protects code that "passed every
 * previous release"; a violation in a newly-scanned file type is code the consumer is writing now,
 * with `theme-allow`, `basalt.severity` and `exemptRules` all still available.
 *
 * @example
 * const GRACE: Partial<Record<GuardKind, GraceEntry>> = {
 *   'raw-font-family': { since: '1.4.0', promote: '1.5.0', why: 'introduced 1.4.0 — …' },
 * }
 */
export const GRACE_PERIOD_KINDS: Partial<Record<GuardKind, GraceEntry>> = {
  'raw-selection-control': {
    since: '1.26.0',
    promote: '1.28.0',
    why:
      'new in the wave-6 control guards (docs/CONTROLS-SPEC.md §6, law C1). The text lane cannot ' +
      'see ancestry, so "no home" is approximated by a 12-line host-tag window — the loosest ' +
      'reading in the guard, and the reason this one lands warn rather than error even though its ' +
      'law is settled. It moved from 1.27.0 to 1.28.0 with its AST twin, `basalt/control-outside-' +
      'home`, whose PLUGIN_RULE_GRACE entry carries the measurement: the wave-7 run left 9 warns ' +
      'in argo, all of them a control in a modal/form module whose `<Modal>` is rendered by the ' +
      'PARENT — law C1 cross-file, which neither lane can see. `OVERLAY_CONVENTION_FILE` (this ' +
      'file, and the same regex in the plugin) exempts that declared naming convention in both ' +
      'lanes; 1.28.0 is when the remainder is re-measured. One law, two lanes, one promotion.',
  },
}

/** A kind's effective severity: consumer override first, then the grace table, then `error`. */
function severityOf(kind: GuardKind, cfg: GuardConfig): GuardSeverity {
  return cfg.severity?.[kind] ?? (Object.hasOwn(GRACE_PERIOD_KINDS, kind) ? 'warn' : 'error')
}

/** The `Finding.text` cap, in characters — a minified CSS line must not blow up the report. */
const FINDING_TEXT_MAX_LENGTH = 100

/**
 * A finding's `text`: the trimmed source line it sits on, capped at {@link FINDING_TEXT_MAX_LENGTH}
 * with a trailing `…`. Falls back to `fallbackToken` when `line` is out of range for the source
 * (should not happen in practice, but a Finding's own `line` must never crash the render).
 */
function textForFinding(sourceLine: string | undefined, fallbackToken: string): string {
  if (sourceLine === undefined) return fallbackToken
  const trimmed = sourceLine.trim()
  return trimmed.length > FINDING_TEXT_MAX_LENGTH
    ? `${trimmed.slice(0, FINDING_TEXT_MAX_LENGTH)}…`
    : trimmed
}

// ── Path predicate ────────────────────────────────────────────────────────────────────────────────

function isChartFile(relPath: string): boolean {
  return relPath.includes('/charts/') && !AXIS_WRAPPER_FILE.test(relPath)
}

/**
 * Kinds that inherit another kind's `exemptRules` entry. A grace-minor kind that exists only to
 * carry a WIDENING of an established kind is the same rule to a consumer, so an exemption written
 * for the parent must cover it — otherwise the widening arrives as noise in exactly the paths
 * someone already decided the rule does not apply to. The entry disappears with the merge.
 */
const EXEMPT_RULE_ALIASES: Partial<Record<GuardKind, GuardKind>> = {
  'hidden-inline-style': 'raw-html-layout',
  'surface-shadow-override': 'raw-surface',
  'css-raw-surface': 'raw-surface',
}

/** `./` and any trailing `/` are noise — `'agent'`, `'agent/'` and `'./agent'` are one pattern. */
function normalizeExemptPattern(pattern: string): string {
  return pattern.trim().replace(/^\.\//, '').replace(/\/+$/, '')
}

/** `*` stops at a `/`, `**` does not, `?` is one non-`/` character. Everything else is literal. */
function exemptGlobToRegExp(pattern: string): RegExp {
  const body = pattern
    .split(/(\*\*\/|\*\*|\*|\?)/)
    .map((part) => {
      if (part === '**/') return '(?:.*/)?'
      if (part === '**') return '.*'
      if (part === '*') return '[^/]*'
      if (part === '?') return '[^/]'
      return part.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    })
    .join('')
  return new RegExp(`^${body}$`)
}

/**
 * Does one `exemptRules` pattern match `relPath`?
 *
 * Three shapes, tried in the order a consumer reaches for them:
 *
 * 1. **A relative path** — `public/site.webmanifest` for one file, `public` or `src/agent` for
 *    everything under a directory.
 * 2. **A glob** — `public/*.webmanifest`, `**\/*.module.css`; a glob with no `/` in it is also
 *    tried against the BASENAME, so `*.module.css` works the way `site.webmanifest` does.
 * 3. **A bare path segment** — the legacy shape, matching a whole segment anywhere in the path.
 *
 * Only (3) existed, and it was the one shape nobody guesses: rollhook wrote the obvious, correct
 * `"public/site.webmanifest"`, matched nothing, got no diagnostic, and kept reporting. That is a
 * silent no-op exemption, and it became load-bearing the minute `.webmanifest`/`.json` entered the
 * scan — see {@link unmatchedExemptPatterns} for the other half of the fix.
 */
function exemptPatternMatches(pattern: string, relPath: string): boolean {
  const p = normalizeExemptPattern(pattern)
  if (p === '') return false
  if (relPath === p || relPath.startsWith(`${p}/`)) return true
  if (/[*?]/.test(p)) {
    const re = exemptGlobToRegExp(p)
    if (re.test(relPath)) return true
    if (!p.includes('/') && re.test(relPath.split('/').pop() ?? '')) return true
    return false
  }
  return !p.includes('/') && relPath.split('/').includes(p)
}

/**
 * Whether `kind` is exempted at `relPath` via `cfg.exemptRules` — the config-driven, per-rule
 * counterpart to `isChartFile`'s hardcoded path scoping.
 */
function isRuleExempt(
  kind: GuardKind,
  relPath: string,
  exemptRules: GuardConfig['exemptRules'],
): boolean {
  const alias = EXEMPT_RULE_ALIASES[kind]
  if (alias !== undefined && isRuleExempt(alias, relPath, exemptRules)) return true
  const patterns = exemptRules?.[kind]
  if (patterns === undefined || patterns.length === 0) return false
  return patterns.some((pattern) => exemptPatternMatches(pattern, relPath))
}

/** One `exemptRules` entry that suppressed nothing, and why — see {@link unmatchedExemptPatterns}. */
export type UnmatchedExemptPattern = {
  readonly kind: string
  readonly pattern: string
  readonly reason: 'unknown-kind' | 'no-match'
}

/**
 * Every `exemptRules` entry that matched no scanned file, so a run can say so instead of passing.
 *
 * An exemption is a claim ("this rule does not apply here"), and a claim that resolves to nothing is
 * not harmless — it reads as coverage in a config review while enforcing exactly as much as an empty
 * object. rollhook's `["public/site.webmanifest"]` was correct, matched nothing under the
 * segments-only matcher, and reported no diagnostic; the finding it was written for kept failing the
 * build with the config sitting right there looking like the answer. A silent no-op exemption is the
 * same false-green family as a guard that reports green while enforcing nothing.
 *
 * Called once per run by the CLI with every relative path it scanned. Kind keys are checked too: a
 * typo'd kind name is an exemption for a rule that does not exist.
 */
export function unmatchedExemptPatterns(
  cfg: GuardConfig,
  scannedRelPaths: readonly string[],
): UnmatchedExemptPattern[] {
  const out: UnmatchedExemptPattern[] = []
  for (const [kind, patterns] of Object.entries(cfg.exemptRules ?? {})) {
    const known = Object.hasOwn(GUARD_RULES, kind)
    for (const pattern of patterns ?? []) {
      if (!known) {
        out.push({ kind, pattern, reason: 'unknown-kind' })
        continue
      }
      if (scannedRelPaths.some((relPath) => exemptPatternMatches(pattern, relPath))) continue
      out.push({ kind, pattern, reason: 'no-match' })
    }
  }
  return out
}

// ── theme-allow annotations ──────────────────────────────────────────────────────────────────────

/**
 * The oxlint plugin's rule ids. Not guard kinds — they can never suppress a `checkSource` finding —
 * but they ARE valid ids in a `theme-allow`, so an annotation scoped to one of them must parse as
 * accountable rather than be reported as unscoped. Kept as a literal list because the plugin is a
 * standalone `.js` file this module must not import (see the plugin's own header).
 *
 * Exported for `check-theme --audit-allows`: an annotation naming one of these is outside the
 * guard's reach, and judging it needs a `oxlint` run rather than a `checkSource` one. Keep in step
 * with the plugin's own `KNOWN_RULE_IDS`; `configs/oxlint-plugin.test.ts` asserts the two agree.
 */
export const PLUGIN_RULE_IDS: ReadonlySet<string> = new Set([
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
  // `in-body-page-title` is deliberately ABSENT: it is a plugin rule AND a guard kind under one id
  // (one law, two lanes, one annotation), and this set is the ids OUTSIDE `checkSource`'s reach.
  // `check-source.test.ts` asserts the two registries stay disjoint.
  'visx-boundary',
  'visx-tooltip',
  'token-layer-boundary',
  // These three honour `basalt-agent-allow`, never `theme-allow` — but they are still REAL ids, so
  // a `theme-allow ai-sdk-major` must parse as a (useless) scoped annotation rather than as prose.
  'agent-resume-guard',
  'agent-no-raw-usechat',
  'ai-sdk-major',
])

/** The shortest string accepted as a written reason — enough to exclude a stray separator. */
const MIN_ALLOW_REASON_LENGTH = 4

/**
 * How far one annotation reaches.
 *
 * `line` is the default and covers the placements in {@link collectAllowAnnotations}. `file` is the
 * whole-file declaration, and it has to be SPELLED (`theme-allow-file`) rather than inferred: at
 * 1.20.0 a `theme-allow <id> — <reason>` written anywhere in a file was silently promoted to a file
 * declaration by the oxlint plugin, so naming a rule AND giving a reason — the exact shape the
 * guard's own message asks for — was the only legal annotation and it was always whole-file. A
 * consumer who wanted to waive one node and stay policed on the rest could not say so.
 */
type AllowScope = 'line' | 'file'

/**
 * One parsed `theme-allow` annotation.
 *
 * `rules` empty AND `unknownRules` empty is the legacy bare form, and only that covers every kind —
 * and only at `line` scope, never `file` (see {@link annotationCovers}).
 * `unknownRules` holds words that occupied the rule-id slot but name no rule — a typo. Its presence
 * is what makes the parse FAIL CLOSED: `theme-allow raw-hexx — reason` used to consume no id, fall
 * through to `rules: []`, and be read as the blanket form, so one mistyped character escalated a
 * scoped waiver into a whole-line one. A waiver that names a rule must never be more permissive
 * than the same waiver spelled correctly.
 */
type AllowAnnotation = {
  readonly rules: readonly string[]
  readonly unknownRules: readonly string[]
  readonly hasReason: boolean
  readonly scope: AllowScope
}

/** One annotation at the (1-based) line it was WRITTEN on — where `theme-allow-unscoped` reports. */
type AllowDeclaration = { readonly line: number; readonly annotation: AllowAnnotation }

/**
 * Parse the text following the allow token on one line.
 *
 * The grammar is `theme-allow [<rule-id>[, <rule-id>]…] [<separator>] <reason>`. Ids are consumed
 * while they are KNOWN (a guard kind or a plugin rule, optionally `basalt/`-prefixed). A word that
 * occupies the id slot but names no rule ENDS the list as an UNKNOWN id rather than starting the
 * reason — see {@link AllowAnnotation.unknownRules} for why that direction is the safe one.
 *
 * A prose reason therefore has to be introduced the way every annotation in the wild already writes
 * it — with a separator (`—`, `–`, `-`, `:`) — which is what keeps `theme-allow: bespoke mono
 * micro-label` a blanket waiver while `theme-allow raw-hexx — …` waives nothing.
 *
 * **The id slot closes at the first space that no comma opened.** The FIRST word after the token
 * always sits in the id slot, because that is where a typo'd id lands and failing closed there is
 * the whole point. After a resolved id, only a `,` keeps the list open: an unknown word arriving
 * across a comma is a claimed id (`raw-hex, raw-surfacee`) and gets recorded, an unknown word
 * arriving across a space is prose (`raw-surface sub-scale legend corner`, one em-dash away from
 * annotations this package itself ships) and starts the reason. Reporting the second as a typo was
 * a live false-positive class on a waiver that was in fact scoped and reasoned.
 *
 * `Object.hasOwn`, not `in`: `in` walks the prototype chain, so a reason beginning with the word
 * `constructor` (or `toString`, `valueOf`, …) resolved as a real rule id and silently scoped the
 * waiver to a kind that does not exist.
 */
function parseAllowAnnotation(rest: string, scope: AllowScope): AllowAnnotation {
  const rules: string[] = []
  const unknownRules: string[] = []
  let remainder = rest.replace(/^[\s,]+/, '')
  let inIdSlot = true
  for (;;) {
    const token = /^(?:basalt\/)?([a-z][a-z0-9-]*)(?=$|[\s,:—–])/.exec(remainder)
    const id = token?.[1]
    if (token === null || id === undefined) break
    if (!(Object.hasOwn(GUARD_RULES, id) || PLUGIN_RULE_IDS.has(id))) {
      if (inIdSlot) unknownRules.push(id)
      break
    }
    rules.push(id)
    const after = remainder.slice(token[0].length)
    remainder = after.replace(/^[\s,]+/, '')
    inIdSlot = /^\s*,/.test(after)
  }
  const reason = remainder.replace(/^(?:—|–|-{1,2}|:)\s*/, '').trim()
  return { rules, unknownRules, hasReason: reason.length >= MIN_ALLOW_REASON_LENGTH, scope }
}

/** How far back a trailing CSS annotation reaches for the declaration it terminates. */
const MAX_CSS_CONTINUATION_LINES = 8

/**
 * The 0-based line the annotation's OWN comment closes on.
 *
 * A comment-only annotation waives the first line below its comment that is not itself comment, so
 * the walk needs to know how far the annotation's own comment reaches. It used to substitute a
 * budget — walk forward at most eight lines — which was wrong in two ways nothing could see:
 *
 * 1. **A comment block longer than the budget.** A docblock with ~12 lines of reason between the
 *    token and its `*\/` ran the walk out before it reached the code, while the oxlint plugin
 *    (which reads the comment NODE, so length is free) waived it. Nothing about the shape said so;
 *    the annotation just stopped working past a line count nobody could count.
 * 2. **A blank line inside the block.** Outside a comment a blank line SEPARATES — it is how people
 *    say "this comment is not about the next statement" — but a blank gutter line in the middle of
 *    a docblock is just prose, and ending the walk there dropped the waiver.
 *
 * Knowing where the comment ends settles both: inside it, keep going; past it, the ordinary
 * comment-run rules apply (see the walk in {@link collectAllowAnnotations}, and
 * {@link isCommentOnly} for the third hole this pass closed).
 *
 * An unterminated block comment reports its own line — the conservative answer for a file that does
 * not parse anyway, and it keeps the walk from running to EOF.
 */
function commentBlockEnd(
  lines: readonly string[],
  index: number,
  tokenAt: number,
  syntax: GuardSyntax,
): number {
  const line = lines[index] ?? ''
  // An SFC carries both dialects, so the closer is resolved from the opener the token actually sits
  // behind rather than from the extension: whichever of `<!--` / `/*` is NEAREST on its left wins.
  const markup = syntax === 'markup' || (syntax === 'sfc' && opensMarkupComment(line, tokenAt))
  // A line comment closes at its own end of line. CSS has no `//`, so the test is TS-only: there,
  // a `//`-looking sequence is text and the conservative same-line answer is the right one anyway.
  if (!markup && syntax !== 'css' && /\/\/\s*$/.test(line.slice(0, tokenAt))) return index
  const closer = markup ? '-->' : '*/'
  if (line.slice(tokenAt).includes(closer)) return index
  for (let ahead = index + 1; ahead < lines.length; ahead++) {
    if ((lines[ahead] ?? '').includes(closer)) return ahead
  }
  return index
}

/**
 * In an `sfc` file, is the comment the token sits in an HTML one?
 *
 * Both dialects are legal in the same file, so the extension cannot answer it — the nearest opener
 * on the token's left does. A tie (neither present) reads as the JS dialect, which is what an
 * annotation on a bare frontmatter line is.
 */
function opensMarkupComment(line: string, tokenAt: number): boolean {
  const before = line.slice(0, tokenAt)
  return before.lastIndexOf('<!--') > before.lastIndexOf('/*')
}

/**
 * A comment opener sitting immediately before the annotation token.
 *
 * `stripComments` is the primary evidence that an occurrence is inside a comment, but it is
 * deliberately biased toward treating an ambiguous `/` as division (see its own doc), and JSX makes
 * that bias fire constantly: in `<Box p={18} /> // theme-allow` the `/` of `/>` follows a `}`, so
 * the stripper reads a regex literal and the trailing comment survives unstripped. This prefix test
 * is the second witness — cheap, local, and exact for every shape that actually occurs.
 */
const COMMENT_OPENER_BEFORE = /(?:\/\/|\/\*|<!--)\s*$/

/** A line that is NOTHING but a comment — the placement that waives the line below it. */
const COMMENT_ONLY_LINE = /^\s*(?:\{\s*\/\*|\/\/|\/\*|\*|<!--)/

/**
 * A JSX expression container closing immediately after the comment that filled it — the `*\/}` of a
 * `{/* … *\/}` whose annotation wrapped onto its own line.
 *
 * `stripComments` blanks the comment and leaves the bare `}` behind, so the line read as CODE and
 * the annotation was classified TRAILING — scoped to a line that holds nothing but a brace, and
 * therefore waiving nothing. That is the shape linewatch writes for every hand-composed chart axis
 * (`{/*` on one line, the annotation and `*\/}` on the next), which worked only because the rules it
 * names live in the oxlint plugin, whose own placement test is comment-node-based and never saw the
 * brace. Any guard kind annotated this way was silently unwaivable.
 *
 * Deliberately narrow: the `}` must abut the comment CLOSE. A `}` that is real code (`} // theme-
 * allow …` closing a block) keeps its trailing classification, so the annotation stays on its own
 * line rather than reaching the statement below.
 */
const JSX_COMMENT_CLOSE = /\*\/\s*\}\s*$/

/**
 * Is this line NOTHING but comment? — one definition, used both to classify the annotation's own
 * line (own-line vs trailing) and to walk the lines under it.
 *
 * The two used to be written out separately, and the walk's copy was the one missing the
 * {@link JSX_COMMENT_CLOSE} clause: a `*\/}` alone on its line read as the code `}`, so the walk
 * stopped ON the closer and the annotation waived a brace. Two consumers isolated that
 * independently — `{/* … *\/}` and `{/** … *\/}` — each with a probe pair differing by one newline,
 * while the oxlint plugin (whose test is comment-node-based and never sees the brace) waived both.
 * A shared predicate is what stops the two placements from drifting apart again.
 */
function isCommentOnly(raw: string, stripped: string): boolean {
  const code = stripped.trim()
  return code === '' || COMMENT_ONLY_LINE.test(raw) || (code === '}' && JSX_COMMENT_CLOSE.test(raw))
}

/**
 * Everything allowed between the comment opener (or the start of the line) and the annotation
 * token, for the token to count as an ANNOTATION rather than prose that mentions one.
 *
 * **This gates WAIVING as well as reporting.** It used to gate only `theme-allow-unscoped`, on the
 * argument that a stricter waiver could take a build down over comment placement. The cost of that
 * asymmetry was the opposite and worse: a comment that merely MENTIONS the token in prose parsed as
 * the bare blanket form and switched every kind off on the line below it. linewatch documented its
 * own waivers in a docblock and thereby disarmed the file — the third hole found in this contract
 * in two rounds, and the only one that was a false NEGATIVE.
 *
 * So an annotation must START its comment, or start a line inside one: after `//`, `/*` (or a
 * docblock's `/**`), `<!--`, a block-comment gutter `*`, or nothing but leading whitespace.
 * Everything a consumer actually writes qualifies; a sentence about the escape hatch does not.
 *
 * `/**` is in the alternation because the oxlint plugin's copy of this test always accepted it and
 * this one did not: a one-line `/** theme-allow raw-hex — why *\/` waived under `oxlint` and
 * reported under `check-theme`. The two halves of one contract must not disagree about what an
 * annotation IS — only about which rules each can judge.
 *
 * What the annotation then WAIVES is a separate, fail-closed question — see
 * {@link parseAllowAnnotation}. A word in the id slot that names no rule waives nothing, so
 * `// theme-allow legacy vendor asset` (a prose reason with no separator introducing it) no longer
 * suppresses. That IS a break, deliberately: the alternative is one mistyped character silently
 * widening a scoped waiver into a blanket one. No consumer writes that shape today — every
 * annotation across all seven repos introduces its reason with `—`, `–`, `-` or `:` — which is why
 * it ships as a documented break rather than a `GRACE_PERIOD_KINDS` entry. Grace could not express
 * it anyway: the kind that fires is the UNSUPPRESSED one (`raw-hex`), not `theme-allow-unscoped`,
 * and downgrading `raw-hex` to waive-by-default is the hole this closed.
 */
const ANNOTATION_PREFIX = /(?:^|\/\/|\/\*\*?|<!--|^\s*\*)\s*$/

/** Escape a config-supplied string for literal use inside a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * The annotation token itself, with its optional `-file` suffix.
 *
 * `(?![\w-])` is what keeps the two forms apart and keeps a longer word from being read as the bare
 * form: `theme-allow-file` is the file declaration, `theme-allow-unscoped` (the KIND NAME, written
 * in prose constantly) is neither — before this it consumed no id, fell through to `rules: []` and
 * parsed as a blanket waiver.
 */
function allowTokenRe(allowComment: string): RegExp {
  return new RegExp(`${escapeRegExp(allowComment)}(-file)?(?![\\w-])`, 'g')
}

/**
 * The JSON dialect of the annotation — `"basalt:theme-allow-file": "<ids> — <why>"`.
 *
 * JSON has no comments, so from 1.20.0 (when the scan reached `.webmanifest` / `.json`) every
 * finding in that file class was permanently unwaivable and the printed remedy prescribed a comment
 * the file cannot carry. Two consumers were pushed into a blanket `exemptRules` entry instead — the
 * un-reviewable shape this contract exists to retire. A member key is the one annotation JSON can
 * hold, it carries ids and a reason exactly like the comment form, and every manifest consumer
 * ignores members it does not know.
 */
function jsonAllowKeyRe(allowComment: string): RegExp {
  return new RegExp(`"basalt:${escapeRegExp(allowComment)}(-file)?"\\s*:\\s*"([^"]*)"`, 'g')
}

/**
 * Every line an allow annotation WAIVES, keyed by 0-based line index, plus the file-scoped
 * declarations and every annotation as WRITTEN (for `theme-allow-unscoped`).
 *
 * **The grammar, in full:**
 *
 * ```text
 * theme-allow                                  → this placement, EVERY kind   (reports unscoped)
 * theme-allow <id>[, <id>…] [— <why>]          → this placement, those kinds  (unscoped without a why)
 * theme-allow-file <id>[, <id>…] — <why>       → the WHOLE FILE, those kinds
 * "basalt:theme-allow[-file]": "<id>… — <why>" → the same two, for JSON/.webmanifest
 * ```
 *
 * Three rules make it unambiguous: the token must START its comment (see {@link ANNOTATION_PREFIX});
 * `-file` is part of the token, not the first word of the reason (see {@link allowTokenRe}); and a
 * bare `theme-allow-file` waives NOTHING, because whole-file blanket immunity off one unnamed
 * comment is the exact thing this contract exists to price (see {@link annotationCovers}).
 *
 * Line scope has three placements, each one a shape people actually write — and the union of them
 * is what makes the escape survive a formatter.
 *
 * 1. **Its own line.** The original rule, unchanged.
 * 2. **The first CODE line below, when the annotation line is a comment and nothing else.** This is
 *    the placement the oxlint plugin has always honored and the only one JSX can express: the
 *    reported line is usually a multi-line opening tag or a `{expr}` child, where a trailing `//` is
 *    a syntax error or renders as visible text. Requiring the annotation line to be comment-ONLY is
 *    what keeps a TRAILING comment scoped to its own line — otherwise
 *    `const a = '#f00' // theme-allow` would silently waive the next line too. The rest of the
 *    comment BLOCK is walked through rather than counted as the target line: a docblock's `*\/`, or
 *    a reason that wrapped onto a second line, used to absorb the whole waiver and the natural
 *    shape silently waived nothing. A blank line ends the block — that separation is how people say
 *    "this comment is not about the next statement".
 * 3. **The rest of the CSS declaration it terminates.** The shipped `oxfmt` reflows
 *    `background-color: var(--x, #232326); /* theme-allow *\/` into four lines with the hex on one
 *    and the comment on another — two shipped tools pulling in opposite directions, and the
 *    exception silently stopped working. Walking back over the continuation lines (stopping at the
 *    first `;` / `{` / `}`, which CSS actually has) restores it. Deliberately CSS-only: oxfmt emits
 *    NO semicolons in TS, so there is no statement terminator to stop at and the same walk would
 *    waive arbitrary code above.
 *
 * An occurrence only counts when it sits inside a COMMENT, which is read off the stripped text:
 * `stripComments` replaces comment characters 1:1 with spaces, so a position that is non-space in
 * the source and space in the stripped copy was a comment. That is what keeps a `'theme-allow'`
 * inside a string literal (or in this file's own rule table) from silently disabling a rule.
 */
function collectAllowAnnotations(
  lines: readonly string[],
  codeLines: readonly string[],
  allowComment: string,
  syntax: GuardSyntax,
): {
  waivers: Map<number, AllowAnnotation[]>
  fileScoped: AllowAnnotation[]
  declared: AllowDeclaration[]
} {
  const byLine = new Map<number, AllowAnnotation[]>()
  const fileScoped: AllowAnnotation[] = []
  const declared: AllowDeclaration[] = []
  const add = (index: number, annotation: AllowAnnotation): void => {
    const list = byLine.get(index) ?? []
    list.push(annotation)
    byLine.set(index, list)
  }

  /** Place one parsed annotation: file declarations reach everywhere, line ones the 3 placements. */
  const record = (
    index: number,
    annotation: AllowAnnotation,
    trailing: boolean,
    tokenAt: number,
  ): void => {
    declared.push({ line: index + 1, annotation })
    if (annotation.scope === 'file') {
      fileScoped.push(annotation)
      return
    }
    add(index, annotation)
    if (!trailing) {
      // The first CODE line below the comment. A docblock's `*/` (or the rest of a wrapped reason)
      // sits between the annotation and the code it is about, so `index + 1` alone meant the
      // natural multi-line shape silently waived nothing — argo hit it three times in one upgrade,
      // each looking like a correct annotation. A BLANK line outside the comment still ends the
      // block: that is the separation people use to mean "this comment is not about the next
      // statement". Inside it, a blank gutter line is just prose.
      const closesAt = commentBlockEnd(lines, index, tokenAt, syntax)
      for (let ahead = 1; index + ahead < lines.length; ahead++) {
        const at = index + ahead
        add(at, annotation)
        if (at <= closesAt) continue
        const raw = lines[at] ?? ''
        if (raw.trim() === '') break
        if (!isCommentOnly(raw, codeLines[at] ?? '')) break
      }
      return
    }
    if (syntax !== 'css') return
    for (let back = 1; back <= MAX_CSS_CONTINUATION_LINES; back++) {
      const previous = (codeLines[index - back] ?? '').trim()
      if (previous === '' || /[;{}]$/.test(previous)) break
      add(index - back, annotation)
    }
  }

  const token = allowTokenRe(allowComment)
  const jsonKey = jsonAllowKeyRe(allowComment)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const stripped = codeLines[i] ?? ''
    const isCommentOnlyLine = isCommentOnly(line, stripped)

    // The JSON member form. Markup-only: in TS/CSS that string would be code, not an annotation.
    if (syntax === 'markup') {
      for (const m of line.matchAll(jsonKey)) {
        record(
          i,
          parseAllowAnnotation(m[2] ?? '', m[1] === undefined ? 'line' : 'file'),
          false,
          m.index,
        )
      }
    }

    for (const m of line.matchAll(token)) {
      const at = m.index
      const before = line.slice(0, at)
      // Not inside a comment (neither witness agrees) → real code, e.g. this file's own rule table.
      if (stripped[at] !== ' ' && !COMMENT_OPENER_BEFORE.test(before)) continue
      // Inside a comment, but not at the START of one → prose that mentions the token, not an
      // annotation. See ANNOTATION_PREFIX: this is what stops a file documenting its own waivers
      // from disarming itself.
      if (!ANNOTATION_PREFIX.test(before)) continue
      const rest = line.slice(at + m[0].length)
      record(
        i,
        parseAllowAnnotation(rest, m[1] === undefined ? 'line' : 'file'),
        !isCommentOnlyLine,
        at,
      )
    }
  }
  return { waivers: byLine, fileScoped, declared }
}

/**
 * Does one annotation cover `kind`?
 *
 * Only a BARE **line** annotation (no ids at all, known or unknown) covers every kind. One that
 * reached for a rule id and missed covers exactly the ids it got right — nothing widens on a typo.
 *
 * A bare `theme-allow-file` covers NOTHING. The blanket form is tolerable on one line, where a
 * reader sees what it sits on; over a whole file it is `exemptRules` without the config review, and
 * the widest waiver in the contract must be the one that has to name what it waives.
 */
function annotationCovers(annotation: AllowAnnotation, kind: GuardKind): boolean {
  if (annotation.rules.includes(kind)) return true
  if (annotation.scope === 'file') return false
  return annotation.rules.length === 0 && annotation.unknownRules.length === 0
}

/** Does any annotation on this line cover `kind`? */
function annotationsCover(annotations: AllowAnnotation[] | undefined, kind: GuardKind): boolean {
  return (annotations ?? []).some((a) => annotationCovers(a, kind))
}

/** The 4 comment dialects the stripper understands, resolved from the file's own extension. */
type GuardSyntax = 'ts' | 'css' | 'markup' | 'sfc'

/**
 * CSS (including `.module.css`) has no `//` line-comment syntax at all — an unquoted `//`, e.g.
 * inside `url(https://…)`, is real CSS text, never a comment opener. Match on the `.css` suffix
 * (not a naive `split('.')`) so `foo.module.css` resolves the same as `foo.css`.
 *
 * `markup` covers the two files whose colors nothing re-derives on a theme change and which the
 * scan never reached — `index.html` and `*.webmanifest` (plus plain `.json`, which a webmanifest
 * often is). Only the color/typography kinds apply there; see `MARKUP_KINDS`.
 *
 * `sfc` is the single-file-component dialect — `.astro` and `.vue`, which carry BOTH regions:
 * `<!-- … -->` in the template and `//` / `/* … *\/` in the frontmatter/`<script>` fence. They used
 * to fall through to `ts`, so an HTML comment was never stripped: a `theme-allow` written in one
 * waived nothing, and a color inside a commented-out block still reported (rollhook, round 9 —
 * `.astro` became scannable in the same minor that exposed it). They are NOT `markup`: an `.astro`
 * template is JSX-shaped and a `.vue` `<script setup>` is real TS, so restricting them to
 * {@link MARKUP_KINDS} would drop 22 of the 25 kinds on a file type that can violate all of them.
 *
 * `.jsx` needs no entry — it is TS syntax with no HTML-comment region.
 *
 * **Two asserted limits, both false-NEGATIVE-only** (pinned in `check-source.test.ts`):
 *
 * 1. The kebab-CSS kinds (`css-raw-surface`) do not fire inside a `<style>` fence — that branch
 *    keys on `syntax === 'css'`, and an SFC is one file with three dialects, not three files. The
 *    color kinds, which are what an unguarded template layer actually leaks, do fire there.
 * 2. Stripping is region-BLIND: `<!-- … -->` is blanked anywhere in the file, and `//` anywhere
 *    outside a string. A `<!--` inside a script string, or an unquoted `https://` in template
 *    prose, over-strips the rest of that construct. Both directions lose findings rather than
 *    inventing them, which is the side of the trade a release-blocking false positive says to take.
 */
function guardSyntaxFor(relPath: string): GuardSyntax {
  if (relPath.endsWith('.css')) return 'css'
  if (/\.(?:html?|webmanifest|json)$/.test(relPath)) return 'markup'
  if (/\.(?:astro|vue)$/.test(relPath)) return 'sfc'
  return 'ts'
}

/**
 * The comment-stripped twin of `text`, same length and same newline positions, for any dialect.
 *
 * One place rather than the two call sites (`checkSource` and `findAllowAnnotations`) that used to
 * spell the `markup ? … : …` ternary out independently — adding `sfc` to one and not the other is
 * exactly how the scan and `--audit-allows` drift apart on what counts as a comment.
 *
 * The SFC order is markup-first: an HTML comment may legally contain `//` or an unterminated `/*`,
 * and blanking it before the TS pass keeps that text from opening a comment that runs to EOF.
 */
function stripGuardComments(text: string, syntax: GuardSyntax): string {
  if (syntax === 'markup') return stripMarkupComments(text)
  if (syntax === 'sfc') return stripComments(stripMarkupComments(text), 'ts')
  return stripComments(text, syntax)
}

/** The only kinds meaningful in an HTML document or a JSON manifest — no JSX, no CSS-in-JS. */
const MARKUP_KINDS: ReadonlySet<GuardKind> = new Set(['raw-hex', 'raw-color-fn', 'raw-font-family'])

/** Blanks out `<!-- … -->` 1:1 with spaces, preserving every offset. JSON has no comment syntax. */
function stripMarkupComments(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
}

/**
 * The exact first line of every stylesheet the CLI emits — the contract between `basalt-ui
 * tokens:css` / `fonts:css` and this scanner, and the single source of truth for it (`src/cli`
 * imports this rather than keeping its own copy, which is how the two used to drift apart).
 *
 * The marker exists because `check-theme` reported the file a sibling command had just written:
 * 116 of rollhook's 117 violations were inside the emitted token stylesheet, which is nothing but
 * hex and `rgba()` by construction.
 *
 * **Command-NEUTRAL by necessity.** Line 1 is compared verbatim, so it cannot name the command
 * that produced the file without needing one accepted marker per command — and a second accepted
 * marker is a second forgery surface. It points at the provenance line instead, which does name
 * the command. It used to say `regenerate with \`bunx basalt-ui tokens:css\`` on a `fonts:css`
 * file too: following that instruction overwrote a font sheet with the palette sheet.
 */
export const GENERATED_HEADER_LINE =
  '/* @generated basalt-ui — do not edit; regenerate with the command on the next line */'

/** Line 2 of the header: the emitting version and the exact invocation that produced the file. */
const GENERATED_PROVENANCE_LINE =
  /^\/\* basalt-ui \d+\.\d+\.\d+[^\s]* — `basalt-ui (?:tokens:css|fonts:css)[^`]*` \*\/$/

/** The header is exactly the two lines `generatedHeader()` writes — nothing further in counts. */
const GENERATED_HEADER_LINES = 2

/** A comment that OPENS AND CLOSES on its own line — the only comment shape the emitters write. */
const GENERATED_COMMENT_LINE = /^\/\*(?:[^*]|\*(?!\/))*\*\/$/

/** Outside a block: a selector, a selector-list continuation ending in `,`, or an at-rule opener. */
const GENERATED_SELECTOR_LINE = /^[^{};]*[,{]$/

/** Inside a block: a declaration of a custom property in basalt's OWN namespace, or the close. */
const GENERATED_DECL_LINE = /^(?:--(?:vx|basalt)-[A-Za-z0-9_-]*\s*:[^{};]*;|\})$/

/** No line is skipped in a file that is not one basalt emitted — the shared empty answer. */
const NO_GENERATED_LINES: ReadonlySet<number> = new Set()

/** Net brace depth a line moves the parser by — CSS blocks, counted the cheap way. */
function braceDelta(line: string): number {
  let delta = 0
  for (const ch of line) {
    if (ch === '{') delta++
    else if (ch === '}') delta--
  }
  return delta
}

/**
 * The (1-based) lines of a stylesheet basalt itself emitted, which the scan may skip. Empty for
 * every other file.
 *
 * The marker used to be honoured on its own: any file whose first five lines contained the string
 * `@generated basalt-ui` was skipped ENTIRELY. That made a two-word comment a whole-file guard
 * bypass — prepend it to any `.tsx` and every finding in it disappears. The replacement gated the
 * whole file on a header plus a line-shape allowlist, and the allowlist was loose enough to forge:
 * `--vx-pad: 0; box-shadow: 0 0 0 1px #ff0000;` passed as "a basalt custom property" because the
 * value pattern permitted `;`, and `/* x *\/ .btn { color: #ff0000; }` passed as "a comment"
 * because the comment pattern never required the comment to close. Both are browser-effective CSS,
 * and either one bought a whole-file exemption.
 *
 * Two changes close that, and the second is the structural one:
 *
 * 1. **The exemption is PER LINE, not per file.** A line-shape allowlist that misses now costs one
 *    line, not the whole file — the blast radius of the next mistake is bounded by construction.
 *    It also reports the smuggled line precisely instead of burying it under 300 token values.
 * 2. **The allowlist is brace-depth-aware.** CSS declarations only take effect INSIDE a block, so
 *    at depth ≥ 1 the only skippable line is a `--vx-*`/`--basalt-*` declaration whose value
 *    carries no `;`, a `}`, a self-closing comment, or a blank. `box-shadow: … #ff0000,` is a
 *    depth-1 line and is scanned no matter how it is shaped. At depth 0 a loose selector pattern
 *    is safe precisely because nothing there is a declaration.
 *
 * Three conditions still gate the file itself: a `.css` path (the CLI emits CSS and nothing else,
 * so the marker is ignored in `.ts`/`.tsx`/`.html`/`.json`, which is where the guard has its
 * teeth), the canonical header verbatim on line 1, and the provenance line on line 2.
 *
 * A line carrying the allow comment is never skipped: an emitted sheet contains no `theme-allow`,
 * and skipping one would suppress the `theme-allow-unscoped` report of a waiver hidden in a file
 * wearing the header.
 *
 * Residual, knowingly accepted: at depth 0 a forger can hide a finding inside something shaped
 * like a selector (`.a[data-x='#ff0000'] {`), and inside a block they can hide the value of a
 * custom property they declare in basalt's own namespace. Neither is browser-effective as a style
 * and the second IS the artifact class this exemption exists for.
 */
function generatedTokenLines(
  relPath: string,
  lines: readonly string[],
  allowComment: string,
): ReadonlySet<number> {
  if (!relPath.endsWith('.css')) return NO_GENERATED_LINES
  if ((lines[0] ?? '').trim() !== GENERATED_HEADER_LINE) return NO_GENERATED_LINES
  if (!GENERATED_PROVENANCE_LINE.test((lines[1] ?? '').trim())) return NO_GENERATED_LINES

  const skippable = new Set<number>([1, 2])
  let depth = 0
  for (let i = GENERATED_HEADER_LINES; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const trimmed = line.trim()
    const shaped =
      trimmed === '' ||
      GENERATED_COMMENT_LINE.test(trimmed) ||
      (depth === 0 ? GENERATED_SELECTOR_LINE : GENERATED_DECL_LINE).test(trimmed)
    if (shaped && !line.includes(allowComment)) skippable.add(i + 1)
    depth += braceDelta(line)
    // Unbalanced braces mean this is not the emitters' output at all — fail closed on the rest.
    if (depth < 0) return NO_GENERATED_LINES
  }
  return skippable
}

/**
 * Kinds disabled under `profile: 'tokens-only'` — every kind whose remedy is a Mantine component,
 * a Mantine prop, or the React theme factory. See {@link GuardConfig.profile}.
 *
 * Exported so the CLI can name the profile in `--help`/`doctor` output without re-deriving the
 * list, and so a test can assert the two halves (disabled vs. surviving) partition the registry.
 */
export const TOKENS_ONLY_DISABLED_KINDS: ReadonlySet<GuardKind> = new Set([
  'localstorage-theme',
  'off-identity-accent',
  'mantine-shade-index',
  'raw-spacing',
  'raw-radius',
  'card-with-border',
  'off-system-surface-var',
  'raw-html-layout',
  // Same remedy as raw-html-layout, word for word ("use a Mantine layout primitive") — it is that
  // kind's widening, so it has to share its gate here exactly as it shares it in
  // EXEMPT_RULE_ALIASES. Splitting them told a Mantine-free consumer to import Box/Flex.
  'hidden-inline-style',
  'inline-spacing',
  'inline-display',
  'raw-visx-axis',
  'raw-motion-value',
  'unframed-chart',
  'chart-missing-aria-label',
  'raw-form-control',
  'sub-16-input-font',
  // Both wave-6 control kinds: `<Title>` is a Mantine component and the remedy for either one is a
  // Mantine-rendered home (PageBar / WidgetHeader) or a basalt control over @mantine/core. Neither
  // sentence is followable in a consumer that installs the token layer and nothing else.
  'in-body-page-title',
  'raw-selection-control',
])

// A `/` opens a regex literal (not division) when the previous significant token is one of these
// punctuation marks, or one of the REGEX_PRECEDING_KEYWORDS below, or nothing has been scanned yet
// (start of input) — the standard JS lexer disambiguation. `ts`-syntax only; CSS has no regexes.
const REGEX_PRECEDING_PUNCT = new Set([
  '=',
  '(',
  ',',
  '[',
  ':',
  '!',
  '&',
  '|',
  '?',
  '{',
  '}',
  ';',
  '+',
  '-',
  '*',
  '%',
  '~',
  '^',
  '<',
])
const REGEX_PRECEDING_KEYWORDS = new Set([
  'return',
  'typeof',
  'case',
  'in',
  'of',
  'delete',
  'void',
  'throw',
  'do',
  'else',
])
const WORD_CHAR = /[A-Za-z0-9_$]/

/**
 * Strip comments out of source text, leaving real comment-awareness in place of the old per-line
 * prefix heuristic (which only caught a comment when ITS OWN line happened to start with `//` /
 * `*` / `/*` — a block-comment continuation line that didn't start with `*` slipped straight
 * through as if it were code).
 *
 * Stripped characters are replaced 1:1 with a space (newlines are preserved verbatim), so the
 * output is the SAME LENGTH as the input and every remaining token keeps its exact original line
 * number and character offset — callers can keep using `text.slice(0, i).split('\n').length` for
 * line numbers exactly as before.
 *
 * Deliberately does NOT touch string literals (`'`, `"`, backtick, backslash-escaped): a raw hex
 * or a `//` inside a string is real source text, not a comment, and must still be scanned as-is
 * (e.g. a URL like `'https://x.com/#abc'` must not have its `//` treated as a line comment).
 *
 * `syntax === 'css'` disables `//` line-comment handling entirely (CSS only has `/* *\/`) — an
 * unquoted `url(https://…)` must never have its rest-of-line blanked (that was the BUG 2 false
 * negative: a real violation on the same line silently disappearing behind a bogus "comment").
 *
 * `syntax === 'ts'` additionally recognizes regex literals (`/…/flags`) via
 * `REGEX_PRECEDING_PUNCT` / `REGEX_PRECEDING_KEYWORDS` and consumes them VERBATIM — a `/*` or `//`
 * shaped sequence inside a regex body (e.g. a character class `/[/*]/`) is real regex source, not
 * a comment opener, and must not open a block comment that then runs away to EOF eating every
 * subsequent line unrecoverably (that was the BUG 1 false negative — total loss of guard coverage
 * for the rest of the file). The heuristic is inherently imperfect (full disambiguation needs a
 * real parser), so it is DELIBERATELY biased toward treating an ambiguous `/` as division, i.e.
 * NOT a regex, i.e. NOT specially protected: an under-strip here just leaves a `/` as an ordinary
 * character (worst case a spurious finding a human can `theme-allow`), whereas an over-eager
 * regex-open would swallow real code as "protected regex content" and could hide a genuine
 * violation — the failure mode BUG 1 already showed is unacceptable.
 */
function stripComments(text: string, syntax: 'ts' | 'css'): string {
  const out: string[] = Array.from<string>({ length: text.length })
  let inLineComment = false
  let inBlockComment = false
  let stringQuote: string | null = null
  let currentWord = ''
  let lastUnitType: 'word' | 'punct' | 'none' = 'none'
  let lastWord = ''
  let lastPunct = ''
  let i = 0

  function flushWord(): void {
    if (currentWord === '') return
    lastUnitType = 'word'
    lastWord = currentWord
    currentWord = ''
  }

  function canPrecedeRegex(): boolean {
    if (lastUnitType === 'none') return true
    if (lastUnitType === 'word') return REGEX_PRECEDING_KEYWORDS.has(lastWord)
    return REGEX_PRECEDING_PUNCT.has(lastPunct)
  }

  while (i < text.length) {
    const ch = text[i] ?? ''

    if (inLineComment) {
      out[i] = ch === '\n' ? '\n' : ' '
      if (ch === '\n') inLineComment = false
      i++
      continue
    }

    if (inBlockComment) {
      if (ch === '*' && text[i + 1] === '/') {
        out[i] = ' '
        out[i + 1] = ' '
        i += 2
        inBlockComment = false
        continue
      }
      out[i] = ch === '\n' ? '\n' : ' '
      i++
      continue
    }

    if (stringQuote !== null) {
      out[i] = ch
      if (ch === '\\' && i + 1 < text.length) {
        out[i + 1] = text[i + 1] ?? ''
        i += 2
        continue
      }
      if (ch === stringQuote) stringQuote = null
      i++
      continue
    }

    if (WORD_CHAR.test(ch)) {
      currentWord += ch
      out[i] = ch
      i++
      continue
    }
    flushWord()

    if (ch === "'" || ch === '"' || ch === '`') {
      stringQuote = ch
      out[i] = ch
      lastUnitType = 'punct'
      lastPunct = ch
      i++
      continue
    }

    if (ch === '/' && text[i + 1] === '*') {
      inBlockComment = true
      out[i] = ' '
      i++
      continue
    }

    if (syntax === 'ts' && ch === '/' && text[i + 1] === '/') {
      inLineComment = true
      out[i] = ' '
      i++
      continue
    }

    if (syntax === 'ts' && ch === '/' && canPrecedeRegex()) {
      // Consume the regex literal VERBATIM: backslash escapes and `[...]` character classes never
      // close it early. A raw newline before the closing `/` means this was never a valid regex
      // (JS disallows a literal line terminator inside one) — bail out of regex mode right there;
      // every character up to the newline was already copied through unchanged either way, so
      // bailing loses nothing.
      out[i] = ch
      let j = i + 1
      let inClass = false
      while (j < text.length) {
        const rc = text[j] ?? ''
        if (rc === '\n') break
        out[j] = rc
        if (rc === '\\' && j + 1 < text.length) {
          out[j + 1] = text[j + 1] ?? ''
          j += 2
          continue
        }
        if (rc === '[') inClass = true
        else if (rc === ']') inClass = false
        else if (rc === '/' && !inClass) {
          j++
          break
        }
        j++
      }
      i = j
      lastUnitType = 'punct'
      lastPunct = '/'
      continue
    }

    // Plain `/` (division, or any bare `/` in CSS syntax) — or any other punctuation/whitespace.
    out[i] = ch
    if (!/\s/.test(ch)) {
      lastUnitType = 'punct'
      lastPunct = ch
    }
    i++
  }

  return out.join('')
}

// ── GUARD_RULES registry ─────────────────────────────────────────────────────────────────────────

type GuardRule = {
  readonly kind: GuardKind
  /** Static regex, or a builder over cfg for the 3 dynamic kinds (forbiddenAccent/spacing/radius). */
  readonly pattern: RegExp | ((cfg: GuardConfig) => RegExp)
  /** Path-applicability: raw-visx-axis only fires in chart files. */
  readonly appliesTo?: (relPath: string) => boolean
  /** Knob gating; always-on kinds omit this. */
  readonly enabled?: (cfg: GuardConfig) => boolean
  /** Per-kind fix-hint message. */
  readonly message: string
}

/**
 * The closed registry of all 27 guard kinds. The triad test asserts
 * `surface.guardKinds ⊆ keyof GUARD_RULES` at runtime.
 *
 * raw-surface, raw-html-layout, and sub-16-input-font are handled inline in checkSource
 * (multi-regex / multi-condition / full-text tag-scoped); all other kinds map to a single pattern
 * entry.
 *
 * This file and `src/cli/index.ts` are `exempt` in the package's own `basalt` config, and must
 * stay that way: a rule's `pattern` and its `message` both spell the anti-pattern out literally
 * (`'Raw <input>/<select>/<textarea> …'`), so the guard flags its own definitions when the package
 * self-scans. Any kind matching a literal tag hits this — `raw-visx-axis` only escaped it by
 * accident, via an `appliesTo` that happens to exclude non-chart files. Fixture files are already
 * covered by the scanner's own `SKIP` (`*.test.ts`), for the same reason.
 */
export const GUARD_RULES = {
  'raw-hex': {
    kind: 'raw-hex',
    pattern: HEX,
    message: 'Route color through VX.* / the Mantine theme.',
  },
  'raw-color-fn': {
    kind: 'raw-color-fn',
    pattern: FUNC,
    message: 'Route color through VX.* / the Mantine theme; for opacity use alpha(token, a).',
  },
  'localstorage-theme': {
    kind: 'localstorage-theme',
    pattern: LOCALSTORAGE_THEME,
    // JS-call-shaped (`localStorage.getItem('theme')`) — never appears in CSS text.
    appliesTo: (relPath) => !relPath.endsWith('.css'),
    message: 'Theme must resolve via the Mantine color scheme + --vx-* vars.',
  },
  'raw-font-family': {
    kind: 'raw-font-family',
    pattern: RAW_FONT_FAMILY,
    message:
      'Route the font stack through createBasaltTheme(overrides, { fonts }) / the shipped --basalt-font-sans|head|mono vars instead of a hardcoded fontFamily literal.',
  },
  'off-identity-accent': {
    kind: 'off-identity-accent',
    pattern: (cfg: GuardConfig) =>
      new RegExp(
        `\\b(?:color|c|bg|backgroundColor)\\s*=\\s*\\{?\\s*['"](${cfg.forbiddenAccents.join('|')})['"]`,
        'g',
      ),
    // JSX-prop-shaped (`color={"teal"}`) — CSS declares `color: teal;` with a bare keyword and
    // `:`, which the pattern's `=` anchor can never match; gated off explicitly so a future regex
    // tweak can't silently start false-positiving on consumer CSS.
    appliesTo: (relPath) => !relPath.endsWith('.css'),
    message: 'For an off-identity accent use blue/gray or a status hue (red/green/orange/yellow).',
  },
  'mantine-shade-index': {
    kind: 'mantine-shade-index',
    pattern: MANTINE_SHADE_INDEX,
    enabled: (cfg: GuardConfig) => cfg.mantineShadeIndex,
    message:
      'Shade-pinned Mantine color — one fixed swatch in BOTH color schemes, so it cannot stay legible in either. Use VX.status.* / --vx-status-* for a verdict color, or the bare hue name (c="red") to let the theme resolve the shade per scheme.',
  },
  'raw-spacing': {
    kind: 'raw-spacing',
    pattern: (cfg: GuardConfig) =>
      new RegExp(
        `\\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap)=\\{(?:${cfg.spacingSteps.join('|')})\\}`,
        'g',
      ),
    // JSX-prop-shaped (`p={16}`) — CSS has no `=`/`{}` prop syntax; gated off explicitly (see
    // off-identity-accent above for why "never matches today" still gets an explicit gate).
    appliesTo: (relPath) => !relPath.endsWith('.css'),
    message: 'Use the Mantine spacing prop/token (p/m/gap with xs..xl).',
  },
  'raw-radius': {
    kind: 'raw-radius',
    pattern: RADIUS_PROP_RE,
    enabled: (cfg: GuardConfig) => cfg.rawRadius,
    // JSX-prop-shaped (`radius={6}`) — CSS declares `border-radius: 6px;`, never `radius=`.
    appliesTo: (relPath) => !relPath.endsWith('.css'),
    message: 'Use the radius token (radius="md") instead of a numeric literal.',
  },
  'raw-surface': {
    kind: 'raw-surface',
    pattern: SURFACE_BORDER, // handled inline; this entry exists so the registry is complete
    enabled: (cfg: GuardConfig) => cfg.rawSurface,
    message:
      'Inline border/radius/shadow on a surface — a card already carries its depth (VX.shadowCard) and shape (var(--vx-radius-card)) from the theme; use VX.surface.* / a radius token instead.',
  },
  'card-with-border': {
    kind: 'card-with-border',
    pattern: CARD_SURFACE_TAG, // handled inline (full-text tag-scoped scan); entry keeps registry complete
    enabled: (cfg: GuardConfig) => cfg.cardWithBorder,
    // JSX-tag-shaped (`<Card withBorder>`) — never appears in CSS text.
    appliesTo: (relPath) => !relPath.endsWith('.css'),
    message:
      'withBorder on a Card/Paper double-draws the edge — card depth is --vx-shadow-card, which already bakes a 1px ring into the shadow. Drop the prop (docs/DESIGN-SPEC.md doctrine inversion #1).',
  },
  'off-system-surface-var': {
    kind: 'off-system-surface-var',
    pattern: OFF_SYSTEM_SURFACE_VAR,
    enabled: (cfg: GuardConfig) => cfg.offSystemSurfaceVar,
    message:
      'Raw Mantine ramp step bypasses the basalt surface tokens — use VX.surface.* / --vx-surface-* instead.',
  },
  'raw-html-layout': {
    kind: 'raw-html-layout',
    pattern: RAW_HTML_TAG, // handled inline (3-condition conjunction); entry keeps registry complete
    enabled: (cfg: GuardConfig) => cfg.rawHtmlLayout,
    // JSX-tag-shaped (`<div style={{...}}>`) — never appears in CSS text. Also excluded from
    // chart files: the remedy (Box/Flex/Grid/Stack/Group) is `@mantine/*`, and src/charts/** is a
    // lint-enforced Mantine-free layer (basalt/token-layer-boundary) — so inside a chart file the
    // finding is unactionable, not merely inconvenient, and the only "fix" would be a theme-allow
    // comment written inside the very directory this rule protects.
    appliesTo: (relPath) => !isChartFile(relPath) && !relPath.endsWith('.css'),
    message:
      'Raw HTML element with inline layout/surface styling — use a Mantine layout primitive (Box/Flex/Grid/Stack/Group).',
  },
  'inline-spacing': {
    kind: 'inline-spacing',
    pattern: INLINE_SPACING,
    enabled: (cfg: GuardConfig) => cfg.inlineSpacing,
    message: 'Inline spacing literal — use the Mantine spacing prop/token (p/m/gap with xs..xl).',
  },
  'inline-display': {
    kind: 'inline-display',
    pattern: INLINE_DISPLAY,
    enabled: (cfg: GuardConfig) => cfg.inlineDisplay,
    // JSX-object-shaped (`display: 'flex'`, quoted value) — CSS never quotes a keyword value
    // (`display: flex;` is bare), so the pattern's quote anchor can never match real CSS. Also
    // excluded from chart files: the remedy (Flex/Grid/Group) is `@mantine/*`, and src/charts/**
    // is a lint-enforced Mantine-free layer (basalt/token-layer-boundary) — so inside a chart file
    // the finding is unactionable, not merely inconvenient, and the only "fix" would be a
    // theme-allow comment written inside the very directory this rule protects.
    appliesTo: (relPath) => !isChartFile(relPath) && !relPath.endsWith('.css'),
    message: 'Use <Flex>/<Grid>/<Group> instead of an inline display:flex/grid.',
  },
  'raw-visx-axis': {
    kind: 'raw-visx-axis',
    pattern: RAW_VISX_AXIS,
    enabled: (cfg: GuardConfig) => cfg.rawVisxAxis,
    // Compose the existing chart-file scope with the CSS gate — a chart-file CSS module (none
    // exist today, but the boundary should hold regardless) still can't carry a JSX axis tag.
    appliesTo: (relPath) => isChartFile(relPath) && !relPath.endsWith('.css'),
    message:
      'Raw <AxisLeft>/<AxisBottom>/<AxisRight> in a chart file — use AxisLeftNumeric / AxisBottomDate / AxisRightNumeric.',
  },
  'raw-motion-value': {
    kind: 'raw-motion-value',
    pattern: MOTION_TRANSITION_NUMERIC, // handled inline (2-regex kind); entry keeps registry complete
    enabled: (cfg: GuardConfig) => cfg.rawMotionValue,
    // JSX-prop-shaped (`transition={{ duration: … }}`) — CSS's `transition:` property has no `=`
    // or `{{`.
    appliesTo: (relPath) => !relPath.endsWith('.css'),
    message:
      'Route animation timing through MOTION_DURATION / MOTION_SPRING / MOTION_EASE_STANDARD (basalt-ui motion tokens) instead of a hardcoded duration/spring/ease.',
  },
  'unframed-chart': {
    kind: 'unframed-chart',
    pattern: RAW_CHART_LEGEND_ARRAY, // handled inline (full-text tag-scoped scan); entry keeps registry complete
    enabled: (cfg: GuardConfig) => cfg.unframedChart,
    // JSX-tag-shaped (`<ChartLegend items={[…]}>`) — never appears in CSS text.
    appliesTo: (relPath) => !relPath.endsWith('.css'),
    message:
      'Hand-rolled ChartLegend built from an inline array literal — pass a derived legend (deriveLegend(series)), or compose ChartFrame, which derives it for you.',
  },
  'chart-missing-aria-label': {
    kind: 'chart-missing-aria-label',
    pattern: CHART_ENTRY_POINT_TAG, // handled inline (full-text tag-scoped scan); entry keeps registry complete
    enabled: (cfg: GuardConfig) => cfg.chartMissingAriaLabel,
    // JSX-tag-shaped (`<MultiLine …>`) — never appears in CSS text.
    appliesTo: (relPath) => !relPath.endsWith('.css'),
    message:
      'Chart has no accessible text alternative — pass ariaLabel="…" so screen readers get more than an unlabeled graphic.',
  },
  'raw-form-control': {
    kind: 'raw-form-control',
    pattern: RAW_FORM_CONTROL,
    enabled: (cfg: GuardConfig) => cfg.rawFormControl,
    // JSX-tag-shaped (`<input …>`) — a CSS element selector (`input, select {…}`) has no leading
    // `<`, so the pattern's anchor can never match real CSS.
    appliesTo: (relPath) => !relPath.endsWith('.css'),
    message:
      'Raw <input>/<select>/<textarea> bypasses the ENTIRE theme, not just the font-size floor — no field surface, no shadow-card depth, no focus ring, no --input-* vars. Use TextInput / NumberInput / Select / Textarea from @mantine/core, or variant="unstyled" for a genuinely borderless/bespoke look.',
  },
  'sub-16-input-font': {
    kind: 'sub-16-input-font',
    pattern: SUB_16_FONT_SIZE, // handled inline (full-text tag-scoped scan); entry keeps registry complete
    enabled: (cfg: GuardConfig) => cfg.sub16InputFont,
    // Only ever fires nested inside a raw-form-control JSX tag or a `styles={{ input: {…} }}`
    // object literal — both JSX-shaped, neither appears in CSS text.
    appliesTo: (relPath) => !relPath.endsWith('.css'),
    message:
      'fontSize below 16 on a form control is dead code — the styles.css iOS floor is `!important` and always wins. Either drop the override, or be honest about 16px in the design.',
  },
  'theme-allow-unscoped': {
    kind: 'theme-allow-unscoped',
    pattern: /theme-allow/, // handled inline (annotation pass); entry keeps the registry complete
    message:
      'theme-allow without a usable rule id and a reason. Write `theme-allow <rule-id> — <why>`: the id scopes the exception to that one kind (a bare comment waives EVERY kind on the line, including ones added later), and the reason is what makes it reviewable in a diff. An id that names no rule is a typo, not a blanket waiver — it suppresses nothing. `theme-allow-file <rule-id> — <why>` declares the whole file, and must name its ids: a bare one waives nothing.',
  },
  'surface-shadow-override': {
    kind: 'surface-shadow-override',
    pattern: SHADOW_DECL, // handled inline (value is judged, not just matched)
    enabled: (cfg: GuardConfig) => cfg.rawSurface,
    message:
      'Token-composed boxShadow that REPLACES surface depth — a card whose shadow drops --vx-shadow-card is the one card in the app with no depth. Compose with the depth token for its tier (`${VX.shadowCard}, <your ring>`; a fixed/floating surface wants --vx-shadow-overlay) rather than instead of it.',
  },
  'css-raw-surface': {
    kind: 'css-raw-surface',
    pattern: CSS_SURFACE_RADIUS, // handled inline (value is judged); entry keeps the registry complete
    enabled: (cfg: GuardConfig) => cfg.rawSurface,
    // The kebab dialect only exists in CSS text; the camelCase half is `raw-surface`.
    appliesTo: (relPath) => relPath.endsWith('.css'),
    message:
      'Surface literal in CSS — use var(--vx-radius-card|--vx-radius-md) for a corner and var(--vx-shadow-card) for depth, the same tokens the TSX side is held to.',
  },
  'hidden-inline-style': {
    kind: 'hidden-inline-style',
    pattern: RAW_HTML_LAYOUT_TAG, // handled inline (full-text tag-scoped scan + hoisted-const lookup)
    enabled: (cfg: GuardConfig) => cfg.rawHtmlLayout,
    appliesTo: (relPath) => !isChartFile(relPath) && !relPath.endsWith('.css'),
    message:
      'Raw HTML element with inline layout/surface styling that the line scan cannot see — the tag is formatted across lines, or the style object is hoisted to a const. Same violation as raw-html-layout: use a Mantine layout primitive (Box/Flex/Grid/Stack/Group). Promoted to error at 1.26.0 (C16) with severity only — the kind stayed standalone rather than folding into raw-html-layout as originally planned; the merge is still open, tracked as a follow-up, not done here.',
  },
  'in-body-page-title': {
    kind: 'in-body-page-title',
    pattern: PAGE_TITLE_TAG, // handled inline (full-text tag-scoped scan); entry keeps the registry complete
    // JSX-tag-shaped (`<Title order={1}>`) — never appears in CSS text.
    appliesTo: (relPath) => !relPath.endsWith('.css'),
    message:
      'In-body page title — a page is named ONCE, by the breadcrumb (staticData.title) or by PageBar.title in a shell-less app, and every section/card/table title is a WidgetHeader (docs/CONTROLS-SPEC.md law C8). An <Title order={1|2}> in the body is a second name for the same page, and it drifts. Prose / ArticleLayout / an overlay and anything under a content/ path are document headings and never report. Same law the oxlint plugin enforces as basalt/in-body-page-title — one id, two lanes, so one theme-allow covers both.',
  },
  'raw-selection-control': {
    kind: 'raw-selection-control',
    pattern: RAW_SELECTION_CONTROL_TAG, // handled inline (full-text tag-scoped scan + host window)
    // JSX-tag-shaped (`<Select …>`) — never appears in CSS text.
    appliesTo: (relPath) => !relPath.endsWith('.css'),
    message:
      'Raw selection control with no home — a filter or tab belongs in a PageBar / Section / WidgetHeader slot and takes a `field` (a FieldHandle), so it owns the URL write and the localStorage mirror instead of carrying value/onChange (docs/CONTROLS-SPEC.md laws C1–C3). Use the bound control from basalt-ui/controls. A settings row, an overlay and an @mantine/form file are the declared non-homes and never report. This is the TEXT lane of basalt/control-outside-home, which answers the same question against the real AST — where the two disagree, the plugin is right.',
  },
  'inline-font-size': {
    kind: 'inline-font-size',
    pattern: INLINE_FONT_SIZE,
    message:
      'Raw font-size literal — route through VX.text.* (numbers) / --vx-text-* (CSS), or the Mantine fz token. Same rule the oxlint plugin enforces as basalt/no-raw-font-size; this is the half a check-theme-only CI can see.',
  },
} as const satisfies Record<GuardKind, GuardRule>

/**
 * The one-line remedy for `kind`, as a report reads it: `raw-hex: Route color through VX.* / …`.
 *
 * The registry has always carried a remedy per kind; `check-theme`'s `Fix:` epilogue read a
 * hand-duplicated subset instead, and the subset was missing every kind added at 1.20.0. Since all
 * five of those ship `warn` under grace, the findings whose whole argument is "this looks correct
 * and is not" arrived with no argument at all — just "add a `theme-allow`", which reads as advice to
 * waive. Sourcing the epilogue from here retires the duplicate rather than extending it.
 */
export function guardKindRemedy(kind: GuardKind): string {
  return `${kind}: ${(GUARD_RULES[kind] as GuardRule).message}`
}

/** JSON and its manifest dialect — the file class with no comment syntax to carry an annotation. */
const JSON_FAMILY_FILE = /\.(?:webmanifest|json)$/

/**
 * How to waive a finding **in this file's syntax** — the closer a report prints under `Fix:`.
 *
 * `check-theme` printed one closer for every file class, and from 1.20.0 (when the scan reached
 * `.webmanifest` / `.json`) it prescribed a `theme-allow` comment to files that cannot hold a
 * comment. Two consumers read that, found no route, and fell back to a blanket `exemptRules` entry —
 * the un-reviewable shape the release was spent retiring.
 *
 * A manifest gets the sharper answer first, because a hex there can never be *right*: a manifest
 * cannot reference a CSS custom property, so the value is a hand-copy of a token that drifts the day
 * the palette moves (which is exactly what both consumers found — two dead colours). The remedy is
 * to stop hand-writing the file: `basaltAppPlugin` emits it from `SURFACE.bg`. The annotation is the
 * fallback for a manifest basalt does not generate.
 */
export function guardWaiverHint(relPath: string): string {
  if (relPath.endsWith('.webmanifest')) {
    return (
      'A manifest cannot reference a CSS variable, so a hex here is a hand-copy that drifts: let ' +
      'basaltAppPlugin emit it (`manifest: { … }` in vite.config.ts) instead of hand-writing it. ' +
      'For a manifest basalt does not generate, declare the exception with a ' +
      '`"basalt:theme-allow-file": "raw-hex — <why>"` member.'
    )
  }
  if (JSON_FAMILY_FILE.test(relPath)) {
    return (
      'JSON has no comments — declare a deliberate exception with a ' +
      '`"basalt:theme-allow-file": "<rule-id> — <why>"` member.'
    )
  }
  return 'Add a `theme-allow <rule-id> — <why>` comment for a deliberate exception (`theme-allow-file` declares the whole file).'
}

/** Whether `kind`'s rule fires for `relPath` — `appliesTo` is opt-in; absent means always applies. */
function ruleApplies(kind: GuardKind, relPath: string): boolean {
  const appliesTo = (GUARD_RULES[kind] as GuardRule).appliesTo
  return appliesTo === undefined || appliesTo(relPath)
}

// ── checkSource ───────────────────────────────────────────────────────────────────────────────────

/**
 * Scan ONE file's text for theme-guard violations. Pure: same (text, relPath, cfg) → same Finding[].
 * No FS, no walk, no console. The 3 dynamic regexes (forbiddenAccent, spacing, radius) are derived
 * INTERNALLY from cfg. isChartFile(relPath) is applied internally so the oxlint-plugin /
 * PreToolUse-hook adapters get correct kind-applicability for free.
 *
 * @example
 * const findings = checkSource(src, 'src/Dashboard.tsx', DEFAULT_GUARD_CONFIG)
 * if (findings.some((f) => f.kind === 'raw-hex')) { ... }
 */
export function checkSource(text: string, relPath: string, cfg: GuardConfig): Finding[] {
  const lines = text.split('\n')

  // Lines basalt itself generated are not consumer source — `tokens:css` emits nothing BUT hex and
  // rgba() by construction. See generatedTokenLines for why the marker alone is not enough, and
  // why the exemption is per line rather than per file.
  const generatedLines = generatedTokenLines(relPath, lines, cfg.allowComment)

  // Severity and text are stamped once at the end rather than at each of the ~20 push sites — both
  // are derived from state the push sites don't need: severity from the KIND and the config, text
  // from the finding's own `line` against the source split above.
  const findings: Omit<Finding, 'severity' | 'text'>[] = []

  // Derive the 3 dynamic regexes via GUARD_RULES pattern builders.
  const forbiddenAccentRe = (
    GUARD_RULES['off-identity-accent'].pattern as (cfg: GuardConfig) => RegExp
  )(cfg)
  const spacingPropRe = (GUARD_RULES['raw-spacing'].pattern as (cfg: GuardConfig) => RegExp)(cfg)
  // raw-radius uses a static pattern (module const) — clone via source + flags to reset lastIndex.
  const radiusPropRe = new RegExp(
    (GUARD_RULES['raw-radius'].pattern as RegExp).source,
    (GUARD_RULES['raw-radius'].pattern as RegExp).flags,
  )

  // Comment-stripped text drives every match below; `lines` (the ORIGINAL, unstripped split) is
  // kept to resolve the allow-comment escape, since that annotation lives inside a comment the
  // stripped text has already blanked out. Same length / same newline positions as `text`, so line
  // numbers computed off either one agree.
  const syntax = guardSyntaxFor(relPath)
  const codeText = stripGuardComments(text, syntax)
  const codeLines = codeText.split('\n')
  const { waivers, fileScoped, declared } = collectAllowAnnotations(
    lines,
    codeLines,
    cfg.allowComment,
    syntax,
  )

  /** Kinds a `theme-allow-file` declared for the whole file — resolved once, not per finding. */
  const fileWaived = new Set<GuardKind>()
  for (const annotation of fileScoped) {
    for (const rule of annotation.rules) {
      if (Object.hasOwn(GUARD_RULES, rule)) fileWaived.add(rule as GuardKind)
    }
  }

  /** Is `kind` waived at (1-based) `line`? See `collectAllowAnnotations` for the full grammar. */
  const isAllowed = (line: number, kind: GuardKind): boolean =>
    fileWaived.has(kind) || annotationsCover(waivers.get(line - 1), kind)

  const isAllowedInRange = (start: number, end: number, kind: GuardKind): boolean => {
    for (let n = start; n <= end; n++) if (isAllowed(n, kind)) return true
    return false
  }

  const push = (kind: GuardKind, line: number, token: string): void => {
    if (isAllowed(line, kind)) return
    findings.push({ relPath, line, token, kind })
  }

  // theme-allow accountability. Reported directly rather than through `push`: a bare annotation
  // covers every kind, so routing it through the waiver check would let it waive the report of its
  // own unaccountability. `basalt.severity` / `exemptRules` are the ways to turn it down.
  for (const { line, annotation } of declared) {
    if (annotation.unknownRules.length === 0 && annotation.rules.length > 0 && annotation.hasReason)
      continue
    // "waives nothing" is only true when NO id resolved. With one that did, the typo costs its own
    // id and nothing else — saying otherwise contradicts the findings the same run suppressed.
    const unknown = `unknown rule id '${annotation.unknownRules.join("', '")}'`
    const missing =
      annotation.unknownRules.length > 0
        ? annotation.rules.length === 0
          ? `${unknown} — waives nothing`
          : `${unknown} — not waived`
        : annotation.rules.length === 0
          ? 'no rule id'
          : 'no reason'
    findings.push({
      relPath,
      line,
      token: `${cfg.allowComment} (${missing})`,
      kind: 'theme-allow-unscoped',
    })
  }

  /** Lines the line-scoped `raw-html-layout` already owns, so `hidden-inline-style` can't double-report. */
  const rawHtmlLayoutLines = new Set<number>()

  /** Offset of each line's start in `codeText` — lets a line-scoped match ask about its surroundings. */
  const lineStarts: number[] = []
  for (let n = 0, i = 0; i < codeLines.length; i++) {
    lineStarts.push(n)
    n += (codeLines[i] ?? '').length + 1
  }

  /** Every identifier the file hands to a `style=`/`styles=` prop — see `isStyleObjectContext`. */
  const styleIdentifiers = new Set(
    [...codeText.matchAll(STYLE_BOUND_IDENTIFIER)].map((m) => m[1] ?? ''),
  )

  for (let i = 0; i < lines.length; i++) {
    const line = codeLines[i] ?? ''

    // Always-on kinds (raw-hex, raw-color-fn, localstorage-theme) — patterns from GUARD_RULES.
    for (const m of line.matchAll(GUARD_RULES['raw-hex'].pattern as RegExp)) {
      push('raw-hex', i + 1, m[0])
    }
    for (const m of line.matchAll(GUARD_RULES['raw-color-fn'].pattern as RegExp)) {
      push('raw-color-fn', i + 1, m[0])
    }
    if (ruleApplies('localstorage-theme', relPath)) {
      for (const m of line.matchAll(GUARD_RULES['localstorage-theme'].pattern as RegExp)) {
        push('localstorage-theme', i + 1, m[0])
      }
    }
    for (const m of line.matchAll(GUARD_RULES['raw-font-family'].pattern as RegExp)) {
      push('raw-font-family', i + 1, m[0])
    }
    for (const m of line.matchAll(GUARD_RULES['inline-font-size'].pattern as RegExp)) {
      push('inline-font-size', i + 1, m[0])
    }

    // Dynamic-regex kinds — patterns already resolved above.
    if (ruleApplies('off-identity-accent', relPath)) {
      for (const m of line.matchAll(forbiddenAccentRe)) {
        push('off-identity-accent', i + 1, m[1] ?? '')
      }
    }
    if (ruleApplies('raw-spacing', relPath)) {
      for (const m of line.matchAll(spacingPropRe)) push('raw-spacing', i + 1, m[0])
    }
    if (GUARD_RULES['raw-radius'].enabled!(cfg) && ruleApplies('raw-radius', relPath)) {
      for (const m of line.matchAll(radiusPropRe)) push('raw-radius', i + 1, m[0])
    }

    // raw-surface + its two younger siblings, all gated on the same `rawSurface` knob:
    //   • raw-surface            — the camelCase (TSX inline-style) literals, unchanged;
    //   • css-raw-surface        — the kebab dialect, which the camelCase patterns never saw;
    //   • surface-shadow-override — a shadow built FROM tokens that still drops card depth.
    if (GUARD_RULES['raw-surface'].enabled!(cfg)) {
      for (const m of line.matchAll(SURFACE_BORDER)) push('raw-surface', i + 1, m[0])
      for (const m of line.matchAll(SURFACE_RADIUS)) push('raw-surface', i + 1, m[0])

      if (syntax === 'css') {
        for (const m of line.matchAll(CSS_SURFACE_RADIUS)) {
          const value = m[1] ?? ''
          if (!/\d/.test(value) || isAllowedCssRadius(value)) continue
          push('css-raw-surface', i + 1, m[0].trim())
        }
        for (const m of line.matchAll(CSS_SURFACE_SHADOW)) {
          const value = m[1] ?? ''
          // A var-composed shadow in a CSS MODULE is deliberately not judged. `surface-shadow-
          // override` is about a Card/Paper losing `--vx-shadow-card`; a module's own
          // `box-shadow: var(--field-depth)` is a focus ring, an inset, a notch — component
          // styling with no card identity at stake. Only the CSS-in-JS dialect, where the shadow
          // sits on a Mantine surface prop, carries that claim.
          if (SHADOW_IS_COMPOSED.test(value) || /^\s*none\s*$/.test(value)) continue
          push('css-raw-surface', i + 1, m[0].trim())
        }
      } else {
        for (const m of line.matchAll(SHADOW_DECL)) {
          const value = m[2] ?? ''
          if (!SHADOW_IS_COMPOSED.test(value)) {
            push('raw-surface', i + 1, m[0])
            continue
          }
          if (SHADOW_KEEPS_CARD_DEPTH.test(value)) continue
          push('surface-shadow-override', i + 1, m[0])
        }
      }
    }

    // off-system-surface-var — pattern + gating from GUARD_RULES.
    if (GUARD_RULES['off-system-surface-var'].enabled!(cfg)) {
      for (const m of line.matchAll(GUARD_RULES['off-system-surface-var'].pattern as RegExp)) {
        push('off-system-surface-var', i + 1, m[0])
      }
    }

    // mantine-shade-index — the sibling of off-system-surface-var above, partitioned by hue: that
    // kind owns gray/dark (surface color), this one owns every other shade-pinned step (verdict and
    // accent color). Both halves of the pattern (JSX prop + var()) run in every file type; see the
    // pattern's own comment for why this kind carries no appliesTo gate.
    if (GUARD_RULES['mantine-shade-index'].enabled!(cfg)) {
      for (const m of line.matchAll(GUARD_RULES['mantine-shade-index'].pattern as RegExp)) {
        push('mantine-shade-index', i + 1, m[0])
      }
    }

    // raw-html-layout: 3-condition conjunction on the same line — gated via GUARD_RULES entry.
    // Its widened, formatting-independent half is `hidden-inline-style`, scanned below.
    if (
      GUARD_RULES['raw-html-layout'].enabled!(cfg) &&
      ruleApplies('raw-html-layout', relPath) &&
      RAW_HTML_TAG.test(line) &&
      INLINE_STYLE.test(line) &&
      LAYOUT_SURFACE_PROP.test(line)
    ) {
      rawHtmlLayoutLines.add(i + 1)
      push('raw-html-layout', i + 1, '<raw-html style>')
    }

    // inline-spacing — pattern + gating from GUARD_RULES, plus the CSS-only sub-scale escape and
    // the TS-only style-object test for a unitless number (see isStyleObjectContext).
    if (GUARD_RULES['inline-spacing'].enabled!(cfg)) {
      for (const m of line.matchAll(GUARD_RULES['inline-spacing'].pattern as RegExp)) {
        if (syntax === 'css' && isSubScaleCssSpacing(line, m.index)) continue
        const hasUnit = /^[a-z%]/.test(line.slice(m.index + m[0].length))
        if (
          // An SFC's script fence IS TS, so it takes the same gate — without it a unitless
          // `padding: 8` in `.astro`/`.vue` frontmatter reports with no style-object behind it.
          (syntax === 'ts' || syntax === 'sfc') &&
          !hasUnit &&
          !isStyleObjectContext(codeText, lineStarts[i]! + m.index, styleIdentifiers)
        )
          continue
        push('inline-spacing', i + 1, m[0])
      }
    }

    // inline-display — pattern + gating from GUARD_RULES.
    if (GUARD_RULES['inline-display'].enabled!(cfg) && ruleApplies('inline-display', relPath)) {
      for (const m of line.matchAll(GUARD_RULES['inline-display'].pattern as RegExp)) {
        push('inline-display', i + 1, m[0])
      }
    }

    // raw-visx-axis — pattern + gating + path applicability (chart-file scope AND CSS gate,
    // composed on the registry's own appliesTo) from GUARD_RULES.
    if (
      GUARD_RULES['raw-visx-axis'].enabled!(cfg) &&
      GUARD_RULES['raw-visx-axis'].appliesTo!(relPath)
    ) {
      for (const m of line.matchAll(GUARD_RULES['raw-visx-axis'].pattern as RegExp)) {
        push('raw-visx-axis', i + 1, m[0])
      }
    }

    // raw-motion-value: 2 separate regex checks, one kind — gated via GUARD_RULES entry.
    if (GUARD_RULES['raw-motion-value'].enabled!(cfg) && ruleApplies('raw-motion-value', relPath)) {
      for (const m of line.matchAll(MOTION_TRANSITION_NUMERIC))
        push('raw-motion-value', i + 1, m[0])
      for (const m of line.matchAll(MOTION_TRANSITION_EASE_ARRAY)) {
        push('raw-motion-value', i + 1, m[0])
      }
    }

    // raw-form-control — pattern + gating from GUARD_RULES.
    if (GUARD_RULES['raw-form-control'].enabled!(cfg) && ruleApplies('raw-form-control', relPath)) {
      for (const m of line.matchAll(GUARD_RULES['raw-form-control'].pattern as RegExp)) {
        push('raw-form-control', i + 1, m[0])
      }
    }
  }

  // hidden-inline-style — the formatting-independent half of raw-html-layout. Bounded full-text tag
  // scan (the `card-with-border` model), plus one hoisted-const lookup, so neither `<div\n  style=`
  // nor `style={wrapperStyle}` walks past a rule that catches the identical single-line form.
  if (
    GUARD_RULES['hidden-inline-style'].enabled!(cfg) &&
    ruleApplies('hidden-inline-style', relPath)
  ) {
    for (const m of codeText.matchAll(RAW_HTML_LAYOUT_TAG)) {
      const tagText = m[0]
      let styleBody = ''
      if (INLINE_STYLE.test(tagText)) styleBody = tagText
      else {
        const ident = STYLE_IDENTIFIER.exec(tagText)?.[1]
        if (ident !== undefined) styleBody = hoistedObjectBody(codeText, ident)
      }
      if (styleBody === '' || !LAYOUT_SURFACE_PROP.test(styleBody)) continue
      const startLine = codeText.slice(0, m.index ?? 0).split('\n').length
      if (rawHtmlLayoutLines.has(startLine)) continue
      const endLine = startLine + (tagText.split('\n').length - 1)
      if (isAllowedInRange(startLine, endLine, 'hidden-inline-style')) continue
      findings.push({
        relPath,
        line: startLine,
        token: '<raw-html style>',
        kind: 'hidden-inline-style',
      })
    }
  }

  // Both chart tag rules below gate on tag PROVENANCE (see the block above LOCAL_COMPONENT_DEF).
  // Computed once, and only if one of the two actually runs.
  const unframedChartRuns =
    GUARD_RULES['unframed-chart'].enabled!(cfg) && ruleApplies('unframed-chart', relPath)
  const ariaLabelRuns =
    GUARD_RULES['chart-missing-aria-label'].enabled!(cfg) &&
    ruleApplies('chart-missing-aria-label', relPath)
  const localNames =
    unframedChartRuns || ariaLabelRuns ? localComponentNames(codeText) : new Set<string>()
  const basaltNames =
    unframedChartRuns || ariaLabelRuns ? basaltImportedNames(codeText) : new Set<string>()
  const isShippedTag = (tag: string): boolean => basaltNames.has(tag) || !localNames.has(tag)

  // unframed-chart — full-text tag-scoped scan (not per-line, see RAW_CHART_LEGEND_ARRAY comment).
  // Scans `codeText` (comment-stripped) so a legend example inside a comment can't match; reports
  // at the line of the `items={[` token itself. Skipped wholesale when `ChartLegend` is this file's
  // OWN component: a consumer's legend taking an `items` array is not the shipped one that derives
  // its entries, and the remedy ("pass deriveLegend(series)") is unreachable there.
  if (unframedChartRuns && isShippedTag('ChartLegend')) {
    for (const m of codeText.matchAll(RAW_CHART_LEGEND_ARRAY)) {
      const lineNo = codeText.slice(0, (m.index ?? 0) + m[0].length).split('\n').length
      push('unframed-chart', lineNo, 'items={[')
    }
  }

  // chart-missing-aria-label — full-text tag-scoped scan (same shape as unframed-chart above).
  // A tag is a violation only when its own (possibly multi-line) prop list has no `ariaLabel=`.
  // Reports at the tag's OPENING line, like card-with-border below and unlike the end-of-match
  // arithmetic this used to do: on a multi-line-formatted chart the end lands on the closing `/>`,
  // which is what `Finding.text` would then quote back — the closing bracket rather than the tag
  // that is missing the prop. The allow-comment is honored anywhere in the tag's span, so a
  // `theme-allow` that used to sit on the closing line keeps working.
  if (ariaLabelRuns) {
    for (const m of codeText.matchAll(CHART_ENTRY_POINT_TAG)) {
      const tagText = m[0]
      // A tag this file defines itself is not the shipped kind — it does not take `ariaLabel`.
      if (!isShippedTag(m[1] as string)) continue
      if (HAS_ARIA_LABEL_PROP.test(tagText)) continue
      const startLine = codeText.slice(0, m.index ?? 0).split('\n').length
      const endLine = startLine + (tagText.split('\n').length - 1)
      if (isAllowedInRange(startLine, endLine, 'chart-missing-aria-label')) continue
      findings.push({
        relPath,
        line: startLine,
        token: tagText.slice(0, 40),
        kind: 'chart-missing-aria-label',
      })
    }
  }

  // card-with-border — full-text tag-scoped scan (same shape as the two above). Reports at the line
  // of the `withBorder` token itself (not the end of the tag) so a multi-line-formatted Card points
  // the fix at the prop to delete.
  if (GUARD_RULES['card-with-border'].enabled!(cfg) && ruleApplies('card-with-border', relPath)) {
    for (const m of codeText.matchAll(CARD_SURFACE_TAG)) {
      const withBorder = WITH_BORDER_PROP.exec(m[0])
      if (withBorder === null) continue
      const lineNo = codeText.slice(0, (m.index ?? 0) + withBorder.index).split('\n').length
      push('card-with-border', lineNo, 'withBorder')
    }
  }

  // in-body-page-title — full-text tag scan (the card-with-border shape), because a `<Title>` with
  // its props on separate lines is the formatted default. `order` is judged on the tag's own text.
  //
  // Two file-level exemptions, both deliberately coarser than the plugin's node-level ones and both
  // false-NEGATIVE-only: anything under a `content/` path segment, and any file that renders
  // `<Prose>` / `<ArticleLayout>` / an overlay anywhere in it. A text scan has no ancestry, so
  // "under Prose" is not answerable per node — and a document heading told to become a breadcrumb is
  // the wrong advice, not merely noise. `basalt/in-body-page-title` (the AST lane, same id) is the
  // half that scopes this exactly.
  if (
    ruleApplies('in-body-page-title', relPath) &&
    !relPath.split('/').includes('content') &&
    !PROSE_CONTEXT_TAG.test(codeText)
  ) {
    for (const m of codeText.matchAll(PAGE_TITLE_TAG)) {
      const order = PAGE_TITLE_ORDER_PROP.exec(m[0])
      if (order === null) continue
      const startLine = codeText.slice(0, m.index ?? 0).split('\n').length
      const endLine = startLine + (m[0].split('\n').length - 1)
      if (isAllowedInRange(startLine, endLine, 'in-body-page-title')) continue
      findings.push({
        relPath,
        line: startLine,
        token: `<Title order={${order[1]}}`,
        kind: 'in-body-page-title',
      })
    }
  }

  // raw-selection-control — full-text tag scan plus the host WINDOW (see CONTROL_HOST_WINDOW_LINES).
  // Three file-level exemptions mirror the plugin rule's, so the two lanes agree on the same file:
  // a file that DEFINES a basalt control cannot be told to use one, a file importing
  // `@mantine/form` is a form — C1's third home, whose inputs are not filters — and a file NAMED as
  // an overlay body carries its `<Modal>` in the parent, where no scan of this file can reach it.
  if (
    ruleApplies('raw-selection-control', relPath) &&
    !OVERLAY_CONVENTION_FILE.test(relPath) &&
    !CONTROL_OWNER_DEF.test(codeText) &&
    !MANTINE_FORM_IMPORT.test(codeText)
  ) {
    for (const m of codeText.matchAll(RAW_SELECTION_CONTROL_TAG)) {
      const startLine = codeText.slice(0, m.index ?? 0).split('\n').length
      const windowStart = Math.max(0, startLine - 1 - CONTROL_HOST_WINDOW_LINES)
      if (CONTROL_HOST_TAG.test(codeLines.slice(windowStart, startLine).join('\n'))) continue
      const endLine = startLine + (m[0].split('\n').length - 1)
      if (isAllowedInRange(startLine, endLine, 'raw-selection-control')) continue
      findings.push({
        relPath,
        line: startLine,
        token: `<${m[1] ?? 'Select'}`,
        kind: 'raw-selection-control',
      })
    }
  }

  // sub-16-input-font — two full-text scans (same shape as the tag-scoped scans above): (a) a raw
  // form-control's own inline `style={{ fontSize: N }}`, (b) a Mantine `styles={{ input: { fontSize:
  // N } }}` per-part style. Either shape is now DEAD CODE against the `!important` floor in
  // styles.css — see the guard's doc comment for exactly which shapes this covers.
  if (GUARD_RULES['sub-16-input-font'].enabled!(cfg) && ruleApplies('sub-16-input-font', relPath)) {
    for (const m of codeText.matchAll(RAW_FORM_CONTROL_TAG)) {
      const tagText = m[0]
      if (!INLINE_STYLE.test(tagText)) continue
      const fontSizeMatch = [...tagText.matchAll(SUB_16_FONT_SIZE)][0]
      if (fontSizeMatch === undefined) continue
      const value = Number.parseFloat(fontSizeMatch[1] ?? '')
      if (!Number.isFinite(value) || value >= 16) continue
      const lineNo = codeText.slice(0, (m.index ?? 0) + tagText.length).split('\n').length
      push('sub-16-input-font', lineNo, fontSizeMatch[0])
    }

    for (const m of codeText.matchAll(STYLES_INPUT_PART)) {
      const inputBody = m[1] ?? ''
      const fontSizeMatch = [...inputBody.matchAll(SUB_16_FONT_SIZE)][0]
      if (fontSizeMatch === undefined) continue
      const value = Number.parseFloat(fontSizeMatch[1] ?? '')
      if (!Number.isFinite(value) || value >= 16) continue
      const lineNo = codeText.slice(0, (m.index ?? 0) + m[0].length).split('\n').length
      push('sub-16-input-font', lineNo, fontSizeMatch[0])
    }
  }

  // Post-filters, applied once here so they uniformly cover every kind regardless of whether it was
  // emitted via the GUARD_RULES registry loop above or one of the inline-handled kinds:
  //   • generated     — the lines of a stylesheet basalt itself emitted (empty for every other file);
  //   • §exemptRules — per-rule, per-path consumer exemptions;
  //   • markup       — an HTML document / JSON manifest has no JSX and no CSS-in-JS, so only the
  //                    color/typography kinds are meaningful there;
  //   • profile      — a tokens-only consumer is not told to install @mantine/core.
  //
  // `text` is stamped here too, in the same single post-pass, off the ORIGINAL (unstripped) `lines`
  // split — never `codeLines` — so a finding on a line whose comment was stripped still reports the
  // real source text a human would read.
  return findings
    .filter((f) => !generatedLines.has(f.line))
    .filter((f) => !isRuleExempt(f.kind, f.relPath, cfg.exemptRules))
    .filter((f) => syntax !== 'markup' || MARKUP_KINDS.has(f.kind))
    .filter((f) => cfg.profile !== 'tokens-only' || !TOKENS_ONLY_DISABLED_KINDS.has(f.kind))
    .map((f) => ({
      ...f,
      text: textForFinding(lines[f.line - 1], f.token),
      severity: severityOf(f.kind, cfg),
    }))
}

// ── Allow-annotation enumeration (check-theme --audit-allows) ─────────────────────────────────────

/**
 * One `theme-allow` annotation as WRITTEN, classified by whose reach its ids fall in.
 *
 * `guardKinds` is what `checkSource` can judge by re-running itself with the annotation
 * neutralized. `pluginRules` is what only an `oxlint` run can judge. `unknownRules` names no rule
 * at all. All three empty with `bare: true` is the legacy blanket form.
 */
export type AllowAnnotationSite = {
  /** 1-based line the annotation is written on. */
  readonly line: number
  /** `'file'` for the `theme-allow-file` declaration form, `'line'` otherwise. */
  readonly scope: 'line' | 'file'
  /** Every id the annotation names that resolves to a real rule, `basalt/` prefix stripped. */
  readonly rules: readonly string[]
  /** The subset of `rules` `checkSource` owns. */
  readonly guardKinds: readonly GuardKind[]
  /** The subset of `rules` the oxlint plugin owns — outside `checkSource`'s reach. */
  readonly pluginRules: readonly string[]
  /** Words that occupied the id slot but name no rule. Their presence makes the parse fail closed. */
  readonly unknownRules: readonly string[]
  /** A written reason follows the ids. */
  readonly hasReason: boolean
  /** The legacy blanket form — no ids at all, known or unknown. Only covers anything at line scope. */
  readonly bare: boolean
  /** The source line, verbatim. */
  readonly text: string
}

/**
 * Every allow annotation in one file, with the ids it names classified by reach.
 *
 * Pure, and it shares `collectAllowAnnotations` with {@link checkSource} — so a caller enumerating
 * annotations sees exactly the set the scan honours, rather than a second regex that can drift from
 * it. `--audit-allows` carried such a mirror and it was already one alternation behind.
 *
 * A file-scoped declaration appears once, at the line it is written on.
 *
 * @example
 * for (const site of findAllowAnnotations(text, rel, cfg)) {
 *   if (site.pluginRules.length > 0) probeWithOxlint(neutralizeAllowAnnotation(text, site.line, cfg))
 * }
 */
export function findAllowAnnotations(
  text: string,
  relPath: string,
  cfg: GuardConfig,
): AllowAnnotationSite[] {
  const lines = text.split('\n')
  const syntax = guardSyntaxFor(relPath)
  const codeText = stripGuardComments(text, syntax)
  const { declared } = collectAllowAnnotations(
    lines,
    codeText.split('\n'),
    cfg.allowComment,
    syntax,
  )
  return declared.map(({ line, annotation }) => ({
    line,
    scope: annotation.scope,
    rules: [...annotation.rules],
    guardKinds: annotation.rules.filter((id): id is GuardKind => Object.hasOwn(GUARD_RULES, id)),
    pluginRules: annotation.rules.filter(
      (id) => !Object.hasOwn(GUARD_RULES, id) && PLUGIN_RULE_IDS.has(id),
    ),
    unknownRules: [...annotation.unknownRules],
    hasReason: annotation.hasReason,
    bare: annotation.rules.length === 0 && annotation.unknownRules.length === 0,
    text: lines[line - 1] ?? '',
  }))
}

/** The token a neutralized annotation is rewritten to. Shares no substring with `theme-allow`. */
export const NEUTRALIZED_ALLOW_TOKEN = 'basalt-audit-neutralized'

/**
 * `text` with the allow token on ONE (1-based) line rewritten to {@link NEUTRALIZED_ALLOW_TOKEN},
 * leaving every other annotation intact.
 *
 * The probe half of an audit: re-scan the result and the findings that appear are exactly what that
 * one annotation suppresses. Shipped rather than left to each caller so the guard probe and the
 * oxlint probe neutralize identically — a `--audit-allows` verdict that differs between the two
 * halves by a substitution detail is worse than no verdict.
 *
 * A line with no token comes back unchanged.
 */
export function neutralizeAllowAnnotation(text: string, line: number, cfg: GuardConfig): string {
  const lines = text.split('\n')
  const target = lines[line - 1]
  if (target === undefined) return text
  lines[line - 1] = target.replaceAll(cfg.allowComment, NEUTRALIZED_ALLOW_TOKEN)
  return lines.join('\n')
}
