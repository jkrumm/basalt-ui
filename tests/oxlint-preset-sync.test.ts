import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projectBanList } from '../packages/basalt-ui/scripts/gen-oxlint'
import { hasTokenLayerBoundaryRegistered } from '../packages/basalt-ui/src/surfaces'

const root = join(import.meta.dir, '..')
const OXLINT_BIN = join(root, 'node_modules', '.bin', 'oxlint')
const SHIPPED_CONFIG_PATH = join(root, 'packages/basalt-ui/configs/oxlint.json')
const FIXTURE_PATH = join(root, 'tests/fixtures/oxlint-parse-fixture.ts')

type OverrideBlock = { files: string[]; rules: Record<string, unknown> }
type NoRestrictedImportsValue = [
  string,
  { paths?: Array<{ name: string }>; patterns?: Array<{ group: string[] }> },
]

function readOverrides(path: string): unknown[] {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as { overrides?: unknown[] }
  return parsed.overrides ?? []
}

function findBlock(blocks: readonly unknown[], glob: string): OverrideBlock | undefined {
  return (blocks as OverrideBlock[]).find((b) => b.files.includes(glob))
}

function noRestrictedImportsOf(
  block: OverrideBlock | undefined,
): NoRestrictedImportsValue | undefined {
  return block?.rules['no-restricted-imports'] as NoRestrictedImportsValue | undefined
}

describe('oxlint preset sync contract', () => {
  it('shipped configs/oxlint.json overrides match the projection (drift = red)', () => {
    const projected = projectBanList('shipped')
    const committed = readOverrides(join(root, 'packages/basalt-ui/configs/oxlint.json'))
    expect(committed).toEqual(projected)
  })

  it('repo .oxlintrc.json overrides match the projection (drift = red)', () => {
    const projected = projectBanList('repo')
    const committed = readOverrides(join(root, '.oxlintrc.json'))
    expect(committed).toEqual(projected)
  })

  // ── @visx/*-only-in-charts + Mantine-free charts/tokens: moved to basalt/visx-boundary + ────────
  // ── basalt/token-layer-boundary ──────────────────────────────────────────────────────────────
  // These boundaries used to live in per-glob no-restricted-imports overrides, with the charts
  // block's implicit OMISSION of the @visx/* ban acting as the "re-allow" — an artifact of oxlint's
  // last-writer-wins override resolution, which a consumer's own no-restricted-imports override on
  // an overlapping glob could silently clobber. They're now enforced by the `basalt/visx-boundary`
  // and `basalt/token-layer-boundary` oxlint plugin rules instead (configs/oxlint-plugin.js), each
  // of which a consumer can only disable explicitly, by name — never silently. The generator
  // therefore no longer emits a no-restricted-imports override for charts/tokens at all.

  it('shipped no longer carries a charts override (boundary moved to basalt/visx-boundary)', () => {
    const projected = projectBanList('shipped')
    expect(findBlock(projected, '**/charts/**')).toBeUndefined()
  })

  it('repo charts override keeps only its non-import rule, no no-restricted-imports', () => {
    const projected = projectBanList('repo')
    const chartsBlock = findBlock(projected, 'packages/basalt-ui/src/charts/**')
    expect(chartsBlock).toBeDefined()
    expect(chartsBlock?.rules).toEqual({ 'no-underscore-dangle': 'off' })
  })

  it('shipped no longer carries a tokens override (boundary moved to basalt/token-layer-boundary)', () => {
    const projected = projectBanList('shipped')
    expect(findBlock(projected, '**/tokens/**')).toBeUndefined()
  })

  it('repo no longer carries a tokens override (boundary moved to basalt/token-layer-boundary)', () => {
    const projected = projectBanList('repo')
    expect(findBlock(projected, 'packages/basalt-ui/src/tokens/**')).toBeUndefined()
  })

  // ── Surfaces the plugin rules do NOT cover keep their Mantine-free no-restricted-imports ban ──
  // The plugins only fire on charts/tokens path segments (see oxlint-plugin.js's visx-boundary and
  // token-layer-boundary rules), so guard/query/router-tanstack/agent/state stay enforced the old
  // way — minus the now-redundant @visx/* pattern, since basalt/visx-boundary bans @visx/* outside
  // charts universally.

  it('repo headless surfaces outside charts/tokens still ban @mantine/* but no longer @visx/*', () => {
    const projected = projectBanList('repo')
    const globs = [
      'packages/basalt-ui/src/guard/**',
      'packages/basalt-ui/src/query/**',
      'packages/basalt-ui/src/router-tanstack/**',
      'packages/basalt-ui/src/agent/**',
      'packages/basalt-ui/src/state.ts',
    ]

    for (const glob of globs) {
      const block = findBlock(projected, glob)
      expect(block).toBeDefined()
      const nri = noRestrictedImportsOf(block)
      expect(nri).toBeDefined()
      const hasMantineCoreBan = (nri?.[1].paths ?? []).some((p) => p.name === '@mantine/core')
      const hasMantineHooksBan = (nri?.[1].paths ?? []).some((p) => p.name === '@mantine/hooks')
      const hasMantineGroupBan = (nri?.[1].patterns ?? []).some((p) =>
        p.group.includes('@mantine/*'),
      )
      const hasVisxGroupBan = (nri?.[1].patterns ?? []).some((p) => p.group.includes('@visx/*'))
      expect(hasMantineCoreBan).toBe(true)
      expect(hasMantineHooksBan).toBe(true)
      expect(hasMantineGroupBan).toBe(true)
      expect(hasVisxGroupBan).toBe(false)
    }
  })

  it('no override anywhere still bans the @visx/* pattern (fully superseded by basalt/visx-boundary)', () => {
    for (const target of ['shipped', 'repo'] as const) {
      const projected = projectBanList(target)
      for (const block of projected as OverrideBlock[]) {
        const nri = noRestrictedImportsOf(block)
        const hasVisxGroupBan = (nri?.[1].patterns ?? []).some((p) => p.group.includes('@visx/*'))
        expect(hasVisxGroupBan).toBe(false)
      }
    }
  })

  it('shipped overrides carry exactly the #app catch-all block (no narrower boundary overrides remain)', () => {
    const overrides = readOverrides(SHIPPED_CONFIG_PATH) as OverrideBlock[]
    expect(overrides).toHaveLength(1)
    expect(overrides[0]?.files).toEqual(['**/*.{ts,tsx}'])

    const nri = noRestrictedImportsOf(overrides[0])
    const paths = nri?.[1].paths ?? []
    expect(paths.map((p) => p.name).toSorted()).toEqual(['antd', 'framer-motion'])
  })

  // ── Playground dogfooding: it consumes the SHIPPED preset, not the repo-local config ──────────
  // apps/playground is the model consumer, so it must see exactly what argo sees. It gets there
  // via its own nested apps/playground/.oxlintrc.json (oxlint resolves the nearest config and it
  // REPLACES the root one for that subtree — verified against oxlint 1.68.0). These assertions
  // lock the config-level chain; the preset's runtime behaviour is covered by pack-test.sh's
  // scratch-consumer step.

  it('#app repo globs exclude apps/playground (it is governed by its own nested config)', () => {
    const block = findBlock(projectBanList('repo'), 'packages/basalt-ui/src/**')
    expect(block).toBeDefined()
    expect(block?.files.some((f) => f.startsWith('apps/playground'))).toBe(false)
  })

  it('apps/playground extends the shipped preset via the documented node_modules path', () => {
    const parsed = JSON.parse(
      readFileSync(join(root, 'apps/playground/.oxlintrc.json'), 'utf8'),
    ) as { extends?: string[] }
    expect(parsed.extends).toEqual(['./node_modules/basalt-ui/configs/oxlint.json'])
  })

  it('the preset the playground extends carries the visx boundaries but NOT token-layer-boundary', () => {
    const rules = (
      JSON.parse(readFileSync(SHIPPED_CONFIG_PATH, 'utf8')) as {
        rules?: Record<string, unknown>
      }
    ).rules
    expect(rules?.['basalt/visx-boundary']).toBe('error')
    expect(rules?.['basalt/visx-tooltip']).toBe('error')
    // Repo-local by design — guards basalt's internal layering, never a consumer contract.
    // surfaces-coverage.test.ts asserts the mirror image against the repo-local config.
    expect(hasTokenLayerBoundaryRegistered(rules)).toBe(false)
  })

  it('shipped configs/oxlint.json actually parses in oxlint (not just JSON.parse)', () => {
    const result = Bun.spawnSync([OXLINT_BIN, '--config', SHIPPED_CONFIG_PATH, FIXTURE_PATH])
    const output = `${result.stdout}${result.stderr}`
    expect(output).not.toContain('Failed to parse')
    expect(output).not.toContain('unknown field')
    // A config-parse failure exits non-zero before any lint findings are produced; a clean
    // config run may still exit non-zero on lint findings, which is fine — only the parse
    // failure text above is the actual gate here.
  })
})
