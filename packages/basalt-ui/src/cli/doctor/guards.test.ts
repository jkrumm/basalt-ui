import { afterEach, describe, expect, it } from 'bun:test'
import { appendFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { cleanupTrees, commitTree, editManifest, HEALTHY, makeTree, runCheck } from './fixture.test'

afterEach(cleanupTrees)

describe('check 10: tokens:css --check for every manifest tokens[] entry', () => {
  it('passes when every output matches its flags', async () => {
    expect((await runCheck(makeTree('app'), 10)).status).toBe('pass')
  })

  it('fails when an output has drifted by one byte', async () => {
    const dir = makeTree('app')
    appendFileSync(resolve(dir, 'src/tokens.css'), ' ')
    const r = await runCheck(dir, 10)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('src/tokens.css')
  })

  it('fails when an output was never generated', async () => {
    const r = await runCheck(makeTree('app', { 'src/tokens.css': null }), 10)
    expect(r.status).toBe('fail')
  })

  it('checks each entry with its own flags', async () => {
    const dir = makeTree('app')
    editManifest(
      dir,
      (m) => void m.tokens.push({ out: 'src/other.css', format: 'css', flags: ['--vibrancy=-2'] }),
    )
    const r = await runCheck(dir, 10)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('src/other.css')
    expect(r.detail).not.toContain('src/tokens.css')
  })

  it('fails a tokens profile that declares no output, rather than checking nothing', async () => {
    const dir = makeTree('tokens')
    editManifest(dir, (m) => void (m.tokens = []))
    expect((await runCheck(dir, 10)).status).toBe('fail')
  })
})

describe('check 11: budgets, ejects, weakened config, DESIGN.md', () => {
  const healthy = (
    profile: 'app' | 'bridge' = 'app',
    files: Record<string, string | null> = {},
  ): string => {
    const dir = makeTree(profile, files)
    commitTree(dir)
    return dir
  }

  it('passes on a healthy tree', async () => {
    expect((await runCheck(healthy(), 11)).status).toBe('pass')
  })

  it('fails when a waiver count is above the budget', async () => {
    const dir = healthy('app', {
      'src/page.tsx':
        '// oxlint-disable-next-line basalt/colour-literal -- why\nexport const a = 1\n',
    })
    const r = await runCheck(dir, 11)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('1 waivers is above the ceiling 0')
  })

  it('fails when escapes pass the ceiling', async () => {
    const source = 'export const a = [col.custom, col.custom, chart.custom, field.custom]\n'
    const r = await runCheck(healthy('app', { 'src/page.tsx': source }), 11)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('4 escapes is above the ceiling 3')
  })

  it('fails when .basalt/budget.json is missing', async () => {
    const r = await runCheck(healthy('app', { '.basalt/budget.json': null }), 11)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('budget.json')
  })

  // A real eject passing every row, and one failure per row: tests/cli/sync-matrix/doctor/.
  it('fails when an ejected file is missing', async () => {
    const dir = healthy()
    const row = {
      path: 'src/ui/button.tsx',
      fromVersion: '2.29.0',
      seedDigest: 'abc',
      reason: 'dense',
      origin: 'seed',
    }
    editManifest(dir, (m) => void (m.ejected['src#button'] = row))
    const broken = await runCheck(dir, 11)
    expect(broken.status).toBe('fail')
    expect(broken.detail).toContain('ejected src/ui/button.tsx is missing')
  })

  it('fails when a root holds more ejects than the ceiling', async () => {
    const dir = healthy()
    editManifest(dir, (m) => {
      for (const name of ['a', 'b', 'c', 'd']) {
        m.ejected[`src#${name}`] = {
          path: `src/${name}.tsx`,
          fromVersion: '2.29.0',
          seedDigest: null,
          reason: 'r',
          origin: 'local',
        }
      }
    })
    const r = await runCheck(dir, 11)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('4 ejects is above the ceiling 3')
  })

  it('fails when the weakened-config check finds the seeded offender dead', async () => {
    const r = await runCheck(healthy(), 11, { ...HEALTHY, runLint: () => [] })
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('weakened-config 1 seeded-offender')
  })

  it('fails when .oxlintrc.json no longer extends the preset', async () => {
    const r = await runCheck(healthy('app', { '.oxlintrc.json': '{}' }), 11)
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('weakened-config 2 extends')
  })

  it('is SKIPPED, and so fails, when a weakened check cannot run (no base ref)', async () => {
    const r = await runCheck(healthy(), 11, { ...HEALTHY, baseRef: null })
    expect(r.status).toBe('skipped')
    expect(r.detail).toContain('budget-ratchet')
  })

  it('fails a DESIGN.md that is missing, too long, holds a hex or names Mantine', async () => {
    expect((await runCheck(healthy('app', { 'DESIGN.md': null }), 11)).detail).toContain(
      'DESIGN.md is missing',
    )
    const long = `${'line\n'.repeat(151)}`
    expect((await runCheck(healthy('app', { 'DESIGN.md': long }), 11)).detail).toContain(
      '151 lines',
    )
    expect(
      (await runCheck(healthy('app', { 'DESIGN.md': 'accent #0077bd\n' }), 11)).detail,
    ).toContain('hex literal')
    expect(
      (await runCheck(healthy('app', { 'DESIGN.md': 'built on Mantine\n' }), 11)).detail,
    ).toContain('Mantine')
  })

  it('fails a deviation without a reason and passes one that carries it', async () => {
    const section = (line: string): string => `# D\n\n## Deviations\n\n${line}\n`
    const bare = await runCheck(
      healthy('app', { 'DESIGN.md': section('- radius capped at 2') }),
      11,
    )
    expect(bare.status).toBe('fail')
    expect(bare.detail).toContain('deviation without a reason')
    const reasoned = await runCheck(
      healthy('app', { 'DESIGN.md': section('- radius capped at 2 — the dense table') }),
      11,
    )
    expect(reasoned.status).toBe('pass')
  })
})
