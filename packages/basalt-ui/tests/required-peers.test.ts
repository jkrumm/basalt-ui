/**
 * Peer declaration invariants.
 *
 * Every peer is marked `optional` in `peerDependenciesMeta`, including the seven the root `.` entry
 * hard-requires at build time (`react`, `react-dom`, `@mantine/core`, `@mantine/hooks`,
 * `@tanstack/react-query`, `remend`, `motion`). That is a deliberate trade, not an oversight:
 *
 * npm expresses peer optionality per PACKAGE, never per SUBPATH — and `./tokens`, `./charts`,
 * `./state` and `./guard` genuinely resolve and render with none of the seven installed (enforced by
 * the repo-local `basalt/token-layer-boundary` oxlint rule, by `scripts/check-dist-layering.mjs`'s
 * walk of the BUILT dist graph, and by the no-Mantine resolution step in `scripts/pack-test.sh`).
 * With the seven required, a framework-free consumer that only ever imports `basalt-ui/tokens` still
 * pulls packages it will never load. Marking them optional is the only way to say
 * "framework-free subpaths cost nothing" in the manifest format that exists.
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
  'remend',
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

describe('remend root-entry requirement (F2)', () => {
  // `remend`'s ROOT-entry hard-requirement is a fact about `content/markdown.tsx`'s import style,
  // not about `peerDependencies` — the chain is `src/index.ts` -> `agent-chat/thread-message.tsx`
  // -> `content/markdown.tsx`, and this file's own header doctrine (react-markdown/remark-gfm) shows
  // the alternative: those two go through `lazy` + a dynamic `import()`, so they are NOT root
  // requirements even though `Markdown` uses them. `remend` is imported statically at the top of the
  // module instead, which is what actually makes it required.
  //
  // Phase B3 (basalt-ui 1.11.0, docs/AGENT-CHAT-SPEC.md) makes this import lazy too. When it does,
  // this assertion must be DELETED (along with `'remend'` in RUNTIME_REQUIRED_PEERS above and the
  // root-requirement row/notes in README.md) — not adjusted. Until then it is the gate that fails
  // the moment the source changes without the docs following.
  it('content/markdown.tsx still imports remend statically (delete this test in 1.11.0/B3)', () => {
    const source = readFileSync(join(pkgRoot, 'src/content/markdown.tsx'), 'utf8')
    expect(source).toMatch(/^import remend from 'remend'$/m)
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
  it('theme-toggle/index.tsx still imports motion/react statically', () => {
    const source = readFileSync(join(pkgRoot, 'src/theme-toggle/index.tsx'), 'utf8')
    expect(source).toMatch(/from 'motion\/react'/)
  })
})

describe('./agent-chat hard-required peers', () => {
  // `./agent-chat` (`src/agent-chat/index.ts`) is its OWN subpath, not merely a root re-export, and
  // its peer story was found to be a lie: `surfaces.ts` listed every one of its peers under
  // `optionalPeers`, but two are reached by a STATIC top-level import the moment any export of the
  // subpath is evaluated:
  //
  //  - remend    — index.ts -> thread-message.tsx -> content/markdown.tsx -> `import remend from
  //                'remend'` (same chain as the F2 describe block above, reached a second way).
  //  - motion    — index.ts -> thread-feed.tsx AND thread-detail-panel.tsx -> `import … from
  //                'motion/react'`.
  //
  // Confirmed empirically (not just by reading): a scratch-installed tarball with react/react-dom/
  // @mantine/core/@mantine/hooks but WITHOUT remend fails `await import('basalt-ui/agent-chat')`
  // with "Cannot find package 'remend'"; the same install WITHOUT motion fails with "Cannot find
  // package 'motion'". The same tarball WITH react/react-dom/@mantine/core/@mantine/hooks/remend/
  // motion and nothing else resolves and renders. Every other declared optionalPeer of `./agent-chat`
  // (`ai`, `use-stick-to-bottom`, `react-markdown`, `remark-gfm`, `shiki`, `@shikijs/langs`,
  // `@shikijs/themes`, `beautiful-mermaid`) is reached only via `lazy()`/dynamic `import()` and is
  // genuinely optional.
  //
  // npm has no per-subpath optionality (`peerDependenciesMeta` stays package-wide, so `remend`/
  // `motion` stay `optional: true` there too — pinned by the shared checks above). This test plus
  // the `./agent-chat` description string in `surfaces.ts` are therefore the only places the truth
  // can live. If a future change makes either import lazy, update this test, the `surfaces.ts`
  // description, and README.md's Requirements table in the same commit — not adjust the assertion.

  it('agent-chat/thread-message.tsx still imports Markdown statically (pulls remend eagerly)', () => {
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

  it("surfaces.ts states remend and motion as ./agent-chat's hard requirements in its DESCRIPTION string", () => {
    // Checked against `description`, not the whole `./agent-chat` block — `optionalPeers` lists
    // both names too (npm has no per-subpath optionality, so they must stay there), which would
    // make a whole-block match pass even if the description never said "required".
    const source = readFileSync(join(pkgRoot, 'src/surfaces.ts'), 'utf8')
    const block = source.match(/'\.\/agent-chat': \{[\s\S]*?\n  \},/)?.[0] ?? ''
    expect(block).not.toBe('')
    const description = block.match(/description:\s*\n?\s*'([^']*)'/)?.[1] ?? ''
    expect(description).not.toBe('')
    expect(description).toContain('remend')
    expect(description).toContain('motion')
    expect(description.toLowerCase()).toContain('required')
  })
})
