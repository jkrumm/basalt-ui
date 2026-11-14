/**
 * sk-8: the thin `basalt-app` skill, its `migrate` reference and the recipes index. Proves the
 * skill's size, its links, that every command and flag it names exists in the CLI, that no
 * download-and-run form of the bin is taught, and that `references/recipes.md` lists every file in
 * `docs/recipes/`.
 */
import { describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { COMMAND_OPTIONS, unknownFlag } from '../../src/cli/help'
import { run } from '../../src/cli/index'

const pkgRoot = join(import.meta.dirname, '..', '..')
const skillDir = join(pkgRoot, 'agent/skills/basalt-app')
const read = (p: string): string => readFileSync(p, 'utf8')
const skill = read(join(skillDir, 'SKILL.md'))
const migrateRef = read(join(skillDir, 'references/migrate.md'))
const recipesRef = read(join(skillDir, 'references/recipes.md'))
const owned = {
  'SKILL.md': skill,
  'references/migrate.md': migrateRef,
  'references/recipes.md': recipesRef,
}

/** The recipe files `index` fails to link, as `docs/recipes/<name>.md`. */
export function unlistedRecipes(index: string, files: readonly string[]): string[] {
  return files.filter((f) => !index.includes(`](docs/recipes/${f})`))
}

const recipeFiles = (): string[] =>
  readdirSync(join(pkgRoot, 'docs/recipes')).filter((f) => f.endsWith('.md'))

describe('sk-8 SKILL.md shape', () => {
  test('at most 150 lines, with frontmatter name and description', () => {
    expect(skill.trimEnd().split('\n').length).toBeLessThanOrEqual(150)
    expect(skill).toMatch(/^---\nname: basalt-app\ndescription: .+\n/)
  })

  test('every relative link resolves to an existing file', () => {
    for (const [name, text] of Object.entries(owned)) {
      const links = [...text.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1] as string)
      for (const link of links) {
        if (/^(https?:|#|mailto:)/.test(link)) continue
        const target = link.split('#')[0] as string
        const found = [join(skillDir, target), join(pkgRoot, target)].some((p) => existsSync(p))
        expect({ name, link, found }).toEqual({ name, link, found: true })
      }
    }
  })

  test('links the references that exist and none that do not', () => {
    for (const ref of ['migrate', 'recipes', 'live', 'testing', 'performance']) {
      expect(skill).toContain(`](references/${ref}.md)`)
    }
    const files = readdirSync(join(skillDir, 'references')).toSorted()
    expect(files).toEqual(['live.md', 'migrate.md', 'performance.md', 'recipes.md', 'testing.md'])
  })

  test('no download-and-run form of the bin is taught', () => {
    for (const text of Object.values(owned)) expect(text).not.toMatch(/bunx\s+basalt-ui/)
  })
})

describe('sk-8 migrate reference', () => {
  test('names the four shapes, the --check command and the worklist rule', () => {
    for (const shape of [
      'In-place PR',
      'One-PR cutover',
      'Sibling app',
      'In-document coexistence',
    ]) {
      expect(migrateRef).toContain(shape)
    }
    expect(migrateRef).toMatch(/basalt-ui migrate --from <version> --profile <profile> --check/)
    expect(migrateRef).toMatch(/worklist, never an exemption/)
    expect(migrateRef).toContain('valueShifts')
    expect(migrateRef).toMatch(/storage/i)
  })
})

describe('sk-8 recipes index', () => {
  test('lists every docs/recipes file', () => {
    const files = recipeFiles()
    expect(files.length).toBeGreaterThan(0)
    expect(unlistedRecipes(recipesRef, files)).toEqual([])
  })

  test('fails when a recipe file is missing from the index', () => {
    expect(unlistedRecipes(recipesRef, [...recipeFiles(), 'invented.md'])).toEqual(['invented.md'])
    expect(unlistedRecipes('', ['board.md'])).toEqual(['board.md'])
  })

  test('each line names its use-when from the recipe front matter', () => {
    for (const f of recipeFiles()) {
      const useWhen = /^use-when: (.+)$/m.exec(read(join(pkgRoot, 'docs/recipes', f)))?.[1]
      expect(recipesRef).toContain(useWhen as string)
    }
  })
})

/** What `run` prints for one argv in an empty dir (no verb here mutates with these arguments). */
function probe(argv: string[]): { code: number; out: string } {
  const dir = mkdtempSync(join(tmpdir(), 'basalt-sk8-'))
  const log = console.log
  const err = console.error
  let out = ''
  console.log = (...a: unknown[]) => void (out += `${a.join(' ')}\n`)
  console.error = (...a: unknown[]) => void (out += `${a.join(' ')}\n`)
  try {
    const code = run(argv, dir)
    if (typeof code !== 'number') throw new TypeError('probe called an async verb')
    return { code, out }
  } finally {
    console.log = log
    console.error = err
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Every verb the dispatcher routes: the flag-schema verbs plus those it routes without one. */
function isVerb(verb: string): boolean {
  if (verb in COMMAND_OPTIONS) return true
  return !probe([verb]).out.includes('unknown command')
}

/** Flags `migrate` accepts, read from its own refusal line. */
const migrateFlags = (): string[] =>
  [
    ...(/Accepted: (.+)/.exec(probe(['migrate', '--sk8-bogus']).out)?.[1] ?? '').matchAll(
      /--[\w-]+/g,
    ),
  ].map((m) => m[0])

const flagsOf = (text: string): string[] =>
  [...text.matchAll(/(?<![\w-])--[a-z][\w-]*\w(?![\w*-])/g)].map((m) => m[0])

/** `verb` and its flags from a table row's first cell, and from every `basalt-ui <verb> …` span. */
function commandsIn(text: string): { verb: string; flags: string[] }[] {
  const found: { verb: string; flags: string[] }[] = []
  // Only the table whose header's first cell is "Verb"; the profile table's first column is not verbs.
  let inVerbTable = false
  const rows = text.split('\n').filter((l) => {
    if (!l.startsWith('|')) inVerbTable = false
    else if (/^\|\s*Verb\s*\|/.test(l)) inVerbTable = true
    return inVerbTable && l.startsWith('| `')
  })
  for (const row of rows) {
    const verbs = [...(row.split('|')[1] ?? '').matchAll(/`([a-z][\w:-]*)`/g)].map(
      (m) => m[1] as string,
    )
    for (const verb of verbs) found.push({ verb, flags: flagsOf(row) })
  }
  for (const m of text.matchAll(
    /`(?:\.\/node_modules\/\.bin\/)?basalt-ui ([a-z][\w:-]*)([^`]*)`/g,
  )) {
    found.push({ verb: m[1] as string, flags: flagsOf(m[2] as string) })
  }
  return found
}

describe('sk-8 commands match the CLI', () => {
  test('every verb and flag the skill names is accepted by the CLI', () => {
    const cmds = [...commandsIn(skill), ...commandsIn(migrateRef)]
    expect(cmds.length).toBeGreaterThan(10)
    for (const { verb, flags } of cmds) {
      expect({ verb, known: isVerb(verb) }).toEqual({ verb, known: true })
      if (verb === 'migrate') {
        for (const flag of flags) expect(migrateFlags()).toContain(flag)
      } else if (verb in COMMAND_OPTIONS) {
        for (const flag of flags) {
          const takesValue = COMMAND_OPTIONS[verb]?.[flag.slice(2)]?.type === 'string'
          const bad = unknownFlag(verb, takesValue ? [flag, 'x'] : [flag])
          expect({ verb, flag, bad }).toEqual({ verb, flag, bad: null })
        }
      }
    }
  })

  test('a verb the CLI does not have is caught', () => {
    expect(isVerb('sk8-bogus')).toBe(false)
  })
})

describe('sk-8 prohibitions', () => {
  test('a bullet that forbids ends in a tag or sits under `not guarded:`', () => {
    const TAG = /(?:\[(?:lint|type):[\w$-]+\]\s*)+$/
    for (const [name, text] of Object.entries(owned)) {
      let notGuarded = false
      for (const line of text.split('\n')) {
        if (/^not guarded:\s*$/i.test(line)) notGuarded = true
        else if (line.startsWith('#')) notGuarded = false
        else if (/^[-*]\s/.test(line) && /\b(never|do not|don't)\b/i.test(line)) {
          expect({ name, line, ok: notGuarded || TAG.test(line.trim()) }).toEqual({
            name,
            line,
            ok: true,
          })
        }
      }
    }
  })
})
