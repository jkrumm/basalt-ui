/**
 * sk-7b: the state, forms and controls references. Each stays short, cites only generated docs
 * that exist, and names the contracts its row teaches (`state-persistence-forms` 5 and 9,
 * `controls-url-state` 4.3, 4.5, 4.8).
 */
import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const pkgRoot = join(import.meta.dirname, '..', '..')
const repoRoot = join(pkgRoot, '..', '..')
const refsDir = join(pkgRoot, 'agent/skills/basalt-design/references')
const NAMES = ['state', 'forms', 'controls'] as const
const text = (name: string): string => readFileSync(join(refsDir, `${name}.md`), 'utf8')

describe('sk-7b references', () => {
  test('each file is at most 70 lines with no code fence or table', () => {
    for (const name of NAMES) {
      const t = text(name)
      expect(t.trimEnd().split('\n').length).toBeLessThanOrEqual(70)
      expect(t).not.toContain('```')
      expect(t).not.toMatch(/^\s*\|/m)
    }
  })

  test('every cited docs/<export>.md exists', () => {
    for (const name of NAMES) {
      const cited = [...text(name).matchAll(/\(docs\/([\w/-]+\.md)\)|`docs\/([\w/-]+\.md)`/g)]
      expect(cited.length).toBeGreaterThan(0)
      for (const m of cited) {
        expect(existsSync(join(pkgRoot, 'docs', (m[1] ?? m[2]) as string))).toBe(true)
      }
    }
  })

  test('every cited playground region and file exists', () => {
    for (const name of NAMES) {
      for (const m of text(name).matchAll(/`(apps\/playground\/[^`]+)`/g)) {
        expect(existsSync(join(repoRoot, m[1] as string))).toBe(true)
      }
    }
  })

  test('forms names the validation delta and the leave guard', () => {
    const t = text('forms')
    for (const word of ['onDynamic', 'onDynamicAsync', 'useBlocker']) expect(t).toContain(word)
  })

  test('controls names its homes', () => {
    const t = text('controls')
    for (const word of ['ControlHome', 'FilterSet', 'ViewTabs']) expect(t).toContain(word)
  })

  test('state separates persisted, URL and external memory', () => {
    const t = text('state')
    for (const word of ['persisted', 'externalField', 'URL']) expect(t).toContain(word)
  })
})
