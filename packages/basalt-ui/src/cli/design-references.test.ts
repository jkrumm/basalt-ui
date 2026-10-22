/** Drift guard for the `basalt-design` router: its references exist, are linked, and name only real exports. */
import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const SKILL_DIR = resolve(import.meta.dir, '../../agent/skills/basalt-design')
const SRC = resolve(import.meta.dir, '..')
const REFERENCES = [
  'concept',
  'catalogue',
  'stat-tile',
  'encoding-rules',
  'anti-defaults',
  'states',
  'recipes',
]
const NOT_SHIPPED_HEADING = '## Not shipped'

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return markdownFiles(path)
    return path.endsWith('.md') ? [path] : []
  })
}

const PKG = resolve(import.meta.dir, '../..')

/** The source file behind a `package.json` export target (`./dist/charts/index.js` → `src/charts/index.ts`). */
function sourceOf(target: string): string | undefined {
  const base = join(PKG, target.replace(/^\.\/dist\//, 'src/').replace(/\.js$/, ''))
  return [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((f) => existsSync(f))
}

/** Names one source file exports, following `export * from './x'` one barrel deep. */
function namesIn(file: string, seen = new Set<string>()): Set<string> {
  const names = new Set<string>()
  if (seen.has(file)) return names
  seen.add(file)
  const text = readFileSync(file, 'utf8')
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
  for (const m of text.matchAll(/export\s+(?:declare\s+)?(?:function|const|class|type)\s+(\w+)/g)) {
    names.add(m[1] as string)
  }
  for (const m of text.matchAll(/export\s+\*\s+from\s+'(\.[^']+)'/g)) {
    const target = sourceOf(`./dist/${join(file.slice(SRC.length + 1), '..', m[1] as string)}.js`)
    if (target) for (const n of namesIn(target, seen)) names.add(n)
  }
  return names
}

/** Public entry specifier (`basalt-ui`, `basalt-ui/charts`) → the names it exports. */
function publicEntries(): Map<string, Set<string>> {
  const pkg = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8')) as {
    exports: Record<string, { import?: string }>
  }
  const entries = new Map<string, Set<string>>()
  for (const [sub, target] of Object.entries(pkg.exports)) {
    const file = target.import ? sourceOf(target.import) : undefined
    if (file) entries.set(sub === '.' ? 'basalt-ui' : `basalt-ui/${sub.slice(2)}`, namesIn(file))
  }
  return entries
}

const exportedNames = (): Set<string> =>
  new Set([...publicEntries().values()].flatMap((s) => [...s]))

/** Backticked identifiers that look like a component or export (PascalCase, optionally `<…>`-free). */
function pascalIdentifiers(text: string): string[] {
  return [...text.matchAll(/`([A-Z][a-z0-9][A-Za-z0-9]*)(?:\s[^`]*)?`/g)].map((m) => m[1] as string)
}

describe('basalt-design references', () => {
  const skill = readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8')

  it('ships exactly the seven reference files', () => {
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
