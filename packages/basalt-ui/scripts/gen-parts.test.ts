import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { readShards } from './export-surface-shards.mjs'
import { DOCS_DIR, PARTS_FILE, generateParts, readParts } from './gen-parts'

const PKG = join(import.meta.dirname, '..')
const SKILLS_DIR = join(PKG, 'agent/skills')

/** Published PascalCase value exports that are neither a part nor named by a skill, with the reason. */
export const NOT_PARTS: ReadonlyMap<string, string> = new Map([
  ['Form', 'the form element `useAppForm` hands back as `form.Form`, taught in forms.md'],
])

const PASCAL = /^[A-Z][A-Za-z0-9]*$/
const ALL_CAPS = /^[A-Z][A-Z0-9]*$/

/** True when `text` names `name` in backticks: `Name`, `Name.Root`, `<Name …`. */
function namedIn(text: string, name: string): boolean {
  return new RegExp(`\`<?${name}(?![A-Za-z0-9_])`).test(text)
}

/**
 * The PascalCase value exports that no part, skill text or sub-part names. A name is covered when
 * it is in the allowlist, starts with a part's name (a sub-part such as DialogContent under Dialog),
 * or is backticked in one of the texts. ALL_CAPS constants are not parts and are skipped.
 */
export function findUncoveredExports(input: {
  exports: readonly string[]
  partNames: readonly string[]
  texts: readonly string[]
  notParts: ReadonlyMap<string, string>
}): string[] {
  const names = new Set(input.exports.filter((n) => PASCAL.test(n) && !ALL_CAPS.test(n)))
  return [...names]
    .filter((name) => !input.notParts.has(name))
    .filter((name) => !input.partNames.some((part) => name.startsWith(part)))
    .filter((name) => !input.texts.some((text) => namedIn(text, name)))
    .toSorted()
}

/** The site profile's subpaths carry their own agent set (the static and astro skills), not this index. */
const SITE_SHARDS: ReadonlySet<string> = new Set(['./static', './astro'])

function valueExports(): string[] {
  return Object.entries(readShards(join(PKG, 'scripts/export-surface')) as Record<string, string[]>)
    .filter(([subpath]) => !SITE_SHARDS.has(subpath))
    .flatMap(([, names]) => names)
}

function skillTexts(root: string): string[] {
  return (readdirSync(root, { recursive: true }) as string[])
    .map((rel) => join(root, rel))
    .filter((path) => statSync(path).isFile())
    .map((path) => readFileSync(path, 'utf8'))
}

describe('gen-parts', () => {
  test('committed parts.md equals the generated text', () => {
    const generated = generateParts()
    expect(readFileSync(PARTS_FILE, 'utf8')).toBe(generated)
  })

  test('a part whose subpath has no question throws, naming the subpath', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gen-parts-'))
    try {
      writeFileSync(
        join(dir, 'widget.md'),
        "---\nname: Widget\nuse when: 'a figure'\nsubpath: basalt-ui/nope\n---\n",
      )
      expect(() => readParts(dir)).toThrow('basalt-ui/nope')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('every PascalCase value export is named, a sub-part, or allowlisted', () => {
    const uncovered = findUncoveredExports({
      exports: valueExports(),
      // A primitive's line lists its module's parts, so each listed name covers its sub-parts too.
      partNames: [
        ...readParts(DOCS_DIR).map((p) => p.name),
        ...[...readFileSync(PARTS_FILE, 'utf8').matchAll(/`([A-Z][A-Za-z0-9]*)`/g)].map(
          (m) => m[1] as string,
        ),
      ],
      texts: [readFileSync(PARTS_FILE, 'utf8'), ...skillTexts(SKILLS_DIR)],
      notParts: NOT_PARTS,
    })
    expect(uncovered).toEqual([])
  })

  test('coverage fails on a seeded export that no text names', () => {
    const uncovered = findUncoveredExports({
      exports: ['ZzSeededWidget', 'Card', 'CARD_KIND'],
      partNames: ['Card'],
      texts: ['A part: `Card` (`basalt-ui/cards`).'],
      notParts: NOT_PARTS,
    })
    expect(uncovered).toEqual(['ZzSeededWidget'])
  })
})
