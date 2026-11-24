/**
 * Area: ui — the `./ui/*` modules' size (docs/v3/ARCHITECTURE.md section 3, quality-contract section 6).
 * G1 freeze. Every ceiling is the first complete build, measured by `../ui-bundle` (React `createRoot`
 * plus the modules, peers bundled, Vite production, `gzipSync` over every chunk, minus `base0`),
 * plus 5 percent, rounded up to 0.5 KB; it ratchets down only. Bytes, 1 KB = 1000 B.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import type { Raises, RowDef } from '../lib'
import { SRC, measureSource, reExportAll } from '../ui-bundle'

const TEN = [
  'button',
  'input',
  'select',
  'dialog',
  'tabs',
  'tooltip',
  'checkbox',
  'switch',
  'badge',
  'card',
]
const REST_OF_25 = [
  'menu',
  'popover',
  'combobox',
  'accordion',
  'alert',
  'field',
  'progress',
  'radio-group',
  'scroll-area',
  'separator',
  'sheet',
  'skeleton',
  'slider',
  'textarea',
  'toast',
]

const page = (names: readonly string[]): string =>
  reExportAll(Object.fromEntries(names.map((n) => [n.replaceAll('-', '_'), `ui/${n}`])))

/** Per primitive: that module's whole export surface over `base0` (a regression catch for a wrapper). */
const PER_PRIMITIVE: Readonly<Record<string, number>> = {
  accordion: 15000, // 14195 B
  alert: 6000, // 5300 B
  badge: 6000, // 5625 B
  button: 9500, // 8574 B
  card: 10100, // 10004 B
  checkbox: 15500, // 15025 B, with the card and tile variants and `ChoiceCard`
  collapsible: 13000, // 11967 B
  combobox: 96000, // 58535 B; 68024 B with the list engine (Issue 3102); 95909 B with the sheet chunk (Issue 3207)
  'control-group': 6000, // 5672 B
  'copy-button': 12000, // 10982 B, the message catalog for its name
  'date-picker': 97400, // 69556 B; 97325 B with the sheet chunk (Issue 3207)
  dialog: 32200, // 30378 B; 32119 B with the sheet chunk (Issue 3207)
  field: 15000, // 13972 B
  input: 10000, // 9326 B
  kbd: 5500, // 5000 B
  menu: 87500, // 59304 B; 87416 B with the sheet chunk (Issue 3207)
  meter: 10500, // 9767 B
  num: 7000, // 6236 B
  'number-field': 18000, // 16912 B
  'password-input': 14000, // 12984 B, the message catalog for the reveal button's name
  popover: 72100, // 44567 B; 72062 B with the sheet chunk (Issue 3207)
  progress: 10500, // 9676 B
  'radio-group': 18500, // 17153 B
  resizable: 23500, // 22370 B, react-resizable-panels bundled
  'scroll-area': 6000, // 5254 B
  segmented: 15000, // 14087 B
  select: 99500, // 51614 B; 71719 B with the list engine and the searchable list on Base UI Combobox (Issue 3102); 99459 B with the sheet chunk (Issue 3207)
  separator: 7500, // 6767 B
  sheet: 48000, // 47748 B with Base UI's VirtualKeyboardProvider, a grabber and snap points (Issue 3206); 45300 B before; 41473 B; 45114 B with the panel header, the scrolling body, the footer band and the width handle (Issue 2939)
  skeleton: 7000, // 6522 B
  slider: 21000, // 19636 B
  'sortable-list': 18000, // 16970 B with the drag engine it loads on first registration
  status: 5500, // 4999 B
  switch: 11500, // 10848 B
  table: 6000, // 5240 B
  tabs: 17500, // 16277 B
  textarea: 10000, // 9313 B
  toast: 18000, // 16709 B
  toolbar: 14000, // 12982 B
  tooltip: 39000, // 37123 B
  'virtual-list': 15000, // 13886 B
}

/** Value exports of one `src/ui/<name>.tsx`, by the bundler's own export scan (types erased). */
function valueExports(): number {
  const transpiler = new Bun.Transpiler({ loader: 'tsx' })
  return readdirSync(join(SRC, 'ui'))
    .filter((f) => /^[a-z-]+\.tsx$/.test(f))
    .reduce(
      (sum, f) => sum + transpiler.scan(readFileSync(join(SRC, 'ui', f), 'utf8')).exports.length,
      0,
    )
}

export const rows: readonly RowDef[] = [
  {
    id: 'ui-page-ten',
    order: 300,
    label: 'ui ten-primitive page (gzip B minus base0, src/ui, peers bundled)',
    // 81600 B measured. Informative target 95 KB (gap-perf 6.1); the seed is the measurement.
    // 86000 -> 104100 (Issue 3102): 103626 B measured; Select draws the shared option row and opens a searchable list on Base UI Combobox.
    // 104100 -> 104300 (Issue 3206): 104193 B measured; the Sheet carries Base UI's VirtualKeyboardProvider, a grabber and snap points.
    // 104300 -> 129200 (Issue 3207): 129084 B measured; Select and Dialog present as a sheet on a phone, the sheet a lazy chunk this row counts.
    ceiling: 129200,
    measure: () => measureSource(page(TEN)),
  },
  {
    id: 'ui-page-25',
    order: 301,
    label: 'ui 25-part argo-shaped page (gzip B minus base0, src/ui, peers bundled)',
    // 149718 B measured. Informative target 118 KB.
    // 157500 -> 157700 (Issue 2939): 157574 B measured; the Sheet draws the panel header, its footer band and width handle.
    // 157700 -> 158600 (Issue 2996): 158482 B measured; the page's Checkbox and RadioGroup also hold the card variant over `ChoiceCard`.
    // 158600 -> 158800 (Issue 3109): 158756 B measured; the Tabs trigger draws a count, an attention tone and a tone dot, which the page's Tabs carry.
    // 158800 -> 167300 (Issue 3102): 166769 B measured; Select and Combobox share the list engine, its option row and its state rows.
    // 167300 -> 170500 (Issue 3206): 170340 B measured; the Sheet carries Base UI's VirtualKeyboardProvider, a grabber and snap points.
    // 170500 -> 176500 (Issue 3207): 176353 B measured; the list overlays present as a sheet on a phone, the sheet a lazy chunk this row counts.
    ceiling: 176500,
    measure: () => measureSource(page([...TEN, ...REST_OF_25])),
  },
  ...Object.entries(PER_PRIMITIVE).map(([name, ceiling], i): RowDef => ({
    id: `ui-prim-${name}`,
    order: 310 + i,
    label: `ui/${name} (gzip B minus base0, peers bundled)`,
    ceiling,
    measure: () => measureSource(page([name])),
  })),
  {
    id: 'ui-value-exports',
    order: 350,
    label: 'ui value exports, every src/ui .tsx module (exact; SLOTS is pinned)',
    // 279 measured. Exact: a new value export is a row here and a consumer named for it; a lower
    // number ratchets the ceiling down in the same commit.
    ceiling: 279,
    measure: valueExports,
  },
]

export const raises: Raises = {
  'ui-prim-popover': [
    {
      from: 47000,
      to: 72100,
      consumer:
        'the mobile overlays (owner direction 2026-11-24, Issue 3207): Select, Menu, Combobox, Popover and DatePicker open as a bottom Sheet on a phone through one presenter; the sheet is a lazy chunk this row counts and an app loads only on the first phone open',
      repo: 'basalt-ui',
    },
  ],
  'ui-prim-menu': [
    {
      from: 62500,
      to: 87500,
      consumer:
        'the mobile overlays (owner direction 2026-11-24, Issue 3207): Select, Menu, Combobox, Popover and DatePicker open as a bottom Sheet on a phone through one presenter; the sheet is a lazy chunk this row counts and an app loads only on the first phone open',
      repo: 'basalt-ui',
    },
  ],
  'ui-prim-dialog': [
    {
      from: 32000,
      to: 32200,
      consumer:
        'the mobile overlays (owner direction 2026-11-24, Issue 3207): Select, Menu, Combobox, Popover and DatePicker open as a bottom Sheet on a phone through one presenter; the sheet is a lazy chunk this row counts and an app loads only on the first phone open',
      repo: 'basalt-ui',
    },
  ],
  'ui-prim-date-picker': [
    {
      from: 73500,
      to: 97400,
      consumer:
        'the mobile overlays (owner direction 2026-11-24, Issue 3207): Select, Menu, Combobox, Popover and DatePicker open as a bottom Sheet on a phone through one presenter; the sheet is a lazy chunk this row counts and an app loads only on the first phone open',
      repo: 'basalt-ui',
    },
  ],
  'ui-page-ten': [
    {
      from: 104300,
      to: 129200,
      consumer:
        'the mobile overlays (owner direction 2026-11-24, Issue 3207): Select, Menu, Combobox, Popover and DatePicker open as a bottom Sheet on a phone through one presenter; the sheet is a lazy chunk this row counts and an app loads only on the first phone open',
      repo: 'basalt-ui',
    },
    {
      from: 104100,
      to: 104300,
      consumer:
        'the mobile foundation (owner direction 2026-11-24, Issue 3206): a bottom Sheet with a grabber, snap points and the Base UI VirtualKeyboardProvider that lifts a form above the software keyboard, a shell keyboard inset and pressed styles on touch',
      repo: 'basalt-ui',
    },
    {
      from: 86000,
      to: 104100,
      consumer:
        'one list engine behind Select, Combobox and the command palette (plan row bench-list-engine, Issue 3102): groups as data, the rich option row with an avatar, a loader with loading, empty and error rows, a create row, and a searchable Select on Base UI Combobox; the mention list and the model picker of bench-chat-parts draw it',
      repo: 'basalt-ui',
    },
  ],
  'ui-prim-combobox': [
    {
      from: 68500,
      to: 96000,
      consumer:
        'the mobile overlays (owner direction 2026-11-24, Issue 3207): Select, Menu, Combobox, Popover and DatePicker open as a bottom Sheet on a phone through one presenter; the sheet is a lazy chunk this row counts and an app loads only on the first phone open',
      repo: 'basalt-ui',
    },
    {
      from: 61500,
      to: 68500,
      consumer:
        'one list engine behind Select, Combobox and the command palette (plan row bench-list-engine, Issue 3102): groups as data, the rich option row with an avatar, a loader with loading, empty and error rows, a create row, and a searchable Select on Base UI Combobox; the mention list and the model picker of bench-chat-parts draw it',
      repo: 'basalt-ui',
    },
  ],
  'ui-prim-select': [
    {
      from: 72000,
      to: 99500,
      consumer:
        'the mobile overlays (owner direction 2026-11-24, Issue 3207): Select, Menu, Combobox, Popover and DatePicker open as a bottom Sheet on a phone through one presenter; the sheet is a lazy chunk this row counts and an app loads only on the first phone open',
      repo: 'basalt-ui',
    },
    {
      from: 54500,
      to: 72000,
      consumer:
        'one list engine behind Select, Combobox and the command palette (plan row bench-list-engine, Issue 3102): groups as data, the rich option row with an avatar, a loader with loading, empty and error rows, a create row, and a searchable Select on Base UI Combobox; the mention list and the model picker of bench-chat-parts draw it',
      repo: 'basalt-ui',
    },
  ],
  'ui-page-25': [
    {
      from: 170500,
      to: 176500,
      consumer:
        'the mobile overlays (owner direction 2026-11-24, Issue 3207): Select, Menu, Combobox, Popover and DatePicker open as a bottom Sheet on a phone through one presenter; the sheet is a lazy chunk this row counts and an app loads only on the first phone open',
      repo: 'basalt-ui',
    },
    {
      from: 167300,
      to: 170500,
      consumer:
        'the mobile foundation (owner direction 2026-11-24, Issue 3206): a bottom Sheet with a grabber, snap points and the Base UI VirtualKeyboardProvider that lifts a form above the software keyboard, a shell keyboard inset and pressed styles on touch',
      repo: 'basalt-ui',
    },
    {
      from: 158800,
      to: 167300,
      consumer:
        'one list engine behind Select, Combobox and the command palette (plan row bench-list-engine, Issue 3102): groups as data, the rich option row with an avatar, a loader with loading, empty and error rows, a create row, and a searchable Select on Base UI Combobox; the mention list and the model picker of bench-chat-parts draw it',
      repo: 'basalt-ui',
    },
    {
      from: 158600,
      to: 158800,
      consumer:
        'counted tabs (plan row bench-record-parts, Issue 3109): `TabsTrigger` takes a count, an attention tone and a tone dot, the badge PageBar tabs draw, which the 25-part page bundles',
      repo: 'basalt-ui',
    },
    {
      from: 157700,
      to: 158600,
      consumer:
        'choice cards (plan row bench-form-parts, Issue 2996): `RadioGroup` and `CheckboxGroup` gain the card and tile variants over `ChoiceCard`, which the 25-part page draws',
      repo: 'basalt-ui',
    },
    {
      from: 157500,
      to: 157700,
      consumer:
        'the benchmark against Accordee (owner direction 2026-11-21, docs/v3/issues/bench/README.md decision 6): one panel anatomy for Peek, Dock, PageAside and a right Sheet, each resizable with the width remembered, and a record that opens as a side panel, a window or the page, with previous and next (Issue 2939)',
      repo: 'basalt-ui',
    },
  ],
  'ui-prim-checkbox': [
    {
      from: 15000,
      to: 15500,
      consumer:
        'choice cards (plan row bench-form-parts, Issue 2996): CheckboxGroup and RadioGroup draw their options as ChoiceCard with a trailing value and a preview, which the checkbox primitive bundles',
      repo: 'basalt-ui',
    },
  ],
  'ui-prim-card': [
    {
      from: 10000,
      to: 10100,
      consumer:
        'the wizard dialog (Issue 2940): the theme gains the `scrim-wash` color, four bytes over the old ceiling in every primitive that carries the class merger',
      repo: 'basalt-ui',
    },
  ],
  'ui-prim-sheet': [
    {
      from: 45300,
      to: 48000,
      consumer:
        'the mobile foundation (owner direction 2026-11-24, Issue 3206): a bottom Sheet with a grabber, snap points and the Base UI VirtualKeyboardProvider that lifts a form above the software keyboard, a shell keyboard inset and pressed styles on touch',
      repo: 'basalt-ui',
    },
    {
      from: 44000,
      to: 45300,
      consumer:
        'the benchmark against Accordee (owner direction 2026-11-21, docs/v3/issues/bench/README.md decision 6): one panel anatomy for Peek, Dock, PageAside and a right Sheet, each resizable with the width remembered, and a record that opens as a side panel, a window or the page, with previous and next (Issue 2939)',
      repo: 'basalt-ui',
    },
  ],
  'ui-value-exports': [
    {
      from: 276,
      to: 279,
      consumer:
        "`Calendar` with `calendarVariants` and `calendarParts` from `basalt-ui/ui/calendar`: the owner's 2026-11-21 benchmark found no calendar (plan row bench-calendar, Issue 3103); the reference schedule's rail draws it as the mini month and `DatePicker` shares its grid",
      repo: 'basalt-ui',
    },
    {
      from: 275,
      to: 276,
      consumer:
        '`defaultRank` from `basalt-ui/ui/combobox`: the one ranking every list uses (Combobox, a searchable Select, the command palette), exported so an app can wrap it as its own `rank` (Issue 3102)',
      repo: 'basalt-ui',
    },
    {
      from: 256,
      to: 275,
      consumer:
        "`ChoiceCard`, `CheckboxMatrix`, `TagInput`, `OneTimeCode`, `SwatchPicker` (with `SWATCH_TOKENS`) and `QuickPicks`, each with its cva tables and part list, from `basalt-ui/ui/choice-card`, `checkbox-matrix`, `tag-input`, `one-time-code`, `swatch-picker` and `quick-picks`: the owner's 2026-11-21 benchmark found choice cards, a permission matrix, a tag input, a code field, a swatch picker and quick picks absent while every settings, wizard and sign-in screen of Accordee and Blueprint uses them (plan row bench-form-parts, Issue 2996); the playground's forms gallery shows them",
      repo: 'basalt-ui',
    },
    {
      from: 239,
      to: 252,
      consumer:
        "`ButtonGroup`, `ControlGroup`, `InputGroup`, `InputAddon` (with their four tables and `controlGroupParts`) from `basalt-ui/ui/control-group`, `CopyButton` and `copyButtonParts` from `basalt-ui/ui/copy-button`, `PasswordInput` and `passwordInputParts` from `basalt-ui/ui/password-input`: the owner's 2026-11-21 benchmark asked for Blueprint's joined controls (plan row bench-control-groups, Issue 2853); `PageBar` draws its action groups with `ButtonGroup` and the playground's forms pages show the rest",
      repo: 'basalt-ui',
    },
    {
      from: 252,
      to: 256,
      consumer:
        '`SortableList`, `sortableListVariants`, `sortableListParts` and `drag` from `basalt-ui/ui/sortable-list`: software-factory console settings order lists by hand (the list of sidebar links and of tabs) and its flow board drags cards through the engine adapter (Issue 2855)',
      repo: 'software-factory',
    },
    {
      from: 229,
      to: 239,
      consumer:
        '`Avatar`, `AvatarStack`, `EntityTitle`, `EntityChip`, their cva tables and part lists from `basalt-ui/ui/avatar` and `basalt-ui/ui/entity`: the table kinds, record header, presence stack and reference pages of the Accordee and Blueprint benchmark rows in this repo take their faces and linked-record chips from them (Issue 2852)',
      repo: 'basalt-ui',
    },
    {
      from: 226,
      to: 229,
      consumer:
        "`FileUpload`, `fileUploadVariants` and `fileUploadParts` from `basalt-ui/ui/file-upload`: the owner's second review of the playground (2026-11-19) asked for richer forms; the Forms gallery's settings form takes a logo and the inputs page shows the part (Issue 2428)",
      repo: 'basalt-ui',
    },
    {
      from: 222,
      to: 226,
      consumer:
        '`ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle` and `resizableParts` from `basalt-ui/ui/resizable`: the software-factory console splits a page from its docked record panel with them (Issue 1958), and `react-resizable-panels` stays an optional peer of this module alone (Issue 1959)',
      repo: 'software-factory',
    },
    {
      from: 218,
      to: 222,
      consumer:
        "`PreviewCard`, `PreviewCardTrigger`, `PreviewCardContent` and `previewCardParts` from `basalt-ui/ui/preview-card`: the software-factory console shows a record summary on a link's hover, focus and tap through them, fed by the `kinds` its peek already declares (Issue 1957)",
      repo: 'software-factory',
    },
    {
      from: 215,
      to: 218,
      consumer:
        '`InfoHint`, `defineGlossary` and `infoHintParts` from `basalt-ui/ui/info-hint`: the software-factory console (apps/console/src/components/kit/info-hint.tsx) replaces its own hint over a generated glossary (Issue 1820)',
      repo: 'software-factory',
    },
  ],
}
