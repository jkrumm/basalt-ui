import { afterAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { checkTokens } from './check-tokens'

const dir = mkdtempSync(join(tmpdir(), 'check-tokens-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

function file(name: string, text: string): string {
  const path = join(dir, name)
  writeFileSync(path, text)
  return path
}

describe('checkTokens', () => {
  it('passes package names, the bg-(--vx-*) spelling and templates', () => {
    const f = file('a.tsx', 'x = "bg-(--vx-brand-fill) text-(--vx-ink)"; `--vx-chart-${n}`')
    expect(checkTokens({ files: [f] }).exitCode).toBe(0)
  })

  it('passes an extra name only when declared', () => {
    const f = file('b.css', '.a { color: var(--vx-usage-hrv); }')
    expect(checkTokens({ files: [f] }).exitCode).toBe(1)
    expect(checkTokens({ files: [f], extraNames: ['--vx-usage-hrv'] }).exitCode).toBe(0)
  })

  it('fails --vx-usage-x and bg-(--vx-typo), naming file and line', () => {
    const f = file('c.mdx', 'ok\n--vx-usage-x\nbg-(--vx-typo)')
    const r = checkTokens({ files: [f], extraNames: ['--vx-usage-hrv'] })
    expect(r.exitCode).toBe(1)
    expect(r.findings.map((x) => [x.line, x.name])).toEqual([
      [2, '--vx-usage-x'],
      [3, '--vx-typo'],
    ])
  })

  it('fails when no file is scanned', () => {
    expect(checkTokens({ files: [] }).exitCode).toBe(1)
    expect(checkTokens({ files: [file('d.txt', '--vx-brand')] }).exitCode).toBe(1)
  })
})
