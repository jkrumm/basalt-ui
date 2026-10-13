/**
 * Peer declaration invariants (V2-SPEC section 1, "Peers, defined once").
 *
 * Required peers carry no `optional` flag: every consumer installs them, because `.` or
 * `./styles.css` imports them statically or names them. Everything else stays `optional`, either
 * subpath-required (named by one subpath's public types or imported statically by it) or genuinely
 * optional (reached only through `import()`). npm has no per-subpath optionality, so the
 * subpath-required class is asserted by `scripts/surface-gates.ts` over the built dist graph; this
 * file pins the manifest and the source-level facts that graph rests on.
 *
 * Dropping a peer from `peerDependencies` (rather than marking it optional) would silently lose the
 * version-mismatch warning, so every peer named here must stay declared.
 *
 * Run: bun test packages/basalt-ui/tests/required-peers.test.ts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

const pkgRoot = join(import.meta.dir, '..')

/** V2-SPEC section 1: required = no `optional` flag. */
const REQUIRED_PEERS = [
  '@fontsource-variable/hubot-sans',
  '@fontsource-variable/jetbrains-mono',
  '@fontsource-variable/nunito-sans',
  '@mantine/core',
  '@mantine/hooks',
  '@mantine/modals',
  '@mantine/notifications',
  '@mantine/spotlight',
  '@tanstack/react-query',
  '@tanstack/react-router',
  'react',
  'react-dom',
]

describe('peer declarations', () => {
  const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')) as {
    peerDependencies?: Record<string, string>
    peerDependenciesMeta?: Record<string, { optional?: boolean }>
  }
  const peerDeps = pkg.peerDependencies ?? {}
  const peerMeta = pkg.peerDependenciesMeta ?? {}

  for (const peer of REQUIRED_PEERS) {
    it(`'${peer}' is declared and required`, () => {
      expect(peer in peerDeps).toBe(true)
      expect(peerMeta[peer]?.optional).not.toBe(true)
    })
  }

  it('exactly the section 1 required set is non-optional', () => {
    const nonOptional = Object.keys(peerDeps).filter((peer) => peerMeta[peer]?.optional !== true)
    expect(nonOptional.sort()).toEqual([...REQUIRED_PEERS].sort())
  })
})

describe('remend root-entry requirement (F2) — resolved, now a regression guard', () => {
  // F2 shipped in 1.11.0/B3: `content/markdown.tsx` now loads `remend` through a lazy dynamic
  // `import('remend')` (see `loadRemend` there), not a static top-level import. This block used to
  // assert the OLD, broken shape ("still imports remend statically") — that assertion started
  // failing the moment the fix landed, which was the gate doing its job. Deleting it here would
  // throw away the guard exactly when it becomes useful: the static form
  // (`import remend from 'remend'`) is one careless debugging edit away from coming back, and if it
  // does, the root `.` entry hard-requires an optional peer again — latent for a consumer who
  // already has `remend` installed, fatal (unresolved import at build time) for one who doesn't.
  //
  // So the assertion is INVERTED, not removed: it now scans every file under `src/**` and fails if
  // ANY of them still contains a static top-level import of `remend`.
  //
  // PRECISION — what counts as a violation and why. Every way a module can be statically pulled
  // into the graph in ESM/TS, enumerated:
  //  CAUGHT (all of these register 'remend' in the module graph the moment the file is evaluated):
  //   - default import           `import remend from 'remend'`
  //   - named import             `import { x } from 'remend'`
  //   - namespace import         `import * as remend from 'remend'`
  //   - default + named          `import remend, { x } from 'remend'`
  //   - default + namespace      `import remend, * as ns from 'remend'`
  //   - side-effect import       `import 'remend'` (no binding, no `from` — resolves anyway)
  //   - named re-export          `export { x } from 'remend'`
  //   - export-all               `export * from 'remend'`
  //   - export-all-as-namespace  `export * as ns from 'remend'`
  //   - mixed inline `type`      `import { type X, y } from 'remend'` (one non-type specifier
  //                              still pulls the module — the whole statement counts)
  //  DELIBERATELY EXCLUDED (erased at compile time / not static — carries no runtime requirement):
  //   - type-only import         `import type { X } from 'remend'`
  //   - type-only re-export      `export type { X } from 'remend'`
  //   - type-only export-all     `export type * from 'remend'` / `export type * as ns from 'remend'`
  //   - lazy dynamic import      `import('remend')` — a call, not a declaration; excluded because
  //                              there is never whitespace between `import` and the paren, and it
  //                              never has a `from` clause, so it can't match either alternative
  //                              below
  //   - prose mentioning remend in a comment (comments are stripped first, see below)
  //  NOT HANDLED (scope boundary, unchanged from before): a static import/export whose clause wraps
  //  across multiple lines. Every static import in this codebase is single-line by convention
  //  (oxfmt), matching the same single-line assumption this regex has always made — still an
  //  assumption, not a guarantee, so noted here rather than silently relied on.
  //
  // Implementation: comments are stripped first (block `/* … */` and line `// …`, same strip
  // `jsdoc-specifiers.test.ts` uses in reverse). The pattern is two alternatives sharing the same
  // `(?!type\b)` type-only exclusion:
  //  1. the `from`-clause form — `(?:import|export)\s+(?!type\b)[^\n]*from\s+'remend'` — covers
  //     every CAUGHT form above except the side-effect import, since all of them end in
  //     `from '...remend'`.
  //  2. the side-effect form — `import\s+(?!type\b)['"]remend['"]` — has no `from` clause at all,
  //     so alternative 1 can never match it; `import type 'remend'` is not valid syntax, but the
  //     lookahead is kept for symmetry and cost nothing.
  const REMEND_BLOCK_COMMENT_RE = /\/\*[\s\S]*?\*\//g
  const REMEND_LINE_COMMENT_RE = /\/\/.*$/gm
  const STATIC_REMEND_IMPORT_RE =
    /^(?:import|export)\s+(?!type\b)[^\n]*from\s+['"]remend['"]|^import\s+(?!type\b)['"]remend['"]/m

  function stripComments(source: string): string {
    return source.replace(REMEND_BLOCK_COMMENT_RE, '').replace(REMEND_LINE_COMMENT_RE, '')
  }

  function findSourceFiles(): string[] {
    const srcRoot = join(pkgRoot, 'src')
    const glob = new Bun.Glob('**/*.{ts,tsx}')
    return [...glob.scanSync({ cwd: srcRoot })].map((rel) => join(srcRoot, rel))
  }

  const files = findSourceFiles()

  // Sanity check: this walk must actually find files, or the assertion below is vacuous.
  it('found source files to scan', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  const violations = files
    .filter((file) => STATIC_REMEND_IMPORT_RE.test(stripComments(readFileSync(file, 'utf8'))))
    .map((file) => file.slice(pkgRoot.length + 1))

  it('no src/** file statically imports remend — that would hard-require an optional peer at the root entry again', () => {
    expect(violations).toEqual([])
  })
})

describe('motion static importers', () => {
  // `motion` is subpath-required for `./agent` (the chat UI imports it eagerly). `ThemeToggle` still
  // imports it too; V2-SPEC section 5 drops that in 2.0 (W7), at which point the root stops
  // reaching it and this list shrinks to the chat UI.
  it.each(['src/agent/chat/thread-feed.tsx', 'src/theme/theme-toggle.tsx'])(
    '%s imports motion/react statically',
    (file) => {
      expect(readFileSync(join(pkgRoot, file), 'utf8')).toMatch(/^import .+ from 'motion\/react'$/m)
    },
  )

  it("surfaces.ts states motion as ./agent's requirement in its description", () => {
    const source = readFileSync(join(pkgRoot, 'src/surfaces.ts'), 'utf8')
    const block = source.match(/'\.\/agent': \{[\s\S]*?\n  \},/)?.[0] ?? ''
    const description = block.match(/description:\s*\n?\s*'([^']*)'/)?.[1] ?? ''
    expect(description).toContain('motion')
  })
})
