/**
 * Peer declaration invariants.
 *
 * Every peer is marked `optional` in `peerDependenciesMeta`, including the five the root `.` entry
 * hard-requires at build time (`react`, `react-dom`, `@mantine/core`, `@mantine/hooks`,
 * `@tanstack/react-query`). That is a deliberate trade, not an oversight:
 *
 * npm expresses peer optionality per PACKAGE, never per SUBPATH — and `./tokens`, `./charts`,
 * `./state` and `./guard` genuinely resolve and render with none of the five installed (enforced by
 * the repo-local `basalt/token-layer-boundary` oxlint rule, by `scripts/check-dist-layering.mjs`'s
 * walk of the BUILT dist graph, and by the no-Mantine resolution step in `scripts/pack-test.sh`).
 * With the five required, a framework-free consumer that only ever imports `basalt-ui/tokens` still
 * pulls ~79 packages it will never load. Marking them optional is the only way to say
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
