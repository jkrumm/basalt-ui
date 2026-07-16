import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projectBanList } from '../packages/basalt-ui/scripts/gen-oxlint'

const root = join(import.meta.dir, '..')
const OXLINT_BIN = join(root, 'node_modules', '.bin', 'oxlint')
const SHIPPED_CONFIG_PATH = join(root, 'packages/basalt-ui/configs/oxlint.json')
const FIXTURE_PATH = join(root, 'tests/fixtures/oxlint-parse-fixture.ts')

function readOverrides(path: string): unknown[] {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as { overrides?: unknown[] }
  return parsed.overrides ?? []
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

  it('charts override permits @visx/* (the re-allow holds in shipped)', () => {
    const projected = projectBanList('shipped')
    const chartsBlock = projected.find((b) => {
      const block = b as { files: string[] }
      return block.files.includes('**/charts/**')
    }) as
      | {
          files: string[]
          rules: { 'no-restricted-imports': [string, { patterns?: Array<{ group: string[] }> }] }
        }
      | undefined

    expect(chartsBlock).toBeDefined()
    const nri = chartsBlock?.rules['no-restricted-imports'][1]
    const hasVsixGroupBan = (nri?.patterns ?? []).some((p) => p.group.includes('@visx/*'))
    expect(hasVsixGroupBan).toBe(false)
  })

  it('charts override permits @visx/* (the re-allow holds in repo)', () => {
    const projected = projectBanList('repo')
    const chartsBlock = projected.find((b) => {
      const block = b as { files: string[] }
      return block.files.includes('packages/basalt-ui/src/charts/**')
    }) as
      | {
          files: string[]
          rules: { 'no-restricted-imports': [string, { patterns?: Array<{ group: string[] }> }] }
        }
      | undefined

    expect(chartsBlock).toBeDefined()
    const nri = chartsBlock?.rules['no-restricted-imports'][1]
    const hasVsixGroupBan = (nri?.patterns ?? []).some((p) => p.group.includes('@visx/*'))
    expect(hasVsixGroupBan).toBe(false)
  })

  it('tokens override bans @visx/* in shipped (D2 closure)', () => {
    const projected = projectBanList('shipped')
    const tokensBlock = projected.find((b) => {
      const block = b as { files: string[] }
      return block.files.includes('**/tokens/**')
    }) as
      | {
          files: string[]
          rules: { 'no-restricted-imports': [string, { patterns?: Array<{ group: string[] }> }] }
        }
      | undefined

    expect(tokensBlock).toBeDefined()
    const nri = tokensBlock?.rules['no-restricted-imports'][1]
    const hasVsixGroupBan = (nri?.patterns ?? []).some((p) => p.group.includes('@visx/*'))
    expect(hasVsixGroupBan).toBe(true)
  })

  it('tokens override bans @visx/* in repo (D2 closure)', () => {
    const projected = projectBanList('repo')
    const tokensBlock = projected.find((b) => {
      const block = b as { files: string[] }
      return block.files.includes('packages/basalt-ui/src/tokens/**')
    }) as
      | {
          files: string[]
          rules: { 'no-restricted-imports': [string, { patterns?: Array<{ group: string[] }> }] }
        }
      | undefined

    expect(tokensBlock).toBeDefined()
    const nri = tokensBlock?.rules['no-restricted-imports'][1]
    const hasVsixGroupBan = (nri?.patterns ?? []).some((p) => p.group.includes('@visx/*'))
    expect(hasVsixGroupBan).toBe(true)
  })

  it('tokens override bans @mantine/* in shipped (D2 closure)', () => {
    const projected = projectBanList('shipped')
    const tokensBlock = projected.find((b) => {
      const block = b as { files: string[] }
      return block.files.includes('**/tokens/**')
    }) as
      | {
          files: string[]
          rules: {
            'no-restricted-imports': [
              string,
              { paths?: Array<{ name: string }>; patterns?: Array<{ group: string[] }> },
            ]
          }
        }
      | undefined

    expect(tokensBlock).toBeDefined()
    const nri = tokensBlock?.rules['no-restricted-imports'][1]
    const hasMantineCoreBan = (nri?.paths ?? []).some((p) => p.name === '@mantine/core')
    const hasMantineHooksBan = (nri?.paths ?? []).some((p) => p.name === '@mantine/hooks')
    const hasMantineGroupBan = (nri?.patterns ?? []).some((p) => p.group.includes('@mantine/*'))
    expect(hasMantineCoreBan).toBe(true)
    expect(hasMantineHooksBan).toBe(true)
    expect(hasMantineGroupBan).toBe(true)
  })

  it('tokens override bans @mantine/* in repo (D2 closure)', () => {
    const projected = projectBanList('repo')
    const tokensBlock = projected.find((b) => {
      const block = b as { files: string[] }
      return block.files.includes('packages/basalt-ui/src/tokens/**')
    }) as
      | {
          files: string[]
          rules: {
            'no-restricted-imports': [
              string,
              { paths?: Array<{ name: string }>; patterns?: Array<{ group: string[] }> },
            ]
          }
        }
      | undefined

    expect(tokensBlock).toBeDefined()
    const nri = tokensBlock?.rules['no-restricted-imports'][1]
    const hasMantineCoreBan = (nri?.paths ?? []).some((p) => p.name === '@mantine/core')
    const hasMantineHooksBan = (nri?.paths ?? []).some((p) => p.name === '@mantine/hooks')
    const hasMantineGroupBan = (nri?.patterns ?? []).some((p) => p.group.includes('@mantine/*'))
    expect(hasMantineCoreBan).toBe(true)
    expect(hasMantineHooksBan).toBe(true)
    expect(hasMantineGroupBan).toBe(true)
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
