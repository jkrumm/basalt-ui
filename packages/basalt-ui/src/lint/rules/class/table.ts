/**
 * The class-rule family: seven ids, eighteen enabled forms and one built-but-off form, all data
 * (guardrails section 4, rows 1-7). The factory turns each entry into an oxlint/ESLint rule; this
 * module holds the patterns, the fix each message names and the next rung of the bending ladder.
 *
 * Colour names are never typed here: `generated/zone-a.ts` (from `tokens/emit.ts`) is the one
 * source of the earned names and of the utilities denied outright. The only name added by hand is
 * `dim-bar`, a fill-only token that is not earned and so is absent from that list.
 */
import { deniedCurrent, zoneANames } from '../../generated/zone-a'
import type { Profile } from '../../rule-table'
import { defineRules } from '../../rule-table'
import { mediaQueryForm, PROFILE_GATE_SCHEMA, partsOnly } from './detect'

const ALL: readonly Profile[] = ['bridge', 'parts', 'app', 'repo']
const PARTS_UP: readonly Profile[] = ['parts', 'app', 'repo']

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

/** Utilities that take a colour (the zone A denial list, tokens-visual 3.5, plus `text`). */
const COLOUR_PREFIX =
  '(?:text|bg|border(?:-[xytrblse])?|ring(?:-offset)?|outline|divide|from|via|to|fill|stroke|decoration|shadow|accent|caret)'

const SPACING_PREFIX =
  '(?:p[xytrblse]?|m[xytrblse]?|gap(?:-[xy])?|space-[xy]|inset(?:-[xy])?|top|right|bottom|left|start|end|size|w|h|min-w|min-h|max-w|max-h|basis|translate-[xy]|scroll-[mp][xytrblse]?)'

/** Colour tokens that only a fill may use: contrast clears 3.0 for a fill, text needs 4.5. */
const FILL_ONLY = [
  ...zoneANames.filter((name) => name.endsWith('-fill') || /^(?:chart|seq)-/.test(name)),
  'dim-bar',
]
const TINTS = zoneANames.filter((name) => name.endsWith('-tint'))

/** `bg-current` is denied outright; an entry ending in `-` (`from-`) denies the whole family. */
const deniedOutright = deniedCurrent
  .map((entry) =>
    entry.endsWith('-') ? `${HEAD}${escape(entry)}` : `${HEAD}${escape(entry)}${TAIL}`,
  )
  .join('|')

const colourUtility = new RegExp(
  `${HEAD}${COLOUR_PREFIX}-(?:${alt(zoneANames)})${TAIL}|${deniedOutright}`,
)
const colourArbitrary = new RegExp(
  `${HEAD}${COLOUR_PREFIX}-(?:\\(--vx-(?:${alt(zoneANames)})\\)|\\[(?:var\\()?--vx-(?:${alt(zoneANames)})\\)?\\])${TAIL}`,
)

export const CLASS_RULES = defineRules({
  'viewport-keyed': {
    family: 'class',
    profiles: ALL,
    defect:
      'console 39 viewport-keyed classes, rollhook 14, shutterflow 16; epos `md:` kill; `max-md:` compiles because `md` and `xl` stay live',
    forms: [
      {
        id: 'breakpoint-prefix',
        pattern: /(?:^|:)(?:(?:max|min)-)?(?:sm|md|lg|xl|2xl):/,
        fix: 'Key on the container: @narrow: @regular: @wide:',
        next: 'useSizeClass is for chrome only; viewport-keyed is never file-waivable',
        fixture: 'class/viewport-keyed/breakpoint-prefix.tsx',
      },
      {
        id: 'arbitrary-query',
        pattern: /(?:^|:)!?(?:min|max)-\[[^\]]*\]:/,
        fix: 'Key on the container: @narrow: @regular: @wide:',
        next: 'useSizeClass is for chrome only; viewport-keyed is never file-waivable',
        fixture: 'class/viewport-keyed/arbitrary-query.tsx',
      },
      {
        id: 'media-query',
        detect: mediaQueryForm,
        fix: 'useSizeClass for chrome; page layout keys on the container with @narrow: @regular: @wide:',
        next: 'viewport-keyed is never file-waivable; fix it at source',
        fixture: 'class/viewport-keyed/media-query.tsx',
      },
    ],
  },

  'dark-fork': {
    family: 'class',
    profiles: ALL,
    defect:
      'epos 21 `dark:` forks in app code and 40 in vendored ui; `@custom-variant dark` keys to `data-theme`, so a fork compiles and diverges from the token switch',
    forms: [
      {
        id: 'dark-variant',
        pattern: /(?:^|:)dark:/,
        fix: 'Tokens switch per scheme: add the token instead of forking with dark:',
        next: 'A reasoned per-line waiver',
        fixture: 'class/dark-fork/dark-variant.tsx',
      },
    ],
  },

  'fixed-colour': {
    family: 'class',
    profiles: ALL,
    defect:
      'shadcn hard-codes the black/white exemption and stays silent under a closed theme; rollhook `LogDrawer.tsx:28`',
    forms: [
      {
        id: 'black-white',
        pattern: new RegExp(`${HEAD}${COLOUR_PREFIX}-(?:black|white)${TAIL}`),
        fix: 'on-brand for ink on a brand fill; the backdrop is owned by Dialog and Sheet',
        next: 'A reasoned per-line waiver',
        fixture: 'class/fixed-colour/black-white.tsx',
      },
    ],
  },

  'status-fill-as-text': {
    family: 'class',
    profiles: ALL,
    defect:
      'a fill clears 3.0 and text needs 4.5; console `--color-good` was both, so status text failed contrast',
    forms: [
      {
        id: 'text-on-fill',
        pattern: new RegExp(`${HEAD}text-(?:${alt(FILL_ONLY)})${TAIL}`),
        fix: 'Status or Num tone from parts; text-good or text-brand at bridge',
        next: 'A reasoned per-line waiver',
        fixture: 'class/status-fill-as-text/text-on-fill.tsx',
      },
    ],
  },

  'raw-scroll': {
    family: 'class',
    profiles: PARTS_UP,
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

  'tw-off-law': {
    family: 'class',
    // Bridge carries the bridge forms only; the parts-only forms read the `profile` option.
    profiles: ALL,
    schema: [PROFILE_GATE_SCHEMA],
    defect:
      'shadcn suggests `p-3.25` and `w-105`; console 16 bordered vs 4 shadow cards; coloured left bars; `/NN` on `color-mix` tokens; epos `grid-cols-1!`; `bg-${tone}-600` unscanned by anything',
    forms: [
      {
        id: 'off-ladder-spacing',
        pattern: new RegExp(`${HEAD}-?${SPACING_PREFIX}-(?![0-3]\\.5!?$)\\d+\\.\\d+!?$`),
        fix: 'Use a ladder step: integers, and halves below 4',
        next: 'A cva variant, or a reasoned waiver',
        fixture: 'class/tw-off-law/off-ladder-spacing.tsx',
      },
      partsOnly({
        id: 'surface-recipe',
        // A `dark:` token is `dark-fork`'s: one fix at a time, and the recipe fires once it is gone.
        pattern: new RegExp(
          `^(?!.*(?:^|:)dark:)(?:.*:)?!?(?:bg-(?:card|inset)|shadow-card|rounded-card)(?:\\/[^\\s!]+)?!?$`,
        ),
        fix: 'Card or Inset own the surface recipe',
        next: 'A reasoned waiver',
        fixture: 'class/tw-off-law/surface-recipe.tsx',
      }),
      partsOnly({
        id: 'app-colour',
        pattern: colourUtility,
        fix: 'Status, Lozenge, DeltaBadge or Num tone own colour in app code',
        next: 'A reasoned waiver',
        fixture: 'class/tw-off-law/app-colour.tsx',
      }),
      partsOnly({
        id: 'app-colour-arbitrary',
        pattern: colourArbitrary,
        fix: 'Status, Lozenge, DeltaBadge or Num tone own colour in app code',
        next: 'A reasoned waiver',
        fixture: 'class/tw-off-law/app-colour-arbitrary.tsx',
      }),
      {
        id: 'alpha-on-premixed',
        pattern: new RegExp(
          `${HEAD}-?${COLOUR_PREFIX}-(?:hairline|hover|selected|scrim|${alt(TINTS)})\\/[^\\s!]+!?$`,
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
        pattern: /(?:^|:)!-?[a-z0-9[]|(?:^|:)-?[a-z][a-z0-9]*(?:-[^\s!:]+)+!$/,
        fix: 'Fix the cascade or add a cva variant instead of forcing with !',
        next: 'Parent-owned width, or a reasoned waiver',
        fixture: 'class/tw-off-law/important-modifier.tsx',
      },
      {
        id: 'template-interpolation',
        pattern: /-\$\{\}/,
        fix: 'A cva variant per tone: Tailwind cannot scan an interpolated class',
        next: 'Status or Num tone from parts',
        fixture: 'class/tw-off-law/template-interpolation.tsx',
      },
      partsOnly({
        id: 'fixed-width',
        pattern:
          /(?:^|:)!?(?:min-)?w-(?:(?:9[7-9]|[1-9]\d{2,})(?:\.\d+)?|\[(?:(?:38[5-9]|39\d|[4-9]\d{2}|\d{4,})(?:\.\d+)?px|(?:2[5-9]|[3-9]\d|\d{3,})(?:\.\d+)?rem)\])!?$/,
        fix: 'Parent-owned width: size the container, not the child',
        next: 'A reasoned waiver',
        fixture: 'class/tw-off-law/fixed-width.tsx',
      }),
    ],
  },

  'app-spacing': {
    family: 'class',
    profiles: PARTS_UP,
    zonesOff: ['ejected', 'seed'],
    defect:
      'argo 17 spacing rows of 109 rewrites; 48 props on 43 lines in 29 files were spacing the parent should own',
    forms: [
      {
        id: 'space-between',
        pattern: /(?:^|:)!?space-[xy]-/,
        fix: 'gap-* on the parent',
        next: 'A reasoned waiver for an optical offset',
        fixture: 'class/app-spacing/space-between.tsx',
      },
      {
        id: 'margin',
        pattern: /(?:^|:)!?m[xytrblse]?-(?!auto!?$)[^\s]/,
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
})
