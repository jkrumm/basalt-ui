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
  it('passes package names, the bg-(--basalt-*) spelling and templates', () => {
    const f = file(
      'a.tsx',
      'x = "bg-(--basalt-brand-fill) text-(--basalt-ink)"; `--basalt-chart-${n}`',
    )
    expect(checkTokens({ files: [f] }).exitCode).toBe(0)
  })

  it('passes an extra name only when declared', () => {
    const f = file('b.css', '.a { color: var(--basalt-usage-hrv); }')
    expect(checkTokens({ files: [f] }).exitCode).toBe(1)
    expect(checkTokens({ files: [f], extraNames: ['--basalt-usage-hrv'] }).exitCode).toBe(0)
  })

  it('fails --basalt-usage-x and bg-(--basalt-typo), naming file and line', () => {
    const f = file('c.mdx', 'ok\n--basalt-usage-x\nbg-(--basalt-typo)')
    const r = checkTokens({ files: [f], extraNames: ['--basalt-usage-hrv'] })
    expect(r.exitCode).toBe(1)
    expect(r.findings.map((x) => [x.line, x.name])).toEqual([
      [2, '--basalt-usage-x'],
      [3, '--basalt-typo'],
    ])
  })

  it('names the nearest token for a typo, and none for a stranger', () => {
    const f = file(
      'e.css',
      '.a { color: var(--basalt-ink-mutd); }\n.b { color: var(--basalt-qqqqqqqqqqqq); }',
    )
    const [typo, stranger] = checkTokens({ files: [f] }).findings
    expect(typo?.nearest).toBe('--basalt-ink-muted')
    expect(stranger?.nearest).toBeUndefined()
    expect(nearestToken('--basalt-ink2', ['--basalt-ink', '--basalt-ink-muted'])).toBe(
      '--basalt-ink',
    )
  })

  it('keeps the nearest name within the kind the unknown name asks for', () => {
    const known = packageTokenNames()
    // a colour role is never a type size, a spacing name gets a spacing token
    expect(nearestToken('--basalt-text-muted', known)).toBe('--basalt-ink-muted')
    expect(nearestToken('--basalt-space-1', known)).toBe('--basalt-rhythm-1')
    expect(nearestToken('--basalt-brand-500', known)).toBe('--basalt-brand')
    expect(nearestToken('--basalt-text-mdd', known)).toBe('--basalt-text-md')
    expect(nearestToken('--basalt-warning', known)).toBe('--basalt-warn')
    expect(nearestToken('--basalt-color-brand', known)).toBe('--basalt-brand')
    expect(nearestToken('--basalt-qqqqqqqqqqqq', known)).toBeUndefined()
    // lint-4.16: a scale step keeps the family prefix, camelCase folds, a shadcn role maps to its token
    expect(nearestToken('--vx-radius-lg', known)).toMatch(/^--vx-radius-/)
    expect(nearestToken('--vx-surfaceRaised', known)).toBe('--vx-raised')
    expect(nearestToken('--vx-accent', known)).toBe('--vx-hover')
    expect(nearestToken('--vx-background', known)).toBe('--vx-canvas')
    expect(nearestToken('--vx-foreground', known)).toBe('--vx-ink')
    expect(nearestToken('--vx-border', known)).toBe('--vx-hairline')
    // lint-6.15: bold is strong, shadcn's *-foreground is an ink or on-* token
    expect(nearestToken('--vx-weight-bold', known)).toBe('--vx-weight-strong')
    expect(nearestToken('--vx-accent-foreground', known)).toBe('--vx-on-brand')
    expect(nearestToken('--vx-primary-foreground', known)).toBe('--vx-canvas')
    expect(nearestToken('--vx-muted-foreground', known)).toBe('--vx-ink-muted')
    // the suggestion reaches the finding
    const f = file('k.css', '.a { color: var(--basalt-text-muted); }')
    expect(checkTokens({ files: [f] }).findings[0]?.nearest).toBe('--basalt-ink-muted')
  })

  it('fails when no file is scanned', () => {
    expect(checkTokens({ files: [] }).exitCode).toBe(1)
    expect(checkTokens({ files: [file('d.txt', '--basalt-brand')] }).exitCode).toBe(1)
  })
})
