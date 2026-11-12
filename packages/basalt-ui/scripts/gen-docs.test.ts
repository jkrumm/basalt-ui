import { afterAll, describe, expect, setDefaultTimeout, test } from 'bun:test'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  checkDocs,
  fixtureRoots,
  generate,
  kebab,
  readBaseline,
  REAL_ROOTS,
  writeDocs,
} from './gen-docs'

// Every check here compiles subpaths through the TypeScript API; the whole tree takes about 5.5 s on an
// idle host, which is over bun's 5 s default.
setDefaultTimeout(60_000)

const FIXTURES = join(import.meta.dirname, '..', 'tests', 'fixtures', 'gen-docs')
const scratch: string[] = []

/** A throwaway copy of one fixture package, with an empty `docs/`. */
function copyFixture(name: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'gen-docs-'))
  scratch.push(dir)
  cpSync(join(FIXTURES, name), dir, { recursive: true })
  mkdirSync(join(dir, 'docs'), { recursive: true })
  return dir
}

afterAll(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true })
})

const runCli = (dir: string, ...args: string[]) =>
  Bun.spawnSync(['bun', join(import.meta.dirname, 'gen-docs.ts'), ...args, '--root', dir], {
    stderr: 'pipe',
    stdout: 'pipe',
  })

describe('kebab', () => {
  test('names a doc file from an export name', () => {
    expect(kebab('StatCard')).toBe('stat-card')
    expect(kebab('createSearchStore')).toBe('create-search-store')
    expect(kebab('VX')).toBe('vx')
    expect(kebab('BasaltDataTable')).toBe('basalt-data-table')
  })
})

describe('a documented export', () => {
  const { docs, problems } = generate(fixtureRoots(join(FIXTURES, 'ok')))

  test('renders with the six frontmatter keys, the first paragraph and the slots', () => {
    expect(problems).toEqual([])
    const doc = docs.get('stat-card.md')!
    expect(doc.startsWith('---\nname: StatCard\n')).toBe(true)
    expect(doc).toContain("use when: 'a page shows a single number'\n")
    expect(doc).toContain("never when: 'the number needs a chart'\n")
    expect(doc).toContain('subpath: fixture-ui\n')
    expect(doc).toContain('peers: []\n')
    expect(doc).toContain('slots: [stat-card]\n')
    expect(doc).toContain('One metric with its label.')
  })

  test('carries the public signature, the first paragraph only, and no second subpath copy', () => {
    const doc = docs.get('create-counter.md')!
    expect(doc).toContain('subpath: fixture-ui\n')
    expect(doc).toContain('createCounter(options: { start?: number; step: number; }): () => number')
    expect(doc).not.toContain('second paragraph')
    expect([...docs.keys()].toSorted()).toEqual([
      'create-counter.md',
      'extras.md',
      'limit.md',
      'stat-card.md',
    ])
    expect(docs.get('extras.md')).toContain('subpath: fixture-ui/extras\n')
  })

  test('appends the example regions by export name and by kebab name, dedented', () => {
    expect(docs.get('stat-card.md')).toContain(
      "## Example\n\n`playground/demo.tsx`\n\n```tsx\nconst card = StatCard({ label: 'Visits', value: 3 })\nconst label = card.text\n```\n",
    )
    expect(docs.get('create-counter.md')).toContain('const next = createCounter({ step: 2 })')
    expect(docs.get('extras.md')).not.toContain('## Example')
  })

  test('prints a primitive constant as its type, not as a method list', () => {
    const doc = docs.get('limit.md')!
    expect(doc).toContain('LIMIT: 8')
    expect(doc).not.toContain('toFixed')
  })

  test('does not document a type, only value exports', () => {
    expect(docs.has('unrelated.md')).toBe(false)
  })
})

describe('an export without JSDoc', () => {
  const roots = fixtureRoots(join(FIXTURES, 'bare'))

  test('fails and names it; a partial JSDoc names what is missing', () => {
    const { problems, docs } = generate(roots)
    expect(problems).toContain('Bare: JSDoc is required (fixture-ui)')
    expect(problems).toContain('Half: JSDoc lacks @useWhen (fixture-ui)')
    expect(problems).toContain('Half: JSDoc lacks @neverWhen (fixture-ui)')
    expect(docs.size).toBe(0)
  })

  test('is a baseline entry when recorded, and a stale one once documented', () => {
    const dir = copyFixture('bare')
    expect(checkDocs(fixtureRoots(dir)).join('\n')).toContain('Bare: JSDoc is required')

    writeDocs(fixtureRoots(dir), true)
    expect(readBaseline(fixtureRoots(dir))).toEqual(['fixture-ui#Bare', 'fixture-ui#Half'])
    expect(checkDocs(fixtureRoots(dir))).toEqual([])

    writeFileSync(
      join(dir, 'src', 'index.ts'),
      `/**\n * Documented now.\n *\n * @useWhen a\n * @neverWhen b\n */\nexport const Bare = 1\n\n/** Only a summary. */\nexport const Half = 1\n`,
    )
    expect(checkDocs(fixtureRoots(dir)).join('\n')).toContain(
      'baseline entry fixture-ui#Bare is documented or gone',
    )
    writeDocs(fixtureRoots(dir))
    expect(readBaseline(fixtureRoots(dir))).toEqual(['fixture-ui#Half'])
    expect(existsSync(join(dir, 'docs', 'bare.md'))).toBe(true)
    expect(checkDocs(fixtureRoots(dir))).toEqual([])
  })
})

describe('a v3 export shadowing a baselined legacy root export', () => {
  test('takes the doc file; the legacy one stays undocumented and baselined', () => {
    const roots = fixtureRoots(join(FIXTURES, 'shadow'))
    const { docs, problems, undocumented } = generate(roots)
    expect(problems).toEqual([])
    expect(docs.get('legacy.md')).toContain('subpath: fixture-ui/v3\n')
    expect(undocumented).toEqual(['fixture-ui#Legacy'])
  })

  test('a plain run keeps the legacy baseline entry and --check is green', () => {
    const dir = copyFixture('shadow')
    writeDocs(fixtureRoots(dir))
    expect(readBaseline(fixtureRoots(dir))).toEqual(['fixture-ui#Legacy'])
    expect(checkDocs(fixtureRoots(dir))).toEqual([])
  })

  test('without the baseline entry the clash still fails', () => {
    const dir = copyFixture('shadow')
    writeFileSync(join(dir, 'gen-docs.baseline.json'), '[]\n')
    expect(checkDocs(fixtureRoots(dir)).join('\n')).toContain('docs/legacy.md is already taken')
  })
})

describe('--check', () => {
  test('is green after a write, and fails by file after one byte of a doc changes', () => {
    const dir = copyFixture('ok')
    const roots = fixtureRoots(dir)
    expect(runCli(dir, '--check').exitCode).toBe(1) // nothing written yet

    expect(runCli(dir).exitCode).toBe(0)
    expect(runCli(dir, '--check').exitCode).toBe(0)

    const doc = join(dir, 'docs', 'stat-card.md')
    writeFileSync(doc, `${readFileSync(doc, 'utf8')}x`)
    const run = runCli(dir, '--check')
    expect(run.exitCode).toBe(1)
    expect(run.stderr.toString()).toContain('docs/stat-card.md is out of sync')
    expect(checkDocs(roots)).toHaveLength(1)

    writeDocs(roots)
    expect(checkDocs(roots)).toEqual([])
  })

  test('fails when an example region changes, and on an orphaned generated doc', () => {
    const dir = copyFixture('ok')
    writeDocs(fixtureRoots(dir))
    const demo = join(dir, 'playground', 'demo.tsx')
    writeFileSync(demo, readFileSync(demo, 'utf8').replace('Visits', 'Views'))
    expect(checkDocs(fixtureRoots(dir)).join('\n')).toContain('docs/stat-card.md is out of sync')

    writeDocs(fixtureRoots(dir))
    const stale = join(dir, 'docs', 'gone.md')
    writeFileSync(
      stale,
      '---\nname: Gone\nuse when: x\nnever when: y\nsubpath: fixture-ui\npeers: []\nslots: []\n---\n\n# Gone\n',
    )
    expect(checkDocs(fixtureRoots(dir)).join('\n')).toContain(
      'docs/gone.md is generated for an export that is gone',
    )
    writeDocs(fixtureRoots(dir))
    expect(existsSync(stale)).toBe(false)
  })

  test('never overwrites a hand-written guide; the clash fails by name', () => {
    const dir = copyFixture('ok')
    const guide = join(dir, 'docs', 'stat-card.md')
    writeFileSync(guide, '# stat-card\n\nA guide.\n')
    writeDocs(fixtureRoots(dir))
    expect(readFileSync(guide, 'utf8')).toBe('# stat-card\n\nA guide.\n')
    expect(checkDocs(fixtureRoots(dir)).join('\n')).toContain(
      'stat-card.md exists and is not generated',
    )
  })
})

describe('the tree', () => {
  test('is in sync: every export is documented or in the baseline', () => {
    expect(checkDocs(REAL_ROOTS)).toEqual([])
  })
})
