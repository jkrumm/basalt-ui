/**
 * Area: shell — the `./shell` subpath, G2 freeze, plus the authored-file line budget of every G2 v3
 * path. `./shell` has no export-surface shard (the 2.x barrel the root re-exports), so its value
 * symbols are counted from `src/shell/index.ts` by the bundler's own export scan, types erased.
 * Byte seeds are the first complete build plus 5 percent, rounded up to 0.5 KB (quality-contract
 * section 6), ratcheted down only; the palette row is the marginal cost of `CommandPalette` and
 * `defineCommands` over the same shell without them.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { PKG_ROOT, walkFiles } from '../lib'
import type { RowDef } from '../lib'
import { measureSource, reExportAll, reExportNamed } from '../ui-bundle'

const SRC = join(PKG_ROOT, 'src')

const SHELL_CORE = ['AppShell', 'toMenuTemplate', 'useWindowChrome']
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
    // 129009 B measured.
    ceiling: 135500,
    measure: () => measureSource(reExportAll({ shell: 'shell/index' })),
  },
  {
    id: 'shell-palette-marginal',
    order: 462,
    label:
      'shell palette marginal: CommandPalette + defineCommands over the shell without them (gzip B)',
    // 19905 B measured (the palette's dialog, kbd and rank closure). The shell-i8 acceptance read 2.0 KB;
    // this build does not, so the seed is the measurement and the 2.0 KB is the target it ratchets toward.
    ceiling: 21000,
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
    ceiling: 790,
    measure: largestAuthoredFile,
  },
]
void SHELL_CORE
