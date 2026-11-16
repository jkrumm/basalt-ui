/**
 * The closed D0 stylelint preset (static-framework-free 4.2, guardrails 5/6): ten stylelint core
 * rules plus the colour-as-decoration property map, all expressed as data so the shipped config is a
 * pure function of this file. Regexes are strings in stylelint's `"/.../flags"` form because the
 * rendered `.stylelintrc.basalt.json` cannot carry a RegExp.
 *
 * A property list cannot be value-conditioned (guardrails E4), so every spacing/type rule is a
 * `declaration-property-value-*` rule. Optical offsets and the like take
 * `stylelint-disable-next-line <rule> -- <reason>`; the preset also reports needless and
 * descriptionless disables.
 */

// Every CSS length unit except `%`, which stays legal.
const UNITS =
  'px|rem|em|ex|ch|lh|rlh|cap|ic|vw|vh|vmin|vmax|vi|vb|[sld]v[whib]|[sld]vmin|[sld]vmax|cq[whib]|cqmin|cqmax|pt|pc|cm|mm|q|in'
// `-1px` is a raw length too; the lookbehind stops a unit match from starting inside a word.
const RAW_LENGTH = `(?<![\\w])[+-]?(?:\\d*\\.)?\\d+(?:${UNITS})\\b`

// A token reference, and the closed atoms the shape-restricted properties accept.
const VX_VAR = 'var\\(--vx-[a-z0-9-]+\\)'
const ATOM = `(?:${VX_VAR}|0|none|inherit)`
const ALLOWED_SHAPE = `^${ATOM}(?:\\s*[,\\s]\\s*${ATOM})*$`

// color-mix(in <space> [<hue-method> hue], <vx var|transparent> [pct], <vx var|transparent> [pct])
const MIX_COLOUR = `(?:${VX_VAR}|transparent)`
const MIX_STOP = `${MIX_COLOUR}(?:\\s+[\\d.]+%)?`
const CLEAN_MIX_BODY = `\\s*in\\s+[a-z0-9-]+(?:\\s+(?:shorter|longer|increasing|decreasing)\\s+hue)?\\s*,\\s*${MIX_STOP}\\s*,\\s*${MIX_STOP}\\s*\\)`

// Roles that are spent as text, `fill` or `stroke`, never as a surface, border, outline or shadow.
const DECORATIVE_ROLE =
  'var\\(\\s*--vx-(?:(?:good|warn|bad|info|brand|chart|seq)(?:-[a-z0-9-]+)?|[a-z0-9-]*-tint)\\s*[,)]'

// The class rules' spacing set: padding, margin, gap, the inset and its four sides, the type size.
export const SPACING_PROPERTIES =
  '/^(?:scroll-)?(?:padding|margin)(?:-[a-z]+)*$|^(?:grid-)?(?:row-|column-)?gap$|^inset(?:-[a-z]+)*$|^(?:top|right|bottom|left)$|^font(?:-size)?$/'
export const SHAPE_PROPERTIES =
  '/^(?:border(?:-[a-z]+)*-radius|box-shadow|line-height|letter-spacing)$/'
export const DECORATION_PROPERTIES =
  '/^(?:background(?:-[a-z]+)*|border(?:-[a-z]+)*|outline(?:-[a-z]+)*|box-shadow)$/'
// `overlay` is the deprecated alias of `auto`; `hidden`, `clip` and `visible` do not scroll.
export const SCROLL_PROPERTIES = '/^overflow(?:-x|-y|-block|-inline)?$/'
export const SCROLL_VALUES = '/\\b(?:auto|scroll|overlay)\\b/i'

/**
 * `%s` takes the property, then the value. A rule carries one `message`, and the config is JSON, so a
 * function of the property cannot ship: the message names the fix per property group instead, each
 * clause led by the properties it answers, and a variant without the scroll clause where the ban is off.
 */
const MESSAGE_BASE =
  'Disallowed `%s: %s`. By property: padding, margin, gap, inset (top, right, bottom, left) and font size take a --vx token (or 0, auto, %), never a raw length or calc(); background, border, outline and shadow take the colour role of their surface, never a status or chart colour; color-mix runs over --vx tokens or transparent only'
const MESSAGE_SCROLL = `${MESSAGE_BASE}; overflow auto|scroll is ui/scroll-area, or let Page own the scroll.`
const MESSAGE_NO_SCROLL = `${MESSAGE_BASE}.`

/**
 * The value-disallowed list. `scroll` adds the scroll-container ban, the stylesheet twin of the
 * raw-scroll class rule: it holds from `parts` up, where `ui/scroll-area` ships; a `tokens` or
 * `bridge` file has no such primitive, so its config omits the entry.
 */
export function disallowedValueList(
  scroll: boolean,
): readonly [Record<string, string[]>, { message: string }] {
  return [
    {
      // colour mixing is only legal over tokens or transparent
      '/.*/': [`/color-mix\\((?!${CLEAN_MIX_BODY})/i`],
      // raw lengths and calc() on spacing and the type size (D0: tokens, 0, auto, %)
      [SPACING_PROPERTIES]: [`/${RAW_LENGTH}/i`, '/\\bcalc\\(/i'],
      // colour as decoration
      [DECORATION_PROPERTIES]: [`/${DECORATIVE_ROLE}/i`],
      ...(scroll ? { [SCROLL_PROPERTIES]: [SCROLL_VALUES] } : {}),
    },
    { message: scroll ? MESSAGE_SCROLL : MESSAGE_NO_SCROLL },
  ]
}

/** The ten rules, keyed by stylelint rule name. Order is the order of the section 4.2 table. */
export const STYLELINT_RULES = {
  'color-no-hex': [
    true,
    {
      message:
        'A hex colour `%s` is authored colour. Use a `--vx-*` colour token (`var(--vx-ink)`), or `color-mix` over one.',
    },
  ],
  'color-named': [
    'never',
    {
      message:
        'The named colour `%s` is authored colour. Use a `--vx-*` colour token, or `color-mix` over one.',
    },
  ],
  'function-disallowed-list': [
    ['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color', 'light-dark'],
    {
      message:
        '`%s()` writes a colour by hand. Use a `--vx-*` colour token, or `color-mix(in oklab, var(--vx-token) 40%, transparent)` for an alpha; a token already switches per scheme.',
    },
  ],
  'declaration-property-value-disallowed-list': disallowedValueList(true),
  'declaration-property-value-allowed-list': [
    {
      [SHAPE_PROPERTIES]: [`/${ALLOWED_SHAPE}/i`],
    },
    {
      message:
        'Disallowed `%s: %s`. Radius, shadow, line height and letter spacing take a `--vx-*` token, `0`, `none` or `inherit`.',
    },
  ],
  'property-disallowed-list': [
    ['/^--vx-/'],
    {
      message:
        'Never declare `%s`: a `--vx-*` token is derived from the palette config, not authored. Read it with `var()`, or retune `basalt()` options.',
    },
  ],
  'declaration-no-important': [
    true,
    {
      message:
        'Never force a style with `!important`. Add a variant or prop on the component, or raise the layer.',
    },
  ],
  'media-feature-name-disallowed-list': [
    ['/^(?:min-|max-)?(?:width|height|aspect-ratio|device-[a-z-]+)$/', 'prefers-color-scheme'],
    {
      message:
        'The media feature `%s` keys styles on the window or the system scheme. A viewport feature: key on the container, `@container` with a named size (`@narrow`, `@regular`, `@wide`), or `useSizeClass()` for chrome. `prefers-color-scheme`: tokens switch per scheme, so use a `--vx-*` token instead of a dark fork.',
    },
  ],
  'selector-disallowed-list': [
    ['/\\[\\s*data-slot/', '/\\.mantine-/', '/\\[\\s*data-theme/', '/\\.dark(?![\\w-])/'],
    {
      message:
        "Never select `%s`. A `data-slot` or `.mantine-*` selector reaches into a component: use the component's own prop or variant, or eject it (basalt-ui eject <name>). A `data-theme` or `.dark` selector forks a colour per scheme: tokens switch per scheme, so use a `--vx-*` token instead.",
    },
  ],
  'at-rule-disallowed-list': [
    ['utility', 'theme', 'custom-variant', 'apply'],
    {
      // `%s` is the at-rule with its `@` already (stylelint passes `@utility`)
      message:
        '`%s` adds to or rebuilds what the package owns: a utility class, a theme colour, a variant or a class list the class rules check. Take colour from Status, Lozenge, DeltaBadge or a Num tone (the palette is derived, never declared per app); tokens switch per scheme, so a dark variant is a `--vx-*` token instead; compose the shipped component and its variants, or a `--vx-*` token in a module stylesheet.',
    },
  ],
} as const
