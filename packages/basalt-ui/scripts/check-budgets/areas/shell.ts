/**
 * Area: shell — the `./shell` subpath, G2 freeze, plus the authored-file line budget of every G2 v3
 * path. `./shell` has its own export-surface shard, a drift detector the cross-subpath gates skip (see
 * `readGatedSurface`); its value symbols are counted from `src/shell/index.ts` by the bundler's own
 * export scan, types erased.
 * Byte seeds are the first complete build plus 5 percent, rounded up to 0.5 KB (quality-contract
 * section 6), ratcheted down only; the palette row is the marginal cost of `CommandPalette` and
 * `defineCommands` over the same shell without them.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { PKG_ROOT, walkFiles } from '../lib'
import type { Raises, RowDef } from '../lib'
import { measureSource, reExportAll, reExportNamed } from '../ui-bundle'

const SRC = join(PKG_ROOT, 'src')

const PALETTE = [
  reExportNamed('shell/commands/command-palette', ['CommandPalette']),
  reExportNamed('shell/commands/define-commands', ['defineCommands']),
].join('\n')
const SHELL_WITHOUT_PALETTE = [
  reExportNamed('shell/app-shell', ['AppShell']),
  reExportNamed('shell/menu-template', ['toMenuTemplate']),
  reExportNamed('shell/chrome', ['useWindowChrome']),
].join('\n')

function shellSymbols(): number {
  const source = readFileSync(join(SRC, 'shell/index.ts'), 'utf8')
  return new Bun.Transpiler({ loader: 'ts' }).scan(source).exports.length
}

/** The v3 authored files of the G2 layers; the 2.x files stay out until the GA cleanup. */
const V3_PATHS: readonly RegExp[] = [
  /^page\//,
  /^shell\/(core|parts|commands)\//,
  /^shell\/(app-shell|chrome|menu-template)[^/]*$/,
  /^router\//,
  /^content\/(markdown|sanitize|block-split|code-block|fences|mermaid|headings)[^/]*$/,
]

/** Source, not tests, declarations or goldens. */
const AUTHORED = /\.(ts|tsx)$/
const NOT_AUTHORED = /\.(test|d)\.(ts|tsx)$|\.test-support\.tsx$/

function largestAuthoredFile(): { value: number; detail: readonly string[] } {
  const src = join(SRC, '')
  const sized = walkFiles(src, AUTHORED)
    .map((path) => path.slice(src.length + 1))
    .filter((rel) => !NOT_AUTHORED.test(rel) && V3_PATHS.some((p) => p.test(rel)))
    .map((rel) => {
      const text = readFileSync(join(src, rel), 'utf8')
      return { rel, lines: text.length === 0 ? 0 : text.split('\n').length }
    })
    .toSorted((a, b) => b.lines - a.lines)
  const top = sized[0]
  return { value: top?.lines ?? 0, detail: sized.slice(0, 3).map((s) => `${s.rel}: ${s.lines}`) }
}

export const rows: readonly RowDef[] = [
  {
    id: 'shell-symbols',
    order: 460,
    label: 'public value symbols, ./shell (exact, src/shell/index.ts)',
    ceiling: 5,
    measure: shellSymbols,
  },
  {
    id: 'shell-subpath',
    order: 461,
    label: 'shell, whole barrel (gzip B minus base0, src/shell, peers bundled)',
    // 129009 B measured; 142851 B with `@tanstack/react-hotkeys` bundled (Issue 2570); 143529 B with the work surface (Issue 2851);
    // 143778 B with the group scope every shell control reads and the popups reset (Issue 2853).
    // 143900 -> 144400 (Issue 2940): 144069 B measured; the Dialog sizes, header actions and wash backdrop.
    // 144400 -> 146600 (Issue 2939): 146457 B measured; the panel anatomy the Dock and the aside draw and the Dock's dragged width.
    // 146600 -> 161800 (Issue 3106): 161405 B measured; the workspace switcher (menu radios, avatar), the Favorites section (`SortableList`) and the rail's width handle.
    // 161800 -> 169000 (Issue 3102): 168504 B measured; the palette draws its rows and group headers through the list engine.
    // 169000 -> 181000 (Issue 3205): 180751 B measured; the two phone nav trial variants and the palette's phone sheet, lazy chunks this row counts and an app loads only when a variant is picked.
    // 181000 -> 185000 (Issue 3206): 184567 B measured; the shell's keyboard inset, the More surface's Sheet with Base UI's VirtualKeyboardProvider, a grabber and snap points.
    ceiling: 185000,
    measure: () => measureSource(reExportAll({ shell: 'shell/index' })),
  },
  {
    id: 'shell-palette-marginal',
    order: 462,
    label:
      'shell palette marginal: CommandPalette + defineCommands over the shell without them (gzip B)',
    // 19905 B measured (the palette's dialog, kbd and rank closure). The shell-i8 acceptance read 2.0 KB;
    // this build does not, so the seed is the measurement and the 2.0 KB is the target it ratchets toward.
    // 30983 B with the hotkeys library, which only the palette binds through (Issue 2570).
    // 31500 -> 31700 (Issue 3106): 31514 B measured; the shell it is measured over grew.
    // 31700 -> 39200 (Issue 3102): 38670 B measured; the list engine's rows, group headers and state rows.
    // 39200 -> 43500 (Issue 3205): 43289 B measured; the palette opens as a bottom sheet on a phone under a trial nav, a lazy chunk this row counts (inline it cost 13 KB more in every page's palette island, astro-matrix.json).
    ceiling: 43500,
    measure: async () =>
      (await measureSource(`${SHELL_WITHOUT_PALETTE}\n${PALETTE}`)) -
      (await measureSource(SHELL_WITHOUT_PALETTE)),
  },
  {
    id: 'g2-largest-file-lines',
    order: 463,
    label: 'largest authored file, G2 v3 paths (lines; page, shell, router, content)',
    // 750 lines measured (router/controls/define.ts; shell/core/mobile-projection.ts is 522). The target
    // is 500: splitting those two files is a src change this freeze does not make.
    ceiling: 795,
    measure: largestAuthoredFile,
  },
]

export const raises: Raises = {
  'g2-largest-file-lines': [
    {
      from: 790,
      to: 795,
      consumer:
        "the field handle's `useHref()` (plan row ga-typed-nav, Issue 3202), so `InnerNav` and with it `basalt-ui/page` import no router; the hook body lives in `router/controls/href.ts`, and `define.ts` keeps only its type and one binding line",
      repo: 'basalt-ui',
    },
  ],
  'shell-subpath': [
    {
      from: 169000,
      to: 181000,
      consumer:
        'the phone nav trial the owner judges on his phone (Issue 3205): a bar of nav sections with a tray (A) or a short drawer (B), and More sliding the app aside to reveal the rail, behind one seam, loaded with lazy() only when the playground picks one; the variant he does not pick is deleted after his answer and this row ratchets back',
      repo: 'basalt-ui',
    },
    {
      from: 181000,
      to: 185000,
      consumer:
        'the mobile foundation (owner direction 2026-11-24, Issue 3206): a bottom Sheet with a grabber, snap points and the Base UI VirtualKeyboardProvider that lifts a form above the software keyboard, a shell keyboard inset and pressed styles on touch',
      repo: 'basalt-ui',
    },
    {
      from: 161800,
      to: 169000,
      consumer:
        'one list engine behind Select, Combobox and the command palette (plan row bench-list-engine, Issue 3102): groups as data, the rich option row with an avatar, a loader with loading, empty and error rows, a create row, and a searchable Select on Base UI Combobox; the mention list and the model picker of bench-chat-parts draw it',
      repo: 'basalt-ui',
    },
    {
      from: 146600,
      to: 161800,
      consumer:
        "the benchmark against Accordee (owner direction 2026-11-21, docs/v3/issues/bench/README.md, plan row bench-shell-nav, Issue 3106): a workspace switcher in the brand zone, a Favorites rail section the reader fills from a record's star and reorders (SortableList), and a rail the reader resizes",
      repo: 'basalt-ui',
    },
    {
      from: 144400,
      to: 146600,
      consumer:
        'the benchmark against Accordee (owner direction 2026-11-21, docs/v3/issues/bench/README.md decision 6): one panel anatomy for Peek, Dock, PageAside and a right Sheet, each resizable with the width remembered, and a record that opens as a side panel, a window or the page, with previous and next (Issue 2939)',
      repo: 'basalt-ui',
    },
    {
      from: 143900,
      to: 144400,
      consumer:
        'the wizard dialog (Issue 2940): `Dialog` gains the `wide` and `split` sizes, a header meta line and typed actions, and the overlay host forwards the sizes',
      repo: 'basalt-ui',
    },
    {
      from: 143600,
      to: 143900,
      consumer:
        "the shell's controls in a ButtonGroup or ControlGroup (plan row bench-control-groups, Issue 2853): each control reads the group's size and variant, and the shell's menus and sheets reset it so a portal does not inherit it",
      repo: 'basalt-ui',
    },
    {
      from: 143500,
      to: 143600,
      consumer:
        "the AppShell work surface (Issue 2851): the rail on the frame and one panel for the page, `frame: 'panel' | 'flush'`, and a native title bar's own header tiers",
      repo: 'basalt-ui',
    },
    {
      from: 135500,
      to: 143500,
      consumer:
        "Issue 2570 (Spec artifact_01a1f951): `./shell` binds every `defineCommands` chord through `@tanstack/react-hotkeys` 0.27.1, bundled in this row's measurement (11.5 KB gz alone, the peer's own code); FPP takes Hotkeys through basalt for its room's keys (owner note 2026-11-20)",
      repo: 'basalt-ui',
    },
  ],
  'shell-palette-marginal': [
    {
      from: 39200,
      to: 43500,
      consumer:
        'the phone nav trial (Issue 3205): under a trial variant the command palette opens as a bottom sheet on a phone, its search field at the top above the keyboard; the sheet is a lazy chunk, which this row counts and a page loads only when it opens',
      repo: 'basalt-ui',
    },
    {
      from: 31700,
      to: 39200,
      consumer:
        'one list engine behind Select, Combobox and the command palette (plan row bench-list-engine, Issue 3102): groups as data, the rich option row with an avatar, a loader with loading, empty and error rows, a create row, and a searchable Select on Base UI Combobox; the mention list and the model picker of bench-chat-parts draw it',
      repo: 'basalt-ui',
    },
    {
      from: 31500,
      to: 31700,
      consumer:
        "the benchmark against Accordee (owner direction 2026-11-21, docs/v3/issues/bench/README.md, plan row bench-shell-nav, Issue 3106): a workspace switcher in the brand zone, a Favorites rail section the reader fills from a record's star and reorders (SortableList), and a rail the reader resizes",
      repo: 'basalt-ui',
    },
    {
      from: 21000,
      to: 31500,
      consumer:
        "Issue 2570 (Spec artifact_01a1f951): `./shell` binds every `defineCommands` chord through `@tanstack/react-hotkeys` 0.27.1, bundled in this row's measurement (11.5 KB gz alone, the peer's own code); FPP takes Hotkeys through basalt for its room's keys (owner note 2026-11-20)",
      repo: 'basalt-ui',
    },
  ],
}
