import { describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  CHART_HOST_FILE,
  COMPILER_RULES,
  PKG_ROOT,
  PLAYGROUND_COMPILER_RULE_EXEMPTIONS,
  REPO_COMPILER_RULE_EXEMPTIONS,
  projectBanList,
  projectPlaygroundOverrides,
} from '../packages/basalt-ui/scripts/gen-oxlint'

const root = join(import.meta.dir, '..')
const OXLINT_BIN = join(root, 'node_modules', '.bin', 'oxlint')
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

describe('repo oxlint config sync contract', () => {
  it('repo .oxlintrc.json overrides match the projection (drift = red)', () => {
    expect(readOverrides(join(root, '.oxlintrc.json'))).toEqual(projectBanList())
  })

  it('the repo config loads no JS plugin: the 2.x `basalt` plugin is retired', () => {
    const parsed = JSON.parse(readFileSync(join(root, '.oxlintrc.json'), 'utf8')) as {
      jsPlugins?: string[]
      rules?: Record<string, unknown>
    }
    expect(parsed.jsPlugins).toBeUndefined()
    expect(Object.keys(parsed.rules ?? {}).filter((id) => id.startsWith('basalt/'))).toEqual([])
  })

  it('src/charts keeps only its non-import rule', () => {
    const chartsBlock = findBlock(projectBanList(), 'packages/basalt-ui/src/charts/**')
    expect(chartsBlock?.rules).toEqual({ 'no-underscore-dangle': 'off' })
  })

  it('src bans @visx/* and the engine host; the host file alone may import the host', () => {
    const blocks = projectBanList()
    const app = noRestrictedImportsOf(findBlock(blocks, 'packages/basalt-ui/src/**'))?.[1]
    expect(app?.patterns?.flatMap((p) => p.group).toSorted()).toEqual([
      '@tanstack/charts/react/*',
      '@visx/*',
    ])
    expect(app?.paths?.map((p) => p.name).toSorted()).toEqual([
      '@tanstack/charts/react',
      'framer-motion',
    ])

    const host = noRestrictedImportsOf(findBlock(blocks, CHART_HOST_FILE))?.[1]
    expect(host?.paths?.map((p) => p.name)).toEqual(['framer-motion'])
    expect(host?.patterns?.flatMap((p) => p.group)).toEqual(['@visx/*'])
    // Last, so oxlint's last-writer-wins resolution picks it for the host file.
    expect(blocks.at(-1)?.files).toEqual([CHART_HOST_FILE])
  })

  it('src/** blocks exclude apps/playground (it is governed by its own nested config)', () => {
    const block = findBlock(projectBanList(), 'packages/basalt-ui/src/**')
    expect(block).toBeDefined()
    expect(block?.files.some((f) => f.startsWith('apps/playground'))).toBe(false)
  })

  it('apps/playground extends the app preset its install renders (.oxlintrc.basalt.json)', () => {
    const parsed = JSON.parse(
      readFileSync(join(root, 'apps/playground/.oxlintrc.json'), 'utf8'),
    ) as { extends?: string[] }
    expect(parsed.extends).toEqual(['./.oxlintrc.basalt.json'])
  })

  it('the repo config actually parses in oxlint', () => {
    const result = Bun.spawnSync([
      OXLINT_BIN,
      '--config',
      join(root, '.oxlintrc.json'),
      FIXTURE_PATH,
    ])
    const output = `${result.stdout}${result.stderr}`
    expect(output).not.toContain('Failed to parse')
    expect(output).not.toContain('unknown field')
  })
})

describe('the import bans fire for real', () => {
  const SOURCE = [
    "import { scaleLinear } from '@visx/scale'",
    "import { Chart } from '@tanstack/charts/react'",
    'export const x = [scaleLinear, Chart]',
    '',
  ].join('\n')

  function findings(file: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'basalt-bans-'))
    try {
      const config = JSON.parse(readFileSync(join(root, '.oxlintrc.json'), 'utf8')) as {
        rules: Record<string, unknown>
        overrides: unknown[]
      }
      // The two bans alone: the repo's other rules judge this throwaway source too.
      writeFileSync(
        join(dir, '.oxlintrc.json'),
        JSON.stringify({ rules: {}, overrides: config.overrides }),
      )
      mkdirSync(dirname(join(dir, file)), { recursive: true })
      writeFileSync(join(dir, file), SOURCE)
      const result = Bun.spawnSync([OXLINT_BIN, '--format=unix', '-c', '.oxlintrc.json', file], {
        cwd: dir,
      })
      return `${result.stdout}${result.stderr}`
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }

  it('src bans both @visx/* and the engine host', () => {
    const out = findings('packages/basalt-ui/src/charts/other.ts')
    expect(out).toContain("'@visx/scale' import is restricted")
    expect(out).toContain("'@tanstack/charts/react' import is restricted")
  })

  it('the host file escapes the host ban only', () => {
    const out = findings(CHART_HOST_FILE)
    expect(out).toContain("'@visx/scale' import is restricted")
    expect(out).not.toContain("'@tanstack/charts/react' import is restricted")
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
