import { afterAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { checkTokens, nearestToken, packageTokenNames } from './check-tokens'

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

  it('names the nearest token for a typo, and none for a stranger', () => {
    const f = file(
      'e.css',
      '.a { color: var(--vx-ink-mutd); }\n.b { color: var(--vx-qqqqqqqqqqqq); }',
    )
    const [typo, stranger] = checkTokens({ files: [f] }).findings
    expect(typo?.nearest).toBe('--vx-ink-muted')
    expect(stranger?.nearest).toBeUndefined()
    expect(nearestToken('--vx-ink2', ['--vx-ink', '--vx-ink-muted'])).toBe('--vx-ink')
  })

  it('keeps the nearest name within the kind the unknown name asks for', () => {
    const known = packageTokenNames()
    // a colour role is never a type size, a spacing name gets a spacing token
    expect(nearestToken('--vx-text-muted', known)).toBe('--vx-ink-muted')
    expect(nearestToken('--vx-space-1', known)).toBe('--vx-rhythm-1')
    expect(nearestToken('--vx-brand-500', known)).toBe('--vx-brand')
    expect(nearestToken('--vx-text-mdd', known)).toBe('--vx-text-md')
    expect(nearestToken('--vx-warning', known)).toBe('--vx-warn')
    expect(nearestToken('--vx-color-brand', known)).toBe('--vx-brand')
    expect(nearestToken('--vx-qqqqqqqqqqqq', known)).toBeUndefined()
    // lint-4.16: a scale step keeps the family prefix, camelCase folds, a shadcn role maps to its token
    expect(nearestToken('--vx-radius-lg', known)).toMatch(/^--vx-radius-/)
    expect(nearestToken('--vx-surfaceRaised', known)).toBe('--vx-raised')
    expect(nearestToken('--vx-accent', known)).toBe('--vx-hover')
    expect(nearestToken('--vx-background', known)).toBe('--vx-canvas')
    expect(nearestToken('--vx-foreground', known)).toBe('--vx-ink')
    expect(nearestToken('--vx-border', known)).toBe('--vx-hairline')
    // the suggestion reaches the finding
    const f = file('k.css', '.a { color: var(--vx-text-muted); }')
    expect(checkTokens({ files: [f] }).findings[0]?.nearest).toBe('--vx-ink-muted')
  })

  it('fails when no file is scanned', () => {
    expect(checkTokens({ files: [] }).exitCode).toBe(1)
    expect(checkTokens({ files: [file('d.txt', '--vx-brand')] }).exitCode).toBe(1)
  })
})
