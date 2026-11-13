/**
 * sk-6: the thin `basalt-design` skill. The thin-skill spike's kill rule fired (2 removed against a
 * bar of 3), so the skill is cut to method only: one SKILL.md that links the generated docs plus
 * the anti-defaults reference; every other 2.x reference is gone. A tell a rule guards names its tag.
 */
import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const pkgRoot = join(import.meta.dirname, '..', '..')
const dir = join(pkgRoot, 'agent/skills/basalt-design')
const read = (p: string): string => readFileSync(join(dir, p), 'utf8')

function files(d: string): string[] {
  return readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(d, e.name)) : [join(d, e.name)],
  )
}

describe('sk-6 thin basalt-design skill', () => {
  const skill = read('SKILL.md')

  test('SKILL.md has frontmatter name and description', () => {
    expect(skill).toMatch(/^---\nname: basalt-design\ndescription: .+\n/)
  })

  test('SKILL.md carries no code block, props table or interface', () => {
    expect(skill).not.toContain('```')
    expect(skill).not.toMatch(/^\s*\|.*\|/m)
    expect(skill).not.toMatch(/\binterface\b/)
  })

  test('every export a doc link names resolves to a generated doc', () => {
    const links = [...skill.matchAll(/\]\(docs\/([\w-]+\.md)\)/g)].map((m) => m[1] as string)
    expect(links.length).toBeGreaterThan(0)
    for (const name of links) expect(existsSync(join(pkgRoot, 'docs', name))).toBe(true)
  })

  test('only SKILL.md and anti-defaults.md remain; the 2.x references are folded away', () => {
    const rel = files(dir)
      .map((f) => f.slice(dir.length + 1))
      .sort()
    expect(rel).toEqual(['SKILL.md', 'references/anti-defaults.md'])
  })

  test('no file mentions Mantine, a hex literal, or "never a fill"', () => {
    for (const f of files(dir)) {
      const text = readFileSync(f, 'utf8')
      expect(text).not.toMatch(/mantine/i)
      expect(text).not.toMatch(/#[0-9a-f]{3,8}\b/i)
      expect(text).not.toMatch(/never a fill/i)
    }
  })

  test('anti-defaults states the v3 doctrine and every tag it names exists in a rule', () => {
    const text = read('references/anti-defaults.md')
    expect(text).toMatch(/tinted delta badge/)
    expect(text).toMatch(/[Ss]entence-case sans/)
    expect(text).toMatch(/ink-inverted primary/)
    expect(text).toMatch(/hue on every card/i)
    const rules = readdirSync(join(pkgRoot, 'agent/rules'))
      .map((f) => readFileSync(join(pkgRoot, 'agent/rules', f), 'utf8'))
      .join('\n')
    for (const m of text.matchAll(/\[(lint|type):([\w$-]+)\]/g)) {
      expect(rules).toContain(m[0])
    }
  })
})
