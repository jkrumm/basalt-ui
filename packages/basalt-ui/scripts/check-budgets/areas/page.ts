/**
 * Area: page — the `./page` subpath, G2 freeze (docs/v3/ARCHITECTURE.md section 3). Value symbols are
 * exact (a new one is a row here and a named consumer); the byte row is the first complete build plus
 * 5 percent, rounded up to 0.5 KB (quality-contract section 6), ratcheted down only. `../ui-bundle`
 * measures it (gzip B minus `base0`, peers bundled, whole barrel). The authored-file line budget for
 * the v3 paths of every G2 layer lives in `./shell`.
 */
import type { Raises, RowDef } from '../lib'
import { readSurface } from '../lib'
import { measureSource, reExportAll } from '../ui-bundle'

export const rows: readonly RowDef[] = [
  {
    id: 'page-symbols',
    order: 440,
    label: 'public value symbols, ./page (exact, export-surface shard)',
    ceiling: 25, // Issue 2995 (settings grammar): `SettingsLayout`; v3 dock: `Dock`; v3 peek: `Peek`
    measure: () => readSurface()['./page']?.length ?? 0,
  },
  {
    id: 'page-subpath',
    order: 441,
    label: 'page, whole barrel (gzip B minus base0, src/page, peers bundled)',
    // 107199 B measured.
    // 113000 -> 114000 (v3 dock): `Dock` and the shared record-panel parts join the barrel (113303 B measured with them).
    // 114000 -> 115500 (v3 peek width): the width handle (peek-handle.tsx) joins the barrel.
    // 115500 -> 115600 (Issue 2784): the summary's error arm says its cause and keeps a Retry.
    // 115600 -> 115700 (Issue 2835): 115612 B measured; the summary's Retry reads `home.retry` instead of a hard-coded word.
    // 115700 -> 115800 (Issue 2851): 115757 B measured; `Page fill` drops the gutter and `SplitPage` insets its panes in a fill page.
    // 115800 -> 116500 (Issue 2853): PageBar's action groups are the public `ButtonGroup`, and
    // every control in the barrel reads the group scope (`core/control-scope`).
    // 116500 -> 117000 (Issue 2940): 116707 B measured; the Dialog sizes, header actions and wash backdrop.
    // 117000 -> 117400 (Issue 2995): `SettingsLayout`, the pane frame that scrolls to a linked row and marks it.
    // 117400 -> 125700 (Issue 2939): the one panel anatomy (typed actions with a More menu, previous and next, the
    // avatar lead), Peek's window (drag, eight edges, the minimised chip), its page presentation and Open as menu, the
    // width stores and the phone's bottom sheet.
    ceiling: 125700,
    measure: () => measureSource(reExportAll({ page: 'page/index' })),
  },
]

export const raises: Raises = {
  'page-subpath': [
    {
      from: 117400,
      to: 125700,
      consumer:
        'the benchmark against Accordee (owner direction 2026-11-21, docs/v3/issues/bench/README.md decision 6): one panel anatomy for Peek, Dock, PageAside and a right Sheet, each resizable with the width remembered, and a record that opens as a side panel, a window or the page, with previous and next (Issue 2939)',
      repo: 'basalt-ui',
    },
    {
      from: 117000,
      to: 117400,
      consumer:
        '`SettingsLayout` (plan row bench-form-rows, Issue 2995): the pane frame and its row scroll and mark join the barrel',
      repo: 'basalt-ui',
    },
    {
      from: 116500,
      to: 117000,
      consumer:
        'the wizard dialog (Issue 2940): `Dialog` gains the `wide` and `split` sizes, a header meta line and typed actions, and the overlay host forwards the sizes',
      repo: 'basalt-ui',
    },
    {
      from: 115800,
      to: 116500,
      consumer:
        "PageBar's grouped actions (plan row bench-control-groups, Issue 2853): the private fused fieldset became the public `ButtonGroup`, with its stacking order for hover and focus, and the page's controls take a group's size and variant",
      repo: 'basalt-ui',
    },
    {
      from: 115700,
      to: 115800,
      consumer:
        'the AppShell work surface (Issue 2851): a list or split page fills the surface edge to edge, so `Page fill` drops its gutter and `SplitPage` takes the inset into its own panes',
      repo: 'basalt-ui',
    },
    {
      from: 115600,
      to: 115700,
      consumer:
        "a localised app's `PageSummary` error arm (Issue 2835): its Retry printed English whatever `home.retry` said; the button now takes the message the query state prints",
      repo: 'basalt-ui',
    },
    {
      from: 115500,
      to: 115600,
      consumer:
        "n87's and n91's `PageSummary` over a source only the summary reads (Issue 2784): its error arm held the headline's line empty with no cause and no Retry",
      repo: 'basalt-ui',
    },
    {
      from: 114000,
      to: 115500,
      consumer:
        "the `Peek` width handle (`defaultWidth`, `onWidthChange` and the drag and key handle on its start edge): the software-factory console's record panel takes it and saves the width the reader chose",
      repo: 'software-factory',
    },
    {
      from: 113000,
      to: 114000,
      consumer:
        '`Dock` from `./page`: the software-factory console, the `Peek` consumer (Issue 1819), pins a peeked record into a docked panel that stays beside every page; rung 3 of that ladder (Issue 1958)',
      repo: 'software-factory',
    },
  ],
  'page-symbols': [
    {
      from: 24,
      to: 25,
      consumer:
        '`SettingsLayout` from `./page` (plan row bench-form-rows, Issue 2995): the settings pane frame, a centred column that scrolls to a linked row and marks it once; the playground settings page is its consumer',
      repo: 'basalt-ui',
    },
    {
      from: 23,
      to: 24,
      consumer:
        '`Dock` from `./page`: the software-factory console, the `Peek` consumer (Issue 1819), pins a peeked record into a docked panel that stays beside every page; rung 3 of that ladder (Issue 1958)',
      repo: 'software-factory',
    },
    {
      from: 22,
      to: 23,
      consumer:
        '`Peek` from `./page`: software-factory console components/kit/peek.tsx hand-builds the non-modal record panel its lists open through one click handler',
      repo: 'software-factory',
    },
    {
      from: 21,
      to: 22,
      consumer:
        "`Facts` from `./page`: the dogfood cycle's issue inspector (apps/playground/src/cycle/dogfood-1/FlowOverview.tsx) hand-builds the label and value `dl` in its `PageAside`; every inspector body is such a list",
      repo: 'basalt-ui',
    },
  ],
}
