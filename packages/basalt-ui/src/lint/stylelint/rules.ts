/**
 * The closed D0 stylelint preset (static-framework-free 4.2, guardrails 5/6): ten stylelint core
 * rules plus the color-as-decoration property map, all expressed as data so the shipped config is a
 * pure function of this file. Regexes are strings in stylelint's `"/.../flags"` form because the
 * rendered `.stylelintrc.basalt.json` cannot carry a RegExp.
 *
 * A property list cannot be value-conditioned (guardrails E4), so every spacing/type rule is a
 * `declaration-property-value-*` rule. Optical offsets and the like take
 * `stylelint-disable-next-line <rule> -- <reason>`; the preset also reports needless and
 * descriptionless disables.
 */

import { bridgeEntries } from '../../tokens/table'
import { zoneAFillOnly } from '../generated/zone-a'

// Every CSS length unit except `%`, which stays legal.
const UNITS =
  'px|rem|em|ex|ch|lh|rlh|cap|ic|vw|vh|vmin|vmax|vi|vb|[sld]v[whib]|[sld]vmin|[sld]vmax|cq[whib]|cqmin|cqmax|pt|pc|cm|mm|q|in'
// `-1px` is a raw length too; the lookbehind stops a unit match from starting inside a word.
const RAW_LENGTH = `(?<![\\w])[+-]?(?:\\d*\\.)?\\d+(?:${UNITS})\\b`

// A token reference, and the closed atoms the shape-restricted properties accept.
const BASALT_VAR = 'var\\(--basalt-[a-z0-9-]+\\)'
const ATOM = `(?:${BASALT_VAR}|0|none|inherit)`
const ALLOWED_SHAPE = `^${ATOM}(?:\\s*[,\\s]\\s*${ATOM})*$`
// A radius also takes a circle or a pill, which no token stands for: `50%`, `9999px`, `calc(infinity * 1px)`.
const RADIUS_ATOM = `(?:${ATOM}|50%|9999px|calc\\(\\s*infinity\\s*\\*\\s*1px\\s*\\))`
const ALLOWED_RADIUS = `^${RADIUS_ATOM}(?:\\s+${RADIUS_ATOM})*$`
export const RADIUS_PROPERTIES = '/^border(?:-[a-z]+)*-radius$/'

// color-mix(in <space> [<hue-method> hue], <basalt var|transparent> [pct], <basalt var|transparent> [pct])
const MIX_COLOR = `(?:${BASALT_VAR}|transparent)`
const MIX_STOP = `${MIX_COLOR}(?:\\s+[\\d.]+%)?`
const CLEAN_MIX_BODY = `\\s*in\\s+[a-z0-9-]+(?:\\s+(?:shorter|longer|increasing|decreasing)\\s+hue)?\\s*,\\s*${MIX_STOP}\\s*,\\s*${MIX_STOP}\\s*\\)`

// Tailwind v4 exposes every token as `--color-<role>`; a value list reads that spelling beside `--basalt-<role>`.
const TOKEN_PREFIX = '--(?:basalt|color)-'

// Roles that are spent as text, `fill` or `stroke`, never as a surface, border, outline or shadow.
const DECORATIVE_ROLE = `var\\(\\s*${TOKEN_PREFIX}(?:(?:good|warn|bad|info|brand|chart|seq|destructive)(?:-[a-z0-9-]+)?|[a-z0-9-]*-tint)\\s*[,)]`

// The fill-only roles (`zoneAFillOnly`): a fill clears 3.0 and text needs 4.5, so never as `color`.
// A status tint (`--color-warn-tint`, a 12-16% wash of the ink) is a background and never text either.
const FILL_ONLY_ROLE = `var\\(\\s*${TOKEN_PREFIX}(?:${zoneAFillOnly.join('|')}|[a-z0-9-]*-tint)\\s*[,)]`
// The class rule `fixed-width`: above 384px or from 25rem (`w-[385px]`, `w-[25rem]`).
export const FIXED_WIDTH = `(?<![\\w.])(?:(?:38[5-9]|39\\d|[4-9]\\d{2}|\\d{4,})(?:\\.\\d+)?px|(?:2[5-9]|[3-9]\\d|\\d{3,})(?:\\.\\d+)?rem)(?![\\w%])`

// The class rules' spacing set: padding, margin, gap, the inset and its four sides, the type size.
export const SPACING_PROPERTIES =
  '/^(?:scroll-)?(?:padding|margin)(?:-[a-z]+)*$|^(?:grid-)?(?:row-|column-)?gap$|^inset(?:-[a-z]+)*$|^(?:top|right|bottom|left)$|^font(?:-size)?$/'
export const SHAPE_PROPERTIES =
  '/^(?:border(?:-[a-z]+)*-radius|box-shadow|line-height|letter-spacing)$/'
export const DECORATION_PROPERTIES =
  '/^(?:background(?:-[a-z]+)*|border(?:-[a-z]+)*|outline(?:-[a-z]+)*|box-shadow)$/'
// `overlay` is the deprecated alias of `auto`; `hidden`, `clip` and `visible` do not scroll.
export const TEXT_COLOR_PROPERTIES = '/^color$/'
// A width, and a flex basis (`flex-basis`, the basis of the `flex` shorthand: its grow and shrink
// are unitless, so a length in it is the basis).
export const WIDTH_PROPERTIES = '/^(?:(?:min-)?width|flex(?:-basis)?)$/'
// the template and its shorthand, and the implicit tracks
export const TRACK_PROPERTIES = '/^grid-(?:template(?:-columns|-rows)?|auto-(?:columns|rows))$/'
export const SCROLL_PROPERTIES = '/^overflow(?:-x|-y|-block|-inline)?$/'
export const SCROLL_VALUES = '/\\b(?:auto|scroll|overlay)\\b/i'

/**
 * The `--color-*`, `--radius-*` and `--font-*` names the basalt theme defines, from the same
 * `@theme inline` map that renders `tailwind.css` (`bridgeEntries()`), as one stylelint regex.
 * An app's own `--my-gap` stays free; re-pointing a theme name overrides the package's mapping.
 */
const THEME_NAMES = bridgeEntries()
  .map((entry) => entry.tw)
  .filter((name) => /^--(?:color|radius|font)-/.test(name))
const THEME_PROPERTY = `/^(?:${THEME_NAMES.join('|')})$/`

/**
 * One property group of the value list: the properties, the values banned on them, the fix.
 * `roles` narrows the fix by the reported value: `basalt-ui lint` quotes the first role whose
 * pattern the value matches, in place of the group's clause.
 */
type ValueGroup = {
  properties: string
  values: string[]
  clause: string
  roles?: readonly { value: string; clause: string }[]
  scrollOnly?: true
}

/** A transition or animation timing longhand, or the shorthands that carry one. */
const MOTION_PROPERTIES = '/^(?:transition|animation)(?:-(?:duration|delay|timing-function))?$/'
/** A literal time other than 0s or 0ms (`300ms`, `.3s`): the lookahead lets a zero time through. */
const MOTION_TIME =
  '/(?<![\\w.])(?!-?0+(?:\\.0+)?m?s(?![\\w-]))-?(?:\\d+\\.\\d+|\\.\\d+|\\d+)m?s(?![\\w-])/i'
const MOTION_EASE_FUNCTION = '/(?<![\\w-])(?:cubic-bezier|steps|linear)\\(/i'
const MOTION_EASE_KEYWORD = '/(?<![\\w-])(?:ease|ease-in|ease-out|ease-in-out|linear)(?![\\w-])/i'

const STATUS_ROLE = `var\\(\\s*${TOKEN_PREFIX}(?:good|warn|bad|info|destructive)(?:-[a-z0-9-]+)?\\s*[,)]`
const CHART_ROLE = `var\\(\\s*${TOKEN_PREFIX}(?:chart|seq)(?:-[a-z0-9-]+)?\\s*[,)]`
const DECORATION_LEAD =
  'background, border, outline and shadow take the color role of their surface'

/**
 * The groups in message order. `scrollOnly` marks the bans that hold from `parts` up, as their
 * class rules do: the scroll container (raw-scroll; `ui/scroll-area` ships there) and the fixed
 * width (`tw-off-law` `fixed-width`, a parts-only form).
 */
const VALUE_GROUPS: readonly ValueGroup[] = [
  {
    // raw lengths and calc() on spacing and the type size (D0: tokens, 0, auto, %)
    properties: SPACING_PROPERTIES,
    values: [`/${RAW_LENGTH}/i`, '/\\bcalc\\(/i'],
    clause:
      'padding, margin, gap and inset (top, right, bottom, left) take a --basalt-rhythm-* token (--basalt-rhythm-1 to -3), 0, auto or %, and font size a --basalt-text-* token, never a raw length or calc()',
  },
  {
    properties: DECORATION_PROPERTIES,
    values: [`/${DECORATIVE_ROLE}/i`],
    clause: `${DECORATION_LEAD}, never a status, chart or brand color: a status color or tint is Status, Lozenge, DeltaBadge or a Num tone, a chart color belongs to a chart kind, and only a brand tint is var(--basalt-selected) or a surface token`,
    roles: [
      {
        value: `/${STATUS_ROLE}/i`,
        clause: `${DECORATION_LEAD}, never a status color or tint: Status, Lozenge, DeltaBadge or a Num tone own status color in app code`,
      },
      {
        value: `/${CHART_ROLE}/i`,
        clause: `${DECORATION_LEAD}, never a chart color: a series color belongs to a chart kind from basalt-ui/charts`,
      },
      {
        value: `/${DECORATIVE_ROLE}/i`,
        clause: `${DECORATION_LEAD}, never a brand color (a tinted background is var(--basalt-selected) or a surface token)`,
      },
    ],
  },
  {
    // color mixing is only legal over tokens or transparent
    properties: '/.*/',
    values: [`/color-mix\\((?!${CLEAN_MIX_BODY})/i`],
    clause: 'color-mix runs over --basalt tokens or transparent only',
  },
  {
    // a fill-only role as text and a fixed track length (the class rules' twins, every profile)
    properties: TEXT_COLOR_PROPERTIES,
    values: [`/${FILL_ONLY_ROLE}/i`],
    clause:
      'color takes a text role (Status or Num tone from parts; text-good or text-brand at bridge), never a fill-only role (chart, seq, the brand fill, a status tint)',
  },
  {
    properties: TRACK_PROPERTIES,
    values: [`/${RAW_LENGTH}/i`],
    clause:
      'grid-template, grid-template-columns and -rows, grid-auto-columns and -rows size tracks by fr, auto or minmax(0,1fr), never a raw length',
  },
  {
    properties: WIDTH_PROPERTIES,
    values: [`/${FIXED_WIDTH}/i`],
    clause:
      'width, min-width and a flex basis above 384px are parent-owned (size the container, not the child)',
    scrollOnly: true,
  },
  {
    properties: SCROLL_PROPERTIES,
    values: [SCROLL_VALUES],
    clause: 'overflow auto|scroll is ui/scroll-area, or let Page own the scroll',
    scrollOnly: true,
  },
  {
    // A timing comes from the motion scale: the --basalt-dur-* and --basalt-ease-* variables.
    properties: MOTION_PROPERTIES,
    values: [MOTION_TIME, MOTION_EASE_FUNCTION, MOTION_EASE_KEYWORD],
    clause:
      'transition and animation take their time and easing from the motion scale: var(--basalt-dur-*) and var(--basalt-ease-*), never a literal time, a cubic-bezier, steps or linear timing function, or an easing keyword (0s and 0ms, the reduced-motion end state, stay legal)',
  },
]

const groupsFor = (scroll: boolean): readonly ValueGroup[] =>
  VALUE_GROUPS.filter((group) => scroll || group.scrollOnly !== true)

/**
 * `%s` takes the property, then the value. The rendered config is JSON, so the message cannot be a
 * function of the property: it carries every clause, each led by the properties it answers, and
 * `basalt-ui lint` narrows a report to its own clause (`valueListMessage`).
 */
const fullMessage = (scroll: boolean): string =>
  `Disallowed \`%s: %s\`. By property: ${groupsFor(scroll)
    .map((group) => group.clause)
    .join('; ')}.`

/**
 * The value-disallowed list. `scroll` adds the bans that hold from `parts` up; a `tokens` or
 * `bridge` file omits both.
 */
export function disallowedValueList(
  scroll: boolean,
): readonly [Record<string, string[]>, { message: string }] {
  return [
    Object.fromEntries(groupsFor(scroll).map((group) => [group.properties, group.values])),
    { message: fullMessage(scroll) },
  ]
}

/** A stylelint `"/source/flags"` string as a RegExp. */
const regexOf = (text: string): RegExp => {
  const match = /^\/(.*)\/([a-z]*)$/s.exec(text)
  return match ? new RegExp(match[1] as string, match[2]) : new RegExp(text)
}

const REPORTED = /^Disallowed `([^:`]+): ([^`]*)`\./

/**
 * The value list's report narrowed to the clause of the reported property: the groups whose
 * properties and banned values both match it, so `overflow: auto` reads only the scroll clause and
 * `padding: 13px` only the spacing one. Text with no `Disallowed` head or no matching group is
 * returned as it is. The allowed-list rule prints the same head, so the caller passes this rule's
 * reports only.
 */
export function valueListMessage(text: string): string {
  const match = REPORTED.exec(text)
  if (!match) return text
  const [head, property = '', value = ''] = match
  const clauses = VALUE_GROUPS.filter(
    (group) =>
      regexOf(group.properties).test(property) &&
      group.values.some((pattern) => regexOf(pattern).test(value)),
  ).map(
    (group) => group.roles?.find((role) => regexOf(role.value).test(value))?.clause ?? group.clause,
  )
  if (clauses.length === 0) return text
  const body = clauses.join('; ')
  return `${head} ${body.charAt(0).toUpperCase()}${body.slice(1)}.`
}

/** The ten rules, keyed by stylelint rule name. Order is the order of the section 4.2 table. */
export const STYLELINT_RULES = {
  'color-no-hex': [
    true,
    {
      message:
        'A hex color `%s` is authored color. Use a `--basalt-*` color token (`var(--basalt-ink)`), or `color-mix` over one.',
    },
  ],
  'color-named': [
    'never',
    {
      message:
        'The named color `%s` is authored color. Use a `--basalt-*` color token, or `color-mix` over one.',
    },
  ],
  'function-disallowed-list': [
    ['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color', 'light-dark'],
    {
      message:
        "`%s()` writes a color by hand. Use the `--basalt-*` color token of the property's role (a surface for a background, an ink for text), or `color-mix(in oklab, var(--basalt-token) 40%, transparent)` over that token for an alpha; a token already switches per scheme.",
    },
  ],
  'declaration-property-value-disallowed-list': disallowedValueList(true),
  'declaration-property-value-allowed-list': [
    {
      // radius first: stylelint reads the first property key that matches
      [RADIUS_PROPERTIES]: [`/${ALLOWED_RADIUS}/i`],
      [SHAPE_PROPERTIES]: [`/${ALLOWED_SHAPE}/i`],
    },
    {
      message:
        'Disallowed `%s: %s`. Radius, shadow, line height and letter spacing take a `--basalt-*` token, `0`, `none` or `inherit`; a radius also takes `50%` or `9999px` for a circle or a pill (`rounded-full` in a class).',
    },
  ],
  'property-disallowed-list': [
    ['/^--basalt-/', THEME_PROPERTY],
    {
      message:
        'Never declare `%s`: a `--basalt-*` token is derived from the palette config, and a `--color-*`, `--radius-*` or `--font-*` theme name maps it, so neither is authored. Read it with `var()`, or retune `basalt()` options.',
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
    [
      '/^(?:min-|max-)?(?:width|height|aspect-ratio|device-[a-z-]+|orientation)$/',
      'prefers-color-scheme',
    ],
    {
      message:
        'The media feature `%s` keys styles on the window or the system scheme. A viewport feature (width, height, aspect ratio, orientation): key on the container, `@container` with a named size (`@narrow`, `@regular`, `@wide`), or `useSizeClass()` for chrome. `prefers-color-scheme`: tokens switch per scheme, so use a `--basalt-*` token instead of a dark fork.',
    },
  ],
  'selector-disallowed-list': [
    [
      '/\\[\\s*data-slot/',
      '/\\.mantine-/',
      '/\\[\\s*data-theme/',
      '/\\.dark(?![\\w-])/',
      '/\\[\\s*class\\s*[~*^]=\\s*["\']?dark/',
    ],
    {
      message:
        "Never select `%s`. A `data-slot` or `.mantine-*` selector reaches into a component: use the component's own prop or variant, or eject it (basalt-ui eject <name>). A `data-theme` or `.dark` selector forks a color per scheme: tokens switch per scheme, so use a `--basalt-*` token instead.",
    },
  ],
  'at-rule-disallowed-list': [
    [
      'utility',
      'theme',
      'custom-variant',
      'variant',
      'plugin',
      'apply',
      'config',
      'custom-media',
      'tailwind',
    ],
    {
      // `%s` is the at-rule with its `@` already (stylelint passes `@utility`)
      message:
        "`%s` adds to or rebuilds what the package owns: a utility class, a theme color, a variant, the classes of a plugin, a class list the class rules check or a tailwind.config file that declares them. Take color from Status, Lozenge, DeltaBadge or a Num tone (the palette is derived, never declared per app); tokens switch per scheme, so a `@variant dark` fork is a `--basalt-*` token instead (add the token instead of forking); long-form text is `Prose` from basalt-ui/page, never a typography plugin; compose the shipped component and its variants, or a `--basalt-*` token in a module stylesheet. A `@custom-media` names a viewport query: key on the container, `@container` with a named size (`@narrow`, `@regular`, `@wide`). `@tailwind` is Tailwind v3's layer directive: the package owns the layers, so the one basalt stylesheet import is all a module needs, and no layer is written.",
    },
  ],
} as const
