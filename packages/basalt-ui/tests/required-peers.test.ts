/**
 * Inverse of `tests/surfaces-coverage.test.ts`'s optionalPeers coverage: `@tanstack/react-query`
 * is a REQUIRED peer (BasaltProvider hard-requires it at build time, per the root CLAUDE.md), so
 * it must be present in `peerDependencies` and ABSENT from `peerDependenciesMeta` — a future
 * accidental re-marking of it as optional must fail this test.
 *
 * Run: bun test packages/basalt-ui/tests/required-peers.test.ts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

const pkgRoot = join(import.meta.dir, '..')

const REQUIRED_PEER = '@tanstack/react-query'

describe('required peers', () => {
  const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')) as {
    peerDependencies?: Record<string, string>
    peerDependenciesMeta?: Record<string, { optional?: boolean }>
  }
  const peerDeps = pkg.peerDependencies ?? {}
  const peerMeta = pkg.peerDependenciesMeta ?? {}

  it(`'${REQUIRED_PEER}' is present in peerDependencies`, () => {
    expect(REQUIRED_PEER in peerDeps).toBe(true)
  })

  it(`'${REQUIRED_PEER}' is NOT marked optional in peerDependenciesMeta`, () => {
    expect(peerMeta[REQUIRED_PEER]).toBeUndefined()
  })
})
