/**
 * Area: tokens — the G0 layer (`src/tokens`, `src/css`), frozen by v3-freeze-g0
 * (docs/v3/concepts/tokens-visual.md sections 1 and 13). `tokens.css` is its first complete measured
 * gzip size plus exactly 5 percent: unlike the G1 byte rows this is not rounded up to 0.5 KB, because
 * a 1.5 KB sheet would gain 30 percent of slack and the freeze would catch nothing. The full-scan row
 * compiles `tailwind.css` (and the typography and prose sheets) over the G0 sources, the layers a
 * `bridge` or `tokens` consumer takes with no `basalt()` plugin to narrow the scan. Ratcheted down only.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { gzipSync } from 'node:zlib'

import { PKG_ROOT, REPO_ROOT, Unmeasured, walkFiles } from '../lib'
import type { Raises, RowDef } from '../lib'
import { TOKENS } from '../../../src/tokens/table'

const CSS_DIR = join(PKG_ROOT, 'src/css')
const TOKENS_DIR = join(PKG_ROOT, 'src/tokens')
const TAILWIND_CLI = join(REPO_ROOT, 'node_modules/.bin/tailwindcss')

export function gzipFileBytes(path: string): number {
  return gzipSync(readFileSync(path)).length
}

/** The public `--basalt-*` names: a name is public once it is a row of the token table. */
export function publicBasaltNames(tokens: readonly { readonly name: string }[] = TOKENS): number {
  return new Set(tokens.map((t) => t.name)).size
}

const BARE_IMPORT = /^(?![./]|node:|bun:)/

/** Bare specifiers (a peer or dependency) the G0 sources reach: TS imports, CSS `@import`s. */
export function tokensPeers(
  dirs: readonly string[] = [TOKENS_DIR],
  sheets: readonly string[] = [join(CSS_DIR, 'tokens.css')],
): string[] {
  const found = new Set<string>()
  const transpiler = new Bun.Transpiler({ loader: 'ts' })
  for (const dir of dirs) {
    for (const file of walkFiles(dir, /\.ts$/)) {
      if (/\.test\.ts$|[\\/]golden[\\/]/.test(file)) continue
      for (const { path } of transpiler.scanImports(readFileSync(file, 'utf8'))) {
        if (BARE_IMPORT.test(path)) found.add(path)
      }
    }
  }
  for (const sheet of sheets) {
    for (const [, path] of readFileSync(sheet, 'utf8').matchAll(/@import\s+['"]([^'"]+)['"]/g)) {
      if (path !== undefined && BARE_IMPORT.test(path)) found.add(path)
    }
  }
  return [...found].toSorted()
}

/** gzip bytes of the Tailwind build of `tailwind.css` + typography + prose over the G0 sources. */
export function fullScanGzipBytes(): number {
  if (!existsSync(TAILWIND_CLI)) throw new Unmeasured('tailwind CLI missing, run `bun install`')
  const dir = mkdtempSync(join(tmpdir(), 'tokens-full-scan-'))
  try {
    const input = join(dir, 'in.css')
    const output = join(dir, 'out.css')
    writeFileSync(
      input,
      [
        `@import '${join(CSS_DIR, 'tailwind.css')}' source(none);`,
        `@import '${join(CSS_DIR, 'typography.css')}';`,
        `@import '${join(CSS_DIR, 'prose.css')}';`,
        `@source '${CSS_DIR}';`,
        `@source '${TOKENS_DIR}';`,
        `@source not '${join(PKG_ROOT, 'src/**/*.test.*')}';`,
        '',
      ].join('\n'),
    )
    const run = Bun.spawnSync([TAILWIND_CLI, '--input', input, '--output', output], {
      cwd: REPO_ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    if (run.exitCode !== 0) throw new Error(`tailwind exited ${run.exitCode}: ${run.stderr}`)
    return gzipFileBytes(output)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

export const rows: readonly RowDef[] = [
  {
    id: 'tokens-css-gzip',
    order: 320,
    label: 'tokens.css (gzip B, src/css/tokens.css)',
    // 1539 B measured (zlib default level), +5 percent rounded up; 1876 with the motion scale (1786 B, raise row below);
    // 1877 with the card ring in both schemes (1787 B, Issue 2851).
    // 1892 with `--basalt-scrim-wash` in both schemes (1801 B, Issue 2940).
    ceiling: 1892,
    measure: () => gzipFileBytes(join(CSS_DIR, 'tokens.css')),
  },
  {
    id: 'tokens-full-scan-css',
    order: 321,
    label: 'full-scan CSS fixture (gzip B, tailwind.css + typography + prose over the G0 sources)',
    // 12 KB is the contract ceiling (quality-contract section 6, 1 KB = 1000 B).
    ceiling: 12000,
    measure: fullScanGzipBytes,
  },
  {
    id: 'tokens-public-names',
    order: 322,
    label: 'public --basalt-* names (exact, src/tokens/table.ts)',
    ceiling: 90,
    measure: () => publicBasaltNames(),
  },
  {
    id: 'tokens-peers',
    order: 323,
    label: 'peers the tokens profile reaches (bare imports of src/tokens, tokens.css)',
    ceiling: 0,
    measure: () => {
      const peers = tokensPeers()
      return { value: peers.length, detail: peers }
    },
  },
]

export const raises: Raises = {
  'tokens-css-gzip': [
    {
      from: 1877,
      to: 1892,
      consumer:
        'the wizard dialog (Issue 2940): `--basalt-scrim-wash` is the light backdrop of a Dialog, the canvas at half strength in both schemes, so the page stays readable behind it',
      repo: 'basalt-ui',
    },
    {
      from: 1876,
      to: 1877,
      consumer:
        "the AppShell work surface (Issue 2851): `--basalt-shadow-card` is the hairline ring in both schemes, so a card on the surface's own colour reads by its edge",
      repo: 'basalt-ui',
    },
    {
      from: 1616,
      to: 1876,
      consumer:
        'the motion scale (Issue 2529): a slow step, enter and exit easings, two springs as linear() curves, the stagger step and their reduced-motion zeros; free-planning-poker v9 animates its Astro landing page from plain tokens.css and its room table from the same values',
      repo: 'free-planning-poker',
    },
    {
      from: 1615,
      to: 1616,
      consumer:
        'the `--basalt-*` token prefix (Issue 1703, owner decision): every custom property is four characters longer, +1 B gzip; jkrumm.com reads the plain `tokens.css` and keeps its names in step with basalt',
      repo: 'jkrumm.com',
    },
  ],
}
