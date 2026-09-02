/**
 * Peer declaration invariants.
 *
 * Every peer is marked `optional` in `peerDependenciesMeta`, including the six the root `.` entry
 * hard-requires at build time (`react`, `react-dom`, `@mantine/core`, `@mantine/hooks`,
 * `@tanstack/react-query`, `motion`). That is a deliberate trade, not an oversight:
 *
 * npm expresses peer optionality per PACKAGE, never per SUBPATH — and `./tokens`, `./charts`,
 * `./state` and `./guard` genuinely resolve and render with none of the six installed (enforced by
 * the repo-local `basalt/token-layer-boundary` oxlint rule, by `scripts/check-dist-layering.mjs`'s
 * walk of the BUILT dist graph, and by the no-Mantine resolution step in `scripts/pack-test.sh`).
 * With the six required, a framework-free consumer that only ever imports `basalt-ui/tokens` still
 * pulls packages it will never load. Marking them optional is the only way to say
 * "framework-free subpaths cost nothing" in the manifest format that exists.
 *
 * `remend` is NOT in that six — F2 (1.11.0/B3) made `content/markdown.tsx`'s remend import a lazy
 * dynamic `import()`, so the root `.` entry no longer hard-requires it. It stays in
 * `peerDependencies`/`peerDependenciesMeta` regardless (every peer does, per the loop below); it is
 * simply no longer one of the ones that is optional ONLY on paper. The `remend root-entry
 * requirement (F2)` describe block below is the regression guard for that fix.
 *
 * What that COSTS: a consumer of the root `.` entry no longer gets a missing-peer warning at
 * install time — they get an unresolved-import error from their bundler the first time they build.
 * Later and less friendly, but still loud and still pointing at the missing package.
 *
 * What it must NOT cost — and is what this file pins — is the VERSION signal. `optional` only
 * suppresses the missing-peer install; a peer that is present at an incompatible version still
 * warns. That check exists only while the package stays listed in `peerDependencies`, so dropping
 * one from there (rather than merely marking it optional) would silently let a consumer run
 * basalt-ui against a Mantine or React major it was never built for.
 *
 * Run: bun test packages/basalt-ui/tests/required-peers.test.ts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

const pkgRoot = join(import.meta.dir, '..')

/** The peers the root `.` entry hard-requires at build time — optional in the manifest, not in fact. */
const RUNTIME_REQUIRED_PEERS = [
  '@mantine/core',
  '@mantine/hooks',
  '@tanstack/react-query',
  'motion',
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

  for (const peer of RUNTIME_REQUIRED_PEERS) {
    it(`'${peer}' stays declared in peerDependencies (keeps the version-mismatch warning)`, () => {
      expect(peer in peerDeps).toBe(true)
    })

    it(`'${peer}' is optional, so a framework-free consumer installs none of it`, () => {
      expect(peerMeta[peer]?.optional).toBe(true)
    })
  }

  it('every peer is optional — none is left to fail a tokens-only install', () => {
    const nonOptional = Object.keys(peerDeps).filter((peer) => peerMeta[peer]?.optional !== true)
    expect(nonOptional).toEqual([])
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

describe('motion root-entry requirement (two independent paths)', () => {
  // Unlike `remend` in the F2 block above, `motion` is root-required via TWO independent static
  // import paths, not one:
  //
  //  - `ThemeToggle` (a root-entry component, unrelated to agent-chat) imports `motion/react`
  //    directly.
  //  - `src/index.ts` statically re-exports `./agent-chat`, which itself statically imports
  //    `motion/react` from `thread-feed.tsx` and `thread-detail-panel.tsx` (see the
  //    `./agent-chat hard-required peers` describe block below).
  //
  // A future change that makes the agent-chat re-export lazy removes only the SECOND path — the
  // first, `ThemeToggle`, remains. So unlike the `remend` F2 block above, `motion` must NOT be read
  // as droppable from RUNTIME_REQUIRED_PEERS once agent-chat goes lazy; it stays required for as
  // long as `ThemeToggle` imports `motion/react` on its own.
  it('theme/theme-toggle.tsx still imports motion/react statically', () => {
    const source = readFileSync(join(pkgRoot, 'src/theme/theme-toggle.tsx'), 'utf8')
    expect(source).toMatch(/from 'motion\/react'/)
  })
})

describe('./agent-chat hard-required peers', () => {
  // `./agent-chat` (`src/agent-chat/index.ts`) is its OWN subpath, not merely a root re-export, and
  // its peer story was found to be a lie: `surfaces.ts` listed `motion` under `optionalPeers`, but it
  // is reached by a STATIC top-level import the moment any export of the subpath is evaluated:
  //
  //  - motion    — index.ts -> thread-feed.tsx AND thread-detail-panel.tsx -> `import … from
  //                'motion/react'`.
  //
  // `remend` is NOT part of that hard-require: index.ts -> thread-message.tsx statically imports
  // `Markdown` from `../content/markdown`, but `content/markdown.tsx` resolves `remend` itself
  // through a lazy dynamic `import('remend')` (see `loadRemend` there, and the F2 describe block
  // above) — the static chain stops at the `Markdown` component, so evaluating `./agent-chat` never
  // forces remend's resolution. It is genuinely optional here, same as at the root `.` entry.
  //
  // Confirmed empirically (not just by reading): a scratch-installed tarball with react/react-dom/
  // @mantine/core/@mantine/hooks but WITHOUT motion fails `await import('basalt-ui/agent-chat')` with
  // "Cannot find package 'motion'". The same tarball WITH react/react-dom/@mantine/core/
  // @mantine/hooks/motion and nothing else — remend included — resolves and renders. Every other
  // declared optionalPeer of `./agent-chat` (`ai`, `remend`, `use-stick-to-bottom`, `react-markdown`,
  // `remark-gfm`, `shiki`, `@shikijs/langs`, `@shikijs/themes`, `beautiful-mermaid`) is reached only
  // via `lazy()`/dynamic `import()` and is genuinely optional.
  //
  // npm has no per-subpath optionality (`peerDependenciesMeta` stays package-wide, so `motion` stays
  // `optional: true` there too — pinned by the shared checks above). This test plus the
  // `./agent-chat` description string in `surfaces.ts` are therefore the only places the truth can
  // live. If a future change makes the motion import lazy too, update this test, the `surfaces.ts`
  // description, and README.md's Requirements table in the same commit — not adjust the assertion.

  it('agent-chat/thread-message.tsx still imports Markdown statically (remend itself stays lazy inside it)', () => {
    const source = readFileSync(join(pkgRoot, 'src/agent-chat/thread-message.tsx'), 'utf8')
    expect(source).toMatch(/^import \{ Markdown \} from '\.\.\/content\/markdown'$/m)
  })

  it.each(['thread-feed.tsx', 'thread-detail-panel.tsx'])(
    'agent-chat/%s still imports motion statically from motion/react',
    (file) => {
      const source = readFileSync(join(pkgRoot, 'src/agent-chat', file), 'utf8')
      expect(source).toMatch(/^import .+ from 'motion\/react'$/m)
    },
  )

  it('agent-chat/index.ts still statically re-exports ThreadTranscript, ThreadFeed, and ThreadDetailPanel', () => {
    const source = readFileSync(join(pkgRoot, 'src/agent-chat/index.ts'), 'utf8')
    expect(source).toMatch(/export \{ ThreadFeed \} from '\.\/thread-feed'/)
    expect(source).toMatch(/export \{ ThreadDetailPanel \} from '\.\/thread-detail-panel'/)
    expect(source).toMatch(
      /export \{ threadPartRenderers, ThreadTranscript \} from '\.\/thread-message'/,
    )
  })

  it("surfaces.ts states motion as ./agent-chat's hard requirement, and remend as genuinely optional, in its DESCRIPTION string", () => {
    // Checked against `description`, not the whole `./agent-chat` block — `optionalPeers` lists both
    // names too (npm has no per-subpath optionality, so they must stay there), which would make a
    // whole-block match pass even if the description never said "required".
    const source = readFileSync(join(pkgRoot, 'src/surfaces.ts'), 'utf8')
    const block = source.match(/'\.\/agent-chat': \{[\s\S]*?\n  \},/)?.[0] ?? ''
    expect(block).not.toBe('')
    const description = block.match(/description:\s*\n?\s*'([^']*)'/)?.[1] ?? ''
    expect(description).not.toBe('')
    expect(description).toContain('motion')
    expect(description.toLowerCase()).toContain('required')
    expect(description).toContain('remend')
    // The bug this test exists to catch: surfaces.ts once called BOTH peers "required", pinning a
    // claim that went stale the moment remend's static import in content/markdown.tsx became a lazy
    // one (F2). Fail loud if that false pairing comes back.
    expect(description.toLowerCase()).not.toMatch(/remend\b[\s\S]{0,40}\brequired\b/)
    expect(description).toMatch(/remend\b[\s\S]{0,60}(lazy|optional)/i)
  })
})
