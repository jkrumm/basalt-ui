import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  COMPILER_RULES,
  PKG_ROOT,
  PLAYGROUND_COMPILER_RULE_EXEMPTIONS,
  REPO_COMPILER_RULE_EXEMPTIONS,
  projectBanList,
  projectPlaygroundOverrides,
} from '../packages/basalt-ui/scripts/gen-oxlint'
import { hasTokenLayerBoundaryRegistered } from '../packages/basalt-ui/src/surfaces'

const root = join(import.meta.dir, '..')
const OXLINT_BIN = join(root, 'node_modules', '.bin', 'oxlint')
const SHIPPED_CONFIG_PATH = join(root, 'packages/basalt-ui/configs/oxlint.json')
const GUARDS_CONFIG_PATH = join(root, 'packages/basalt-ui/configs/oxlint-basalt.json')
const FIXTURE_PATH = join(root, 'tests/fixtures/oxlint-parse-fixture.ts')
const EQEQEQ_FIXTURE_PATH = join(root, 'tests/fixtures/eqeqeq-smart-fixture.ts')

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

  // ── @visx/*-only-in-charts + Mantine-free charts/tokens: moved to basalt/chart-engine-boundary + ────────
  // ── basalt/token-layer-boundary ──────────────────────────────────────────────────────────────
  // These boundaries used to live in per-glob no-restricted-imports overrides, with the charts
  // block's implicit OMISSION of the @visx/* ban acting as the "re-allow" — an artifact of oxlint's
  // last-writer-wins override resolution, which a consumer's own no-restricted-imports override on
  // an overlapping glob could silently clobber. They're now enforced by the `basalt/chart-engine-boundary`
  // and `basalt/token-layer-boundary` oxlint plugin rules instead (configs/oxlint-plugin.js), each
  // of which a consumer can only disable explicitly, by name — never silently. The generator
  // therefore no longer emits a no-restricted-imports override for charts/tokens at all.

  it('shipped no longer carries a charts override (boundary moved to basalt/chart-engine-boundary)', () => {
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
  // The plugins only fire on charts/tokens path segments (see oxlint-plugin.js's chart-engine-boundary and
  // token-layer-boundary rules), so the agent runtime and state stay enforced the old
  // way — minus the now-redundant @visx/* pattern, since basalt/chart-engine-boundary bans @visx/*
  // everywhere.

  it('repo headless surfaces outside charts/tokens still ban @mantine/* but no longer @visx/*', () => {
    const projected = projectBanList('repo')
    const globs = ['packages/basalt-ui/src/agent/*.ts', 'packages/basalt-ui/src/state.ts']

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

  it('no override anywhere still bans the @visx/* pattern (fully superseded by basalt/chart-engine-boundary)', () => {
    for (const target of ['shipped', 'repo'] as const) {
      const projected = projectBanList(target)
      for (const block of projected as OverrideBlock[]) {
        const nri = noRestrictedImportsOf(block)
        const hasVisxGroupBan = (nri?.[1].patterns ?? []).some((p) => p.group.includes('@visx/*'))
        expect(hasVisxGroupBan).toBe(false)
      }
    }
  })

  it('shipped overrides carry exactly the #app catch-all block and the route-file block (no narrower boundary overrides remain)', () => {
    const overrides = readOverrides(SHIPPED_CONFIG_PATH) as OverrideBlock[]
    expect(overrides).toHaveLength(2)
    expect(overrides[0]?.files).toEqual(['**/*.{ts,tsx}'])
    expect(overrides[1]).toEqual({
      files: ['**/routes/**', '**/__root.tsx'],
      rules: { 'react/only-export-components': 'off' },
    })

    const nri = noRestrictedImportsOf(overrides[0])
    const paths = nri?.[1].paths ?? []
    expect(paths.map((p) => p.name).toSorted()).toEqual(['antd', 'framer-motion'])
  })

  it('the route-file override is shipped-only (inert in the repo-local config)', () => {
    expect(findBlock(projectBanList('repo'), '**/__root.tsx')).toBeUndefined()
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

  // The basalt/* levels live in the guards-only preset, which the full one extends.
  it('the preset the playground extends carries the engine boundary but NOT the repo-only boundaries', () => {
    const shipped = JSON.parse(readFileSync(SHIPPED_CONFIG_PATH, 'utf8')) as { extends?: string[] }
    expect(shipped.extends).toEqual(['./oxlint-basalt.json'])
    const rules = (
      JSON.parse(readFileSync(GUARDS_CONFIG_PATH, 'utf8')) as {
        rules?: Record<string, unknown>
      }
    ).rules
    expect(rules?.['basalt/chart-engine-boundary']).toBe('error')
    expect(rules?.['basalt/visx-boundary']).toBeUndefined()
    expect(rules?.['basalt/visx-tooltip']).toBeUndefined()
    // Repo-only like token-layer-boundary: `@tanstack/charts/react` is basalt's own host seam.
    expect(rules?.['basalt/chart-host-single']).toBeUndefined()
    // Repo-local by design — guards basalt's internal layering, never a consumer contract.
    // surfaces-coverage.test.ts asserts the mirror image against the repo-local config.
    expect(hasTokenLayerBoundaryRegistered(rules)).toBe(false)
  })

  it.each([SHIPPED_CONFIG_PATH, GUARDS_CONFIG_PATH])('%s actually parses in oxlint', (config) => {
    const result = Bun.spawnSync([OXLINT_BIN, '--config', config, FIXTURE_PATH])
    const output = `${result.stdout}${result.stderr}`
    expect(output).not.toContain('Failed to parse')
    expect(output).not.toContain('unknown field')
    // A config-parse failure exits non-zero before any lint findings are produced; a clean
    // config run may still exit non-zero on lint findings, which is fine — only the parse
    // failure text above is the actual gate here.
  })
})

describe('shipped preset — eqeqeq smart mode', () => {
  // `eqeqeq: "error"` (bare) flags the deliberate `x != null` nullish idiom, which cost a real
  // consumer 4 false positives. "smart" allows it while still catching a genuine loose compare.
  // Asserted against oxlint's ACTUAL output, since this hinges on oxlint's option semantics.
  const output = (): string => {
    const result = Bun.spawnSync([OXLINT_BIN, '--config', SHIPPED_CONFIG_PATH, EQEQEQ_FIXTURE_PATH])
    return `${result.stdout}${result.stderr}`
  }

  it('allows `!= null`', () => {
    expect(output()).not.toContain('Expected !== and instead saw !=')
  })

  it('still flags a genuine loose comparison', () => {
    expect(output()).toContain('Expected === and instead saw ==')
  })
})

describe('React-compiler rules stay on', () => {
  const topLevelRules = (path: string): Record<string, unknown> =>
    (JSON.parse(readFileSync(path, 'utf8')) as { rules: Record<string, unknown> }).rules

  it.each([join(root, '.oxlintrc.json'), join(root, 'apps/playground/.oxlintrc.json')])(
    '%s sets all seven rules to error',
    (path) => {
      const rules = topLevelRules(path)
      for (const rule of COMPILER_RULES) expect(rules[rule]).toBe('error')
    },
  )

  it('playground overrides match the projection (drift = red)', () => {
    const committed = readOverrides(join(root, 'apps/playground/.oxlintrc.json'))
    expect(committed).toEqual(projectPlaygroundOverrides())
  })

  const allowed = new Set<string>(COMPILER_RULES)

  it.each([
    ['repo', REPO_COMPILER_RULE_EXEMPTIONS, ''],
    ['playground', PLAYGROUND_COMPILER_RULE_EXEMPTIONS, 'apps/playground/'],
  ] as const)(
    '%s exemptions: real files, a reason, one rule each, never src/charts',
    (_, list, base) => {
      for (const { rule, reason, files } of list) {
        expect(allowed.has(rule)).toBe(true)
        expect(reason.trim().length).toBeGreaterThan(0)
        expect(files.length).toBeGreaterThan(0)
        for (const file of files) {
          expect(existsSync(join(root, base, file))).toBe(true)
          expect(file.startsWith(`${PKG_ROOT}src/charts/`)).toBe(false)
        }
      }
      const keys = list.flatMap(({ rule }) => rule)
      expect(new Set(keys).size).toBe(keys.length)
    },
  )
})
