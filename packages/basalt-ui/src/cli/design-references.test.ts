/** Drift guard for the `basalt-design` router: its references exist, are linked, and name only real exports. */
import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const SKILL_DIR = resolve(import.meta.dir, '../../agent/skills/basalt-design')
const SRC = resolve(import.meta.dir, '..')
const LLMS = resolve(import.meta.dir, '../../llms.txt')
const REFERENCES = ['concept', 'catalogue', 'stat-tile', 'encoding-rules', 'anti-defaults']
const NOT_SHIPPED_HEADING = '## Not shipped'

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return markdownFiles(path)
    return path.endsWith('.md') ? [path] : []
  })
}

/** Every name a barrel (`index.ts` under src) exports, plus every `Signature:` in llms.txt. */
function exportedNames(): Set<string> {
  const names = new Set<string>()
  const barrels = readdirSync(SRC, { recursive: true, encoding: 'utf8' }).filter(
    (f) => /(^|\/)index\.ts$/.test(f) && !f.includes('cli/'),
  )
  for (const file of barrels) {
    const text = readFileSync(join(SRC, file), 'utf8')
    for (const block of text.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
      for (const part of (block[1] ?? '').split(',')) {
        const alias = part
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/)
          .pop()
        if (alias) names.add(alias.trim())
      }
    }
    for (const m of text.matchAll(
      /export\s+(?:declare\s+)?(?:function|const|class|type)\s+(\w+)/g,
    )) {
      names.add(m[1] as string)
    }
  }
  for (const m of readFileSync(LLMS, 'utf8').matchAll(/^Signature: (\w+)/gm))
    names.add(m[1] as string)
  return names
}

/** Backticked identifiers that look like a component or export (PascalCase, optionally `<…>`-free). */
function pascalIdentifiers(text: string): string[] {
  return [...text.matchAll(/`([A-Z][a-z0-9][A-Za-z0-9]*)(?:\s[^`]*)?`/g)].map((m) => m[1] as string)
}

describe('basalt-design references', () => {
  const skill = readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8')

  it('ships exactly the five reference files', () => {
    const dir = join(SKILL_DIR, 'references')
    expect(existsSync(dir)).toBe(true)
    expect(readdirSync(dir).toSorted()).toEqual(REFERENCES.map((r) => `${r}.md`).toSorted())
  })

  it('links every reference from SKILL.md and stays a router', () => {
    for (const ref of REFERENCES) expect(skill).toContain(`references/${ref}.md`)
    expect(skill.split('\n').length).toBeLessThanOrEqual(60)
  })

  it('makes the concept doc gating', () => {
    expect(skill).toContain('Nothing is built before the concept exists')
    expect(skill).toContain('docs/design/<screen>.md')
  })

  it('names the review mechanics exactly', () => {
    for (const phrase of ['basalt-ui shot detect', 'DEGRADED', 'data-shot-absent="empty error"']) {
      expect(skill).toContain(phrase)
    }
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
