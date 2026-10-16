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
    expect(items('Craft')).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(items('Expression')).toEqual([1, 2, 3, 4, 5])
    expect(items('Communication')).toEqual([1, 2, 3, 4, 5, 6])
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
})
