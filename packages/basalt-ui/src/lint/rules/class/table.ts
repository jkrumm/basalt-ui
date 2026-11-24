/**
 * The class-rule family: nine ids, thirty-three enabled forms and one built-but-off form, all data
 * (guardrails section 4, rows 1-7). The factory turns each entry into an oxlint/ESLint rule; this
 * module holds the patterns, the fix each message names and the next rung of the bending ladder.
 *
 * Color names are never typed here: `generated/zone-a.ts` (from `tokens/emit.ts`) is the one
 * source of the earned names, the pre-mixed alpha roles, the fill-only roles and the utilities
 * denied outright.
 */
import { deniedCurrent, zoneAFillOnly, zoneANames, zoneAPremixed } from '../../generated/zone-a'
import type { Profile, Zone } from '../../rule-table'
import { defineRules } from '../../rule-table'
import {
  borderedCard,
  inlineStyleForm,
  mediaQueryForm,
  platformGlyphForm,
  PROFILE_GATE_SCHEMA,
  partsOnly,
  partsOnlyExceptSeamMark,
  partsOnlyExceptStyleVar,
  schemeForkForm,
  sideStripe,
  wholeString,
} from './detect'

const ALL: readonly Profile[] = ['bridge', 'parts', 'app', 'repo', 'site']
const PARTS_UP: readonly Profile[] = ['parts', 'app', 'repo']
/** The static site (Astro pages, React parts, no client JS): bridge's rules plus logical-properties. */
const SITE: readonly Profile[] = ['site']
/** Zone V (vendored shadcn files, bridge only): the class rules are off there (section 6). */
const VENDORED: readonly Zone[] = ['vendored']

/**
 * An ejected or seed file is the primitive: it owns the color roles and the surface recipe
 * (guardrails section 6), so the forms written for app code are off there; `alpha-on-premixed` stays on.
 */
const ZONE_COLOR: readonly Zone[] = ['ejected', 'seed']

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** Longest first, so an alternation never settles for a prefix of a longer name. */
const alt = (items: readonly string[]): string =>
  items
    .toSorted((a, b) => b.length - a.length)
    .map(escape)
    .join('|')

/** A token starts here: at the beginning or after a variant colon, with an optional `!`. */
const HEAD = '(?:^|:)!?'
/** An optional `/NN` opacity modifier and a trailing `!`, then the end of the token. */
const TAIL = '(?:\\/[^\\s!]+)?!?$'

/** Utilities that take a color (the zone A denial list, tokens-visual 3.5, plus `text`). */
const COLOR_UTILITIES =
  'text|bg|border(?:-[xytrblse])?|ring(?:-offset)?|outline|divide|from|via|to|fill|stroke|decoration|accent|caret'
const COLOR_PREFIX = `(?:${COLOR_UTILITIES}|shadow)`

const SPACING_PREFIX =
  '(?:p[xytrblse]?|m[xytrblse]?|gap(?:-[xy])?|space-[xy]|inset(?:-[xy])?|top|right|bottom|left|start|end|size|w|h|min-w|min-h|max-w|max-h|basis|translate-[xy]|scroll-[mp][xytrblse]?)'

const TINTS = zoneANames.filter((name) => name.endsWith('-tint'))

/** `bg-current` is denied outright; an entry ending in `-` (`from-`) denies the whole family. */
const deniedOutright = deniedCurrent
  .map((entry) =>
    entry.endsWith('-') ? `${HEAD}${escape(entry)}` : `${HEAD}${escape(entry)}${TAIL}`,
  )
  .join('|')

/**
 * A ring or outline color under a focus variant (`focus-visible:`, `data-focused:`,
 * `group-focus-visible:` ...): no component owns a focus ring's color, so it is not app color.
 */
const FOCUS_RING_COLOR =
  '(?:[^:]+:)*[^:]*focus[^:]*:(?:[^:]+:)*!?(?:ring(?:-offset)?|outline)-[^:]*$'

const colorUtility = new RegExp(
  `^(?!${FOCUS_RING_COLOR})(?=.*(?:${HEAD}${COLOR_PREFIX}-(?:${alt(zoneANames)})${TAIL}|${deniedOutright}))`,
)
/**
 * The fills a mark can carry: the fill-only and status roles on `bg`, `fill` and `stroke`, and
 * `text-on-brand`, the ink a label on a brand fill takes. Other ink, the focus-ring and line roles
 * and every other prefix (border, outline) stay out, so a mark on the `useChartFocus` seam is
 * exempt from these and nothing else.
 */
const FILL_ROLES = [
  ...zoneAFillOnly,
  ...zoneANames.filter((name) => /^(?:brand|good|warn|bad|destructive|info)(?:-tint)?$/.test(name)),
]
const seamMarkFill = new RegExp(
  `${HEAD}(?:(?:bg|fill|stroke)-(?:${alt(FILL_ROLES)})|text-on-brand)${TAIL}`,
)

/**
 * A `--basalt-*` variable as an arbitrary value: `(--basalt-x)`, `[var(--basalt-x)]` or `[--basalt-x]`, each with
 * Tailwind v4's optional `color:` type hint (`(color:--basalt-x)`, `[color:var(--basalt-x)]`).
 */
const basaltArbitrary = (names: readonly string[]): string =>
  `\\((?:color:)?--basalt-(?:${alt(names)})\\)|\\[(?:color:)?(?:var\\()?--basalt-(?:${alt(names)})\\)?\\]`

/**
 * Any custom property as an arbitrary value, bare (`(--brand-blue)`, `[var(--x)]`) or with the
 * `color:` type hint. `text-(--x)` is read as a color: Tailwind types it by the hint, and only
 * `length:` (or `image:`, ...) makes it a size.
 */
const ANY_VAR = '--[a-z][\\w-]*'
const anyVarArbitrary = (hint: string): string =>
  `\\(${hint}${ANY_VAR}\\)|\\[${hint}(?:var\\()?${ANY_VAR}\\)?\\]`

/**
 * A color utility over a custom property: any variable under a color utility. A bare
 * `shadow-(--x)` is a box-shadow value, not a color, so `shadow` takes the `color:` hint, or a
 * `--basalt-*` color name as before.
 */
const colorArbitrary = new RegExp(
  `^(?!${FOCUS_RING_COLOR})(?=.*(?:` +
    `${HEAD}(?:${COLOR_UTILITIES})-(?:${anyVarArbitrary('(?:color:)?')})${TAIL}|` +
    `${HEAD}shadow-(?:${anyVarArbitrary('color:')}|${basaltArbitrary(zoneANames)})${TAIL}))`,
)

/** A fill-only role as text: the named utility, or the variable as an arbitrary value (`text-(color:--basalt-x)`). */
const textOnFill = new RegExp(
  `${HEAD}text-(?:${alt(zoneAFillOnly)}|${basaltArbitrary(zoneAFillOnly)})${TAIL}`,
)

/**
 * A dark-scheme variant: `dark:`, the theme attribute bare or quoted (`data-[theme='dark']:`, as the
 * Tailwind docs print it) on the element, a group (named or not: `group-data-[theme=dark]/shell:`), a
 * peer or an ancestor, each also negated (`not-dark:`, the light-only fork), its arbitrary-selector
 * spellings with or without an element before the attribute (`[[data-theme=dark]_&]:`,
 * `[html[data-theme=dark]_&]:`, `[.dark_&]:`) or inside `:where(…)`/`:is(…)`
 * (`[:where([data-theme=dark])_&]:`), the v4 self-selector spellings, `&` followed by `:is(…)` or
 * `:where(…)` holding the class or the attribute, comma lists included (`[&:is(.dark_*)]:`,
 * `[&:where(.dark,.dark_*)]:`; a `.darker` class or `:is(:hover)` is not one), the v4 `in-`/`group-`/`peer-`
 * arbitrary form holding the class or the attribute (`in-[.dark]:`, `group-[.dark]/app:`), and the color-scheme media query as an arbitrary variant
 * (`[@media(prefers-color-scheme:dark)]:`).
 */
const DARK_VARIANT =
  '(?:(?:(?:group|peer|in)-)?(?:not-)?(?:dark|data-\\[theme=["\']?dark["\']?\\])(?:\\/[\\w-]+)?|(?:group|peer|in)-\\[(?:\\.dark(?![A-Za-z0-9-])|data-theme=["\']?dark["\']?)\\](?:\\/[\\w-]+)?|\\[[\\w:-]*(?:\\([\\w-]*)?(?:\\[data-theme=["\']?dark["\']?\\]|\\.dark)\\)?_&\\]|\\[@media_?\\(prefers-color-scheme:_?dark\\)\\]|\\[&:(?:is|where)\\([^()]*?(?:\\[data-theme=["\']?dark["\']?\\]|\\.dark(?![A-Za-z0-9-]))[^()]*\\)\\]):'

/** A raw media query as an arbitrary variant that names a viewport feature, not a user preference. */
const MEDIA_FEATURE_VARIANT =
  '\\[@media[^\\]]*(?:width|height|aspect-ratio|orientation|device-)[^\\]]*\\]'

/** A viewport variant anywhere in the token's chain: `viewport-keyed` already reports it. */
const VIEWPORT_CHAIN = `(?:[^:]+:)*(?:(?:(?:max|min)-)?(?:sm|md|lg|xl|2xl)|portrait|landscape|(?:min|max)-\\[[^\\]]*\\]|${MEDIA_FEATURE_VARIANT}):`

export const CLASS_RULES = defineRules({
  'viewport-keyed': {
    family: 'class',
    profiles: ALL,
    zonesOff: VENDORED,
    schema: [PROFILE_GATE_SCHEMA],
    defect:
      'console 39 viewport-keyed classes, rollhook 14, shutterflow 16; epos `md:` kill; `max-md:` compiles because `md` and `xl` stay live',
    forms: [
      {
        id: 'breakpoint-prefix',
        // `portrait:` and `landscape:` are the orientation variants: the viewport's, not the container's.
        pattern: /(?:^|:)(?:(?:(?:max|min)-)?(?:sm|md|lg|xl|2xl)|portrait|landscape):/,
        fix: 'Key on the container: @narrow: @regular: @wide:',
        next: 'useSizeClass is for chrome only; viewport-keyed is never file-waivable',
        fixture: 'class/viewport-keyed/breakpoint-prefix.tsx',
      },
      {
        id: 'arbitrary-query',
        // `min-[900px]:` and the raw media query as an arbitrary variant, `[@media(min-width:900px)]:`,
        // read for the viewport features the stylelint preset bans: width, height, aspect ratio,
        // orientation and the device forms.
        pattern: new RegExp(`(?:^|:)!?(?:(?:min|max)-\\[[^\\]]*\\]|${MEDIA_FEATURE_VARIANT}):`),
        fix: 'Key on the container: @narrow: @regular: @wide:',
        next: 'useSizeClass is for chrome only; viewport-keyed is never file-waivable',
        fixture: 'class/viewport-keyed/arbitrary-query.tsx',
      },
      {
        id: 'media-query',
        detect: mediaQueryForm,
        // An ejected primitive is chrome: the sheet's one viewport read (its swipe axis) is the
        // primitive's, so the JS form is off there; its classes stay keyed on the container.
        zonesOff: ['ejected'],
        fix: 'useSizeClass for chrome; page layout keys on the container with @narrow: @regular: @wide:, never on a touch probe; a hit target that grows for touch keys on pointer: coarse (the pointer-coarse: variant)',
        next: 'viewport-keyed is never file-waivable; fix it at source',
        fixture: 'class/viewport-keyed/media-query.tsx',
      },
      {
        id: 'platform-glyph',
        detect: platformGlyphForm,
        zonesOff: ['ejected'],
        fix: "A shortcut glyph is <Kbd>Mod</Kbd> from basalt-ui/ui/kbd (⌘ on Apple, Ctrl elsewhere); a registered command prints its own chord; a handler that picks metaKey or ctrlKey by the platform is a command with chord: 'Mod+S' in defineCommands from basalt-ui/shell, which reads the right key on each platform",
        next: 'A platform test that picks no glyph (an installer, a platform build) is waived on its line, with the reason',
        fixture: 'class/viewport-keyed/platform-glyph.tsx',
      },
    ],
  },

  'dark-fork': {
    family: 'class',
    profiles: ALL,
    zonesOff: VENDORED,
    // A JS fork on the scheme is `scheme-fork`: a scheme test (a scheme value read by name compared
    // with 'dark' or 'light', the color-scheme query's `.matches` or media hook, a boolean named
    // for the dark scheme, or a const bound to one, through useMemo or useCallback too) where it
    // chooses a class string or a cn() class key, a cva/tv variant group keyed dark and light, and
    // a scheme store of the app's own: `.dark` on the root's classList or className, or data-theme
    // written by hand. Known limit: a scheme under another name or returned outside a class
    // position is not read (no type-aware rule ties a value to a scheme read).
    defect:
      'epos 21 `dark:` forks in app code and 40 in vendored ui; `@custom-variant dark` keys to `data-theme`, so a fork compiles and diverges from the token switch',
    forms: [
      {
        id: 'dark-variant',
        pattern: new RegExp(`(?:^|:)${DARK_VARIANT}`),
        fix: 'Tokens switch per scheme: add the token instead of forking with dark:',
        next: 'A reasoned per-line waiver',
        fixture: 'class/dark-fork/dark-variant.tsx',
      },
      {
        id: 'scheme-fork',
        detect: schemeForkForm,
        fix: 'BasaltProvider owns the scheme: switch it with setScheme from basalt-ui, which sets data-theme on the root and stores the choice, never a root class, className or data-theme written by hand; where the scheme picks a class, tokens switch per scheme, so the one token class serves both',
        next: 'A reasoned per-line waiver',
        fixture: 'class/dark-fork/scheme-fork.tsx',
      },
    ],
  },

  'fixed-color': {
    family: 'class',
    profiles: ALL,
    zonesOff: VENDORED,
    defect:
      'shadcn hard-codes the black/white exemption and stays silent under a closed theme; rollhook `LogDrawer.tsx:28`',
    forms: [
      {
        id: 'black-white',
        pattern: new RegExp(`${HEAD}${COLOR_PREFIX}-(?:black|white)${TAIL}`),
        fix: 'Button variant primary or Status own a brand fill and its ink in app code; on-brand ink on a brand fill at bridge; a white or black surface is Card in app code; bg-card or bg-background for a surface at bridge; the backdrop is owned by Dialog and Sheet',
        next: 'A reasoned per-line waiver',
        fixture: 'class/fixed-color/black-white.tsx',
      },
    ],
  },

  'status-fill-as-text': {
    family: 'class',
    profiles: ALL,
    zonesOff: VENDORED,
    defect:
      'a fill clears 3.0 and text needs 4.5; console `--color-good` was both, so status text failed contrast',
    forms: [
      {
        id: 'text-on-fill',
        pattern: textOnFill,
        fix: 'Status or Num tone from parts; text-good or text-brand at bridge',
        next: 'A reasoned per-line waiver',
        fixture: 'class/status-fill-as-text/text-on-fill.tsx',
      },
    ],
  },

  'raw-scroll': {
    family: 'class',
    profiles: PARTS_UP,
    zonesOff: [...VENDORED, 'ejected', 'seed'],
    defect:
      'main is the only scrollport; `.module.css` overflow was invisible in 2.x; axe `scrollable-region-focusable` on EventList',
    forms: [
      {
        id: 'overflow-scroll',
        pattern: /(?:^|:)!?overflow-(?:[xy]-)?(?:auto|scroll)!?$/,
        fix: 'ui/scroll-area, or let Page own the scroll',
        next: 'A deepRender file-level waiver with a reason',
        fixture: 'class/raw-scroll/overflow-scroll.tsx',
      },
    ],
  },

  // Known limit: a class built by concatenation (`'bg-' + tone + '-tint'`) is not read. The class
  // walker reads strings and templates only, and a `+` outside a class context (`'chart-' + id`)
  // is indistinguishable from one inside it without the parent call or attribute.
  'tw-off-law': {
    family: 'class',
    // Bridge carries the bridge forms only; the parts-only forms read the `profile` option.
    profiles: ALL,
    zonesOff: VENDORED,
    schema: [PROFILE_GATE_SCHEMA],
    profileOptions: { bridge: [{ profile: 'bridge' }], site: [{ profile: 'bridge' }] },
    defect:
      'shadcn suggests `p-3.25` and `w-105`; console 16 bordered vs 4 shadow cards; colored left bars; `/NN` on `color-mix` tokens; epos `grid-cols-1!`; `bg-${tone}-600` unscanned by anything',
    forms: [
      {
        id: 'off-ladder-spacing',
        pattern: new RegExp(`${HEAD}-?${SPACING_PREFIX}-(?![0-3]\\.5!?$)\\d+\\.\\d+!?$`),
        fix: 'Use a ladder step: integers, and halves below 4',
        next: 'A cva variant, or a reasoned waiver',
        fixture: 'class/tw-off-law/off-ladder-spacing.tsx',
      },
      partsOnly(
        {
          id: 'surface-recipe',
          // The ejected primitive is the component that owns the recipe.
          zonesOff: ZONE_COLOR,
          // A `dark:` token is `dark-fork`'s: one fix at a time, and the recipe fires once it is gone.
          pattern: new RegExp(
            `^(?!.*(?:^|:)${DARK_VARIANT})(?:.*:)?!?(?:bg-(?:card|inset)|shadow-card|rounded-card)(?:\\/[^\\s!]+)?!?$`,
          ),
          fix: 'Card or Inset own the surface recipe',
          next: 'A reasoned waiver',
          fixture: 'class/tw-off-law/surface-recipe.tsx',
        },
        borderedCard,
      ),
      partsOnlyExceptSeamMark(
        {
          id: 'app-color',
          zonesOff: ZONE_COLOR,
          pattern: colorUtility,
          fix: 'Status, Lozenge, DeltaBadge or Num tone own color in app code',
          next: 'A reasoned waiver',
          fixture: 'class/tw-off-law/app-color.tsx',
        },
        seamMarkFill,
      ),
      partsOnlyExceptStyleVar({
        id: 'app-color-arbitrary',
        zonesOff: ZONE_COLOR,
        pattern: colorArbitrary,
        fix: 'Status, Lozenge, DeltaBadge or Num tone own color in app code',
        next: 'A reasoned waiver',
        fixture: 'class/tw-off-law/app-color-arbitrary.tsx',
      }),
      // The pre-mixed tokens by the theme class that reads them (`hover:bg-accent/50`,
      // `border-border/60`). A token name (`bg-hover/60`) is no class: shadcn's no-unknown-classes
      // and no-raw-colors report it, and their messages name the theme class (lint-4.4, lint-4.14).
      {
        id: 'alpha-on-premixed',
        pattern: new RegExp(
          `${HEAD}-?${COLOR_PREFIX}-(?:${alt(zoneAPremixed)}|${alt(TINTS)})\\/[^\\s!]+!?$`,
        ),
        fix: 'Use the pre-mixed token as it is: it already carries its alpha',
        next: 'A new token in the table',
        fixture: 'class/tw-off-law/alpha-on-premixed.tsx',
      },
      {
        id: 'numeric-container',
        pattern: /(?:^|:)@(?!(?:(?:max|min)-)?(?:narrow|regular|wide)(?:\/[^\s:]*)?:)[^\s:]*:/,
        fix: 'Key on @narrow: @regular: @wide: (or their max-/min- forms)',
        next: 'A container query in a stylesheet',
        fixture: 'class/tw-off-law/numeric-container.tsx',
      },
      {
        id: 'important-modifier',
        // Both v4 spellings: the leading `!p-0` and the trailing `p-0!`, one-word utilities
        // (`hidden!`, `hover:underline!`) included.
        pattern: /(?:^|:)!-?[a-z0-9[]|(?:^|:)-?[a-z][a-z0-9]*(?:-[^\s!:]+)*!$/,
        fix: 'Fix the cascade or add a cva variant instead of forcing with !',
        next: 'A reasoned waiver',
        fixture: 'class/tw-off-law/important-modifier.tsx',
      },
      {
        id: 'template-interpolation',
        // `bg-${tone}` and `${solid ? 'bg' : 'text'}-brand`: an interpolation on either side of a
        // dash, or `${at}:hidden`, an interpolated variant prefix.
        pattern: /-\$\{\}|\$\{\}-[a-z0-9[(]|\$\{\}:/,
        fix: 'A cva variant per value, a tone, size or count: Tailwind cannot scan an interpolated class',
        next: 'Status or Num tone from parts for a color',
        fixture: 'class/tw-off-law/template-interpolation.tsx',
      },
      partsOnly({
        id: 'fixed-width',
        // A step of 97 up or a bracket of 385px/25rem up on `w-`, `min-w-`, `basis-` and `size-`;
        // the v4 container-scale names `md` (28rem) up on `w-`, `basis-` and `size-`. Known limit:
        // `min-w-6xl` passes, as a scroll content's floor inside a horizontal ScrollArea writes it.
        pattern: new RegExp(
          `^(?!${VIEWPORT_CHAIN})` +
            /(?:.*:)?!?(?:(?:(?:min-)?w|basis|size)-(?:(?:9[7-9]|[1-9]\d{2,})(?:\.\d+)?|\[(?:(?:38[5-9]|39\d|[4-9]\d{2}|\d{4,})(?:\.\d+)?px|(?:2[5-9]|[3-9]\d|\d{3,})(?:\.\d+)?rem)\])|(?:w|basis|size)-(?:md|lg|xl|[2-7]xl))!?$/
              .source,
        ),
        fix: 'Parent-owned width: size the container, not the child',
        next: 'A reasoned waiver',
        fixture: 'class/tw-off-law/fixed-width.tsx',
      }),
      // Every profile and zone but vendored: a primitive owns its color roles, never a stripe.
      wholeString(
        {
          id: 'side-stripe',
          fix: 'Say the state with Status, a Badge or the tone of the whole border, never a colored bar on one edge',
          next: 'A reasoned waiver',
          fixture: 'class/tw-off-law/side-stripe.tsx',
        },
        sideStripe,
      ),
      {
        id: 'track-length',
        // A grid track list with a fixed length, explicit (`grid-rows-[…]`) or implicit
        // (`auto-rows-[…]`, `auto-cols-[…]`); `fr`, `auto`, `minmax(0,1fr)` and `%` stay legal.
        pattern:
          /(?:^|:)!?(?:grid|auto)-(?:cols|rows)-\[[^\]]*[\d.](?:px|r?em|ch|vw|vh|vmin|vmax|[sdl]v[wh]|cq[wh]|cm|mm|in|pt|pc)(?![a-z])[^\]]*\]!?$/,
        fix: 'Size tracks by fr, auto or minmax(0,1fr); a card grid is CardGrid with a min tier, and the container owns the width',
        next: 'A reasoned waiver',
        fixture: 'class/tw-off-law/track-length.tsx',
      },
    ],
  },

  'app-spacing': {
    family: 'class',
    profiles: PARTS_UP,
    zonesOff: ['ejected', 'seed', 'vendored'],
    defect:
      'argo 17 spacing rows of 109 rewrites; 48 props on 43 lines in 29 files were spacing the parent should own',
    forms: [
      {
        id: 'space-between',
        pattern: /(?:^|:)!?-?space-[xy]-/,
        fix: 'gap-* on the parent',
        next: 'A reasoned waiver for an optical offset',
        fixture: 'class/app-spacing/space-between.tsx',
      },
      {
        id: 'margin',
        pattern: /(?:^|:)!?-?m[xytrblse]?-(?!(?:auto|0)!?$)[^\s]/,
        fix: 'gap-* on the parent; Page for page offsets; ml-auto is legal',
        next: 'A reasoned waiver for an optical offset',
        fixture: 'class/app-spacing/margin.tsx',
      },
      {
        id: 'padding',
        pattern: /(?:^|:)!?p[xytrblse]?-/,
        fix: 'Surfaces own padding: Inset, CardBand',
        next: 'A reasoned waiver',
        fixture: 'class/app-spacing/padding.tsx',
        enabled: false,
        reason:
          'off until a structural F5P retest (docs/v3/spikes/allow-padding.md): 23% of argo padding props had no satisfiable fix',
      },
    ],
  },

  'motion-off-scale': {
    family: 'class',
    profiles: ALL,
    zonesOff: VENDORED,
    defect:
      'Issue 2529: duration and easing classes were typed per call site (duration-150, ease-in), so the motion scale in tokens/motion.ts moved without them',
    forms: [
      {
        id: 'off-scale',
        // A duration or delay that is not a scale step (`duration-300`, `delay-[120ms]`), or an
        // easing that is not the stylesheet's (`ease-linear`, `ease-in`, `ease-[…]`), with or without variants.
        pattern:
          /(?:^|:)!?(?:(?:duration|delay)-(?!(?:fast|base|slow|0)!?$)|ease-(?:(?:linear|in-out|in|out)(?![\w-])|[[(]))/,
        fix: 'Duration and delay from the motion scale: duration-fast, duration-base, duration-slow, duration-0; easing from ease-standard, ease-enter, ease-exit; the stagger utility for a list',
        next: 'A cva variant over those steps, or a reasoned waiver',
        fixture: 'class/motion-off-scale/off-scale.tsx',
      },
    ],
  },
  'logical-properties': {
    family: 'class',
    profiles: SITE,
    zonesOff: VENDORED,
    defect:
      'a site page under dir="rtl" keeps ml-, pl-, left- and text-left physical, so the margin, gutter and text edge land on the wrong side; content sites take every word from a message catalogue, so a right-to-left locale must be a translation, not a stylesheet rewrite',
    forms: [
      {
        id: 'inline-margin',
        pattern: /(?:^|:)!?-?m[lr]-/,
        fix: 'Use ms-* for the start margin and me-* for the end margin: the sides that follow the text direction, where the physical margin does not',
        next: 'A reasoned waiver where the side is physical on purpose, an overlay placed from the viewport edge',
        fixture: 'class/logical-properties/inline-margin.tsx',
      },
      {
        id: 'inline-padding',
        pattern: /(?:^|:)!?p[lr]-/,
        fix: 'Use ps-* for the start padding and pe-* for the end padding: the sides that follow the text direction, where the physical padding does not',
        next: 'A reasoned waiver where the side is physical on purpose',
        fixture: 'class/logical-properties/inline-padding.tsx',
      },
      {
        id: 'inline-offset',
        pattern: /(?:^|:)!?-?(?:left|right)-/,
        fix: 'Use start-* and end-* for the inline offset: the edges that follow the text direction, where the physical offset does not',
        next: 'A reasoned waiver where the side is physical on purpose, a map or a measured overlay',
        fixture: 'class/logical-properties/inline-offset.tsx',
      },
      {
        id: 'text-align',
        pattern: /(?:^|:)!?text-(?:left|right)(?:[!/]|$)/,
        fix: 'Use text-start and text-end: the edges of the text that follow the text direction, where the physical alignment does not',
        next: 'A reasoned waiver where the text edge is physical on purpose',
        fixture: 'class/logical-properties/text-align.tsx',
      },
      {
        id: 'border-side',
        pattern: /(?:^|:)!?border-[lr](?:[-!/]|$)/,
        fix: 'Use border-s and border-e for the inline border: the edges that follow the text direction, where the physical border does not; color included',
        next: 'A reasoned waiver where the edge is physical on purpose',
        fixture: 'class/logical-properties/border-side.tsx',
      },
      {
        id: 'radius-side',
        pattern: /(?:^|:)!?rounded-(?:l|r|tl|tr|bl|br)(?:[-!/]|$)/,
        fix: 'Use rounded-s, rounded-e, rounded-ss, rounded-se, rounded-es and rounded-ee: the logical corners follow the text direction',
        next: 'A reasoned waiver where the corner is physical on purpose',
        fixture: 'class/logical-properties/radius-side.tsx',
      },
      {
        id: 'scroll-inline',
        pattern: /(?:^|:)!?-?scroll-[mp][lr]-/,
        fix: 'Use scroll-ms and scroll-me for the inline scroll margin, scroll-ps and scroll-pe for the inline scroll padding',
        next: 'A reasoned waiver where the snap offset is physical on purpose',
        fixture: 'class/logical-properties/scroll-inline.tsx',
      },
      {
        id: 'float-side',
        pattern: /(?:^|:)!?float-(?:left|right)(?:[!/]|$)/,
        fix: 'Use float-start and float-end: the sides that follow the text direction, where the physical float does not',
        next: 'A reasoned waiver where the float is physical on purpose',
        fixture: 'class/logical-properties/float-side.tsx',
      },
      {
        id: 'clear-side',
        pattern: /(?:^|:)!?clear-(?:left|right)(?:[!/]|$)/,
        fix: 'Use clear-start and clear-end: the sides that follow the text direction, where the physical clear does not',
        next: 'A reasoned waiver where the clear is physical on purpose',
        fixture: 'class/logical-properties/clear-side.tsx',
      },
      {
        id: 'style-object',
        detect: inlineStyleForm,
        fix: 'Use the logical property in a style object: insetInlineStart for left, marginInlineStart for marginLeft, paddingInlineEnd for paddingRight, borderInlineStart for borderLeft, and textAlign start or end',
        next: 'A reasoned waiver where the side is physical on purpose',
        fixture: 'class/logical-properties/style-object.tsx',
      },
    ],
  },
})
