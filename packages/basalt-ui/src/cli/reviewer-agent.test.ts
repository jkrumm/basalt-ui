/** Structure of the shipped `basalt-design-reviewer` subagent — the checklist it scores by. */
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const FILE = resolve(import.meta.dir, '../../agent/agents/basalt-design-reviewer.md')
const text = readFileSync(FILE, 'utf8')

/** The numbered items under a `### <axis>` heading, up to the next heading. */
function items(axis: string): number[] {
  const section = text.split(`### ${axis}\n`)[1]?.split(/\n#{2,3} /)[0] ?? ''
  return [...section.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]))
}

describe('basalt-design-reviewer', () => {
  it('has frontmatter whose name is the file stem and read-only tools', () => {
    const front = text.split('---')[1] ?? ''
    expect(front).toContain('name: basalt-design-reviewer')
    expect(front).toContain('tools: Read, Grep, Glob')
    expect(front).toContain('model: inherit')
  })

  it('lists every rubric item in order', () => {
    expect(items('Craft')).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(items('Expression')).toEqual([1, 2, 3, 4, 5])
    expect(items('Communication')).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('cites only rubric items that exist', () => {
    const known: Record<string, number[]> = {
      Craft: items('Craft'),
      Expression: items('Expression'),
      Communication: items('Communication'),
    }
    const cited = [...text.matchAll(/\b(Craft|Expression|Communication) (\d+)\b/g)]
    expect(cited.length).toBeGreaterThan(0)
    for (const [whole, axis, n] of cited) {
      expect(known[axis!]).toContain(Number(n))
      expect(whole).toBeTruthy()
    }
  })

  it('makes the sheets and the Read line mandatory', () => {
    expect(text).toContain("Read every anchor's `sheet` and every `_page` shot")
    expect(text).toContain('`scaleError` set')
    expect(text).toContain('Read: <sheet file>')
  })

  it('carries the banned-filler list', () => {
    for (const phrase of [
      '"Here you can see…"',
      '"at a glance"',
      '"Overview"',
      '"N/A"',
      'emoji in chrome',
    ]) {
      expect(text).toContain(phrase)
    }
  })

  it('fails closed and fixes the output format', () => {
    expect(text).toContain('`unverified` counts as fail')
    expect(text).toContain('metrics.json unreadable')
    expect(text).toContain('| component | verdict | failed items |')
    expect(text).toContain(
      '<axis> <n> — <png file> (<scheme>, <viewport>, <state>) — <defect in one sentence>',
    )
  })

  it('orders the report content → layout → style and ranks every failure P0–P3', () => {
    const order = ['content', 'layout', 'style'].map((w) => text.indexOf(`**${w}**`))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    for (const sev of ['P0', 'P1', 'P2', 'P3']) expect(text).toContain(`**${sev}**`)
    expect(text).toContain(
      '<P0-P3> <axis> <n> — <png file> (<scheme>, <viewport>, <state>) — <defect in one sentence>',
    )
  })

  it('ends with a score line and points at `basalt-ui shot detect`', () => {
    expect(text).toContain('Score: <0-100>')
    expect(text).toContain('basalt-ui shot detect')
  })

  it('refuses to pass an inline review by the builder', () => {
    expect(text).toContain('isolated subagent')
    expect(text).toContain('DEGRADED: inline review by the builder')
    expect(text).toMatch(/FIRST line/)
    expect(text).toMatch(/cannot pass/)
  })

  it('cites the catalogue file, not the skill table', () => {
    expect(text).toContain('.claude/skills/basalt-design/references/catalogue.md')
    expect(text).not.toContain('encoding table (the catalogue) in the `/basalt-design` skill')
  })

  it('stays within ~100 lines', () => {
    expect(text.trimEnd().split('\n').length).toBeLessThanOrEqual(100)
  })
})
