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

export const SPACING_PROPERTIES =
  '/^(?:padding|margin)(?:-[a-z]+)*$|^(?:row-|column-)?gap$|^font-size$/'
export const SHAPE_PROPERTIES =
  '/^(?:border(?:-[a-z]+)*-radius|box-shadow|line-height|letter-spacing)$/'
export const DECORATION_PROPERTIES =
  '/^(?:background(?:-[a-z]+)*|border(?:-[a-z]+)*|outline(?:-[a-z]+)*|box-shadow)$/'

/** The ten rules, keyed by stylelint rule name. Order is the order of the section 4.2 table. */
export const STYLELINT_RULES = {
  'color-no-hex': true,
  'color-named': 'never',
  'function-disallowed-list': [
    'rgb',
    'rgba',
    'hsl',
    'hsla',
    'hwb',
    'lab',
    'lch',
    'oklab',
    'oklch',
    'color',
    'light-dark',
  ],
  'declaration-property-value-disallowed-list': {
    // colour mixing is only legal over tokens or transparent
    '/.*/': [`/color-mix\\((?!${CLEAN_MIX_BODY})/i`],
    // raw lengths and calc() on spacing and the type size (D0: tokens, 0, auto, %)
    [SPACING_PROPERTIES]: [`/${RAW_LENGTH}/i`, '/\\bcalc\\(/i'],
    // colour as decoration
    [DECORATION_PROPERTIES]: [`/${DECORATIVE_ROLE}/i`],
  },
  'declaration-property-value-allowed-list': {
    [SHAPE_PROPERTIES]: [`/${ALLOWED_SHAPE}/i`],
  },
  'property-disallowed-list': ['/^--vx-/'],
  'declaration-no-important': true,
  'media-feature-name-disallowed-list': [
    '/^(?:min-|max-)?(?:width|height|aspect-ratio|device-[a-z-]+)$/',
  ],
  'selector-disallowed-list': ['/\\[\\s*data-slot/', '/\\.mantine-/'],
  'at-rule-disallowed-list': ['utility'],
} as const
