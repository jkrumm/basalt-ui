/** Drift guard for the `basalt-design` router: its references exist, are linked, and name only real exports. */
import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { publicEntries } from '../../scripts/agent-layer-guards'

const SKILL_DIR = resolve(import.meta.dir, '../../agent/skills/basalt-design')
const REFERENCES = [
  'ai',
  'anti-defaults',
  'cards',
  'chart-color',
  'chart-form',
  'chart-honest',
  'chart-labels',
  'chart-view',
  'charts',
  'concept',
  'controls',
  'copy',
  'encoding',
  'forms',
  'motion',
  'parts',
  'state',
  'states',
  'table',
]
/** Reached through the `charts` router, not linked from SKILL.md itself. */
const VIA_ROUTER = new Set(['chart-form', 'chart-honest'])
const NOT_SHIPPED_HEADING = '## Not shipped'

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return markdownFiles(path)
    return path.endsWith('.md') ? [path] : []
  })
}

const exportedNames = (): Set<string> =>
  new Set([...publicEntries().values()].flatMap((s) => [...s]))

/** Backticked identifiers that look like a component or export (PascalCase, optionally `<…>`-free). */
function pascalIdentifiers(text: string): string[] {
  return [...text.matchAll(/`([A-Z][a-z0-9][A-Za-z0-9]*)(?:\s[^`]*)?`/g)].map((m) => m[1] as string)
}

describe('basalt-design references', () => {
  const skill = readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8')

  it('ships SKILL.md and the anti-defaults reference, linked from the skill', () => {
    const dir = join(SKILL_DIR, 'references')
    expect(readdirSync(dir).toSorted()).toEqual(REFERENCES.map((r) => `${r}.md`).toSorted())
    for (const ref of REFERENCES.filter((r) => !VIA_ROUTER.has(r)))
      expect(skill).toContain(`references/${ref}.md`)
    expect(skill.split('\n').length).toBeLessThanOrEqual(60)
  })

  it('exports every name from the public path written next to it', () => {
    const entries = publicEntries()
    const wrong: string[] = []
    for (const file of markdownFiles(SKILL_DIR)) {
      const text = readFileSync(file, 'utf8')
      for (const m of text.matchAll(
        /`([A-Z][a-z0-9][A-Za-z0-9]*)`\s*\(((?:`basalt-ui[^`]*`(?:,\s*)?)+)\)/g,
      )) {
        for (const path of (m[2] ?? '').matchAll(/`(basalt-ui[^`]*)`/g)) {
          if (!entries.get(path[1] as string)?.has(m[1] as string)) {
            wrong.push(
              `${file.slice(SKILL_DIR.length + 1)}: ${m[1]} is not exported from ${path[1]}`,
            )
          }
        }
      }
    }
    expect(wrong).toEqual([])
  })

  it('names only real exports (the not-shipped list excepted)', () => {
    const known = exportedNames()
    const stale: string[] = []
    for (const file of markdownFiles(SKILL_DIR)) {
      // The "Not shipped" section (to the next `## `) is the only place a not-yet-real name may appear.
      const text = readFileSync(file, 'utf8')
      const body = text.replace(new RegExp(`${NOT_SHIPPED_HEADING}[\\s\\S]*?(?=\\n## |$)`), '')
      for (const id of pascalIdentifiers(body)) {
        if (!known.has(id)) stale.push(`${file.slice(SKILL_DIR.length + 1)}: ${id}`)
      }
    }
    expect(stale).toEqual([])
  })
})
