import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FRONTMATTER_KEYS } from './docs-format'
import {
  CONTRACTS_FILE,
  DENY,
  checkUi,
  fixtureRoots,
  generate,
  REAL_ROOTS,
  SLOTS_FILE,
  writeUi,
} from './gen-ui'

const scratch: string[] = []

afterAll(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true })
})

/** A throwaway package with one `src/ui/<name>.tsx` per entry and an empty `docs/`. */
function fixture(modules: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'gen-ui-'))
  scratch.push(dir)
  mkdirSync(join(dir, 'src', 'ui'), { recursive: true })
  mkdirSync(join(dir, 'docs'), { recursive: true })
  writeFileSync(join(dir, 'package.json'), '{ "name": "basalt-ui" }\n')
  for (const [name, text] of Object.entries(modules)) {
    writeFileSync(join(dir, 'src', 'ui', `${name}.tsx`), text)
  }
  return dir
}

const WIDGET = `import { cva } from 'class-variance-authority'

export const widgetVariants = cva('base', {
  variants: {
    size: { md: 'h-8', sm: 'h-6' },
  },
  defaultVariants: { size: 'md' },
})

export const widgetParts = ['widget'] as const

/** A widget. */
export function Widget() {
  return null
}
`

const TWO_TABLES = `import { cva } from 'class-variance-authority'

export const knobVariants = cva('base', {
  variants: { tone: { plain: '', loud: 'font-bold' } },
})

export const knobHandleVariants = cva('base', {
  variants: { size: { md: 'h-8' } },
  defaultVariants: { size: 'md' },
})

export const knobParts = ['knob', 'knob-handle'] as const
`

const runCli = (dir: string, ...args: string[]) =>
  Bun.spawnSync(['bun', join(import.meta.dirname, 'gen-ui.ts'), ...args, '--root', dir], {
    stderr: 'pipe',
    stdout: 'pipe',
  })

type Contract = {
  module: string
  part: string
  pattern: string
  allow: string[]
  deny: string[]
  message: string
}

const contractsOf = (files: Map<string, string>): Contract[] =>
  (JSON.parse(files.get(CONTRACTS_FILE)!) as { contracts: Contract[] }).contracts

describe('the real tree', () => {
  test('is in sync with src/ui', () => {
    expect(checkUi(REAL_ROOTS)).toEqual([])
  })

  const contracts = contractsOf(generate(REAL_ROOTS))

  test('every contract denies height and display, never width, and carries an allow', () => {
    expect(contracts.length).toBeGreaterThan(0)
    for (const c of contracts) {
      expect(c.deny).toEqual(DENY)
      expect(c.deny).toEqual([
        'h-*',
        'min-h-*',
        'size-*',
        'hidden',
        'flex',
        'block',
        'grid',
        'inline-flex',
      ])
      expect(c.deny.some((d) => /(^|-)w-/.test(d))).toBe(false)
      expect(c.allow.length).toBeGreaterThan(0)
      expect(c.pattern).toMatch(/^\^[A-Z]\w*\$$/)
    }
  })

  test('the button and input messages name size, then eject', () => {
    for (const part of ['button', 'input']) {
      const message = contracts.find((c) => c.part === part)!.message
      expect(message).toContain('size')
      expect(message.indexOf('size')).toBeLessThan(message.indexOf('eject'))
    }
  })

  test('docs carry the six frontmatter keys in order', () => {
    const files = generate(REAL_ROOTS)
    for (const doc of ['docs/button.md', 'docs/input.md']) {
      const frontmatter = files.get(doc)!.split('---\n')[1]!
      const keys = frontmatter
        .trim()
        .split('\n')
        .map((line) => line.slice(0, line.indexOf(':')))
      expect(keys).toEqual([...FRONTMATTER_KEYS])
    }
    expect(files.get('docs/button.md')).toContain('subpath: basalt-ui/ui/button\n')
    expect(files.get('docs/button.md')).toContain('slots: [button, pressable]\n')
  })
})

describe('a fixture package', () => {
  test('drift in a cva table fails --check until it is regenerated', () => {
    const dir = fixture({ widget: WIDGET })
    expect(runCli(dir).exitCode).toBe(0)
    expect(runCli(dir, '--check').exitCode).toBe(0)

    const file = join(dir, 'src', 'ui', 'widget.tsx')
    writeFileSync(file, readFileSync(file, 'utf8').replace("sm: 'h-6'", "sm: 'h-6', lg: 'h-10'"))
    const drifted = runCli(dir, '--check')
    expect(drifted.exitCode).toBe(1)
    expect(drifted.stderr.toString()).toContain('run: bun packages/basalt-ui/scripts/gen-ui.ts')

    expect(runCli(dir).exitCode).toBe(0)
    expect(runCli(dir, '--check').exitCode).toBe(0)
    expect(readFileSync(join(dir, 'docs', 'widget.md'), 'utf8')).toContain('`lg`')
  })

  test('a two-table module yields two contracts, paired by kebab name', () => {
    const files = generate(fixtureRoots(fixture({ knob: TWO_TABLES })))
    const contracts = contractsOf(files)
    expect(contracts.map((c) => [c.part, c.pattern])).toEqual([
      ['knob', '^Knob$'],
      ['knob-handle', '^KnobHandle$'],
    ])
    expect(contracts[0]!.message).toBe(
      'Knob owns its height and display: eject it (basalt-ui eject knob) to change them.',
    )
    expect(contracts[1]!.message).toBe(
      'KnobHandle owns its height and display: use size (md), or eject it (basalt-ui eject knob).',
    )
    expect(files.get(SLOTS_FILE)).toContain("  knob: ['knob', 'knob-handle'],\n")
  })

  test('a spread or computed cva table is a hard error naming module, export and line', () => {
    const spread = WIDGET.replace(
      "variants: {\n    size: { md: 'h-8', sm: 'h-6' },",
      'variants: {\n    ...base,',
    )
    expect(() => generate(fixtureRoots(fixture({ widget: spread })))).toThrow(
      /src\/ui\/widget\.tsx:5: widgetVariants variants has a spread/,
    )
    const computed = WIDGET.replace("md: 'h-8'", "[key]: 'h-8'")
    expect(() => generate(fixtureRoots(fixture({ widget: computed })))).toThrow(
      /src\/ui\/widget\.tsx:5: widgetVariants variants\.size has a spread, computed/,
    )
  })

  test('a table whose part is not listed is a hard error', () => {
    const text = WIDGET.replace("['widget']", "['other']")
    expect(() => generate(fixtureRoots(fixture({ widget: text })))).toThrow(
      'src/ui/widget.tsx: widgetVariants pairs with part "widget", which widgetParts does not list',
    )
  })

  test('a module without Parts is a hard error', () => {
    const text = WIDGET.replace("export const widgetParts = ['widget'] as const\n", '')
    expect(() => generate(fixtureRoots(fixture({ widget: text })))).toThrow(
      'src/ui/widget.tsx: module widget exports no widgetParts',
    )
  })

  test('a hand-written doc is never overwritten, and an orphaned generated doc is removed', () => {
    const dir = fixture({ widget: WIDGET })
    writeFileSync(join(dir, 'docs', 'widget.md'), '# Widget guide\n')
    expect(checkUi(fixtureRoots(dir))).toContain(
      'docs/widget.md exists and is not generated; rename it',
    )
    writeUi(fixtureRoots(dir))
    expect(readFileSync(join(dir, 'docs', 'widget.md'), 'utf8')).toBe('# Widget guide\n')

    const gone = '---\nname: Gone\nsubpath: basalt-ui/ui/gone\n---\n'
    writeFileSync(join(dir, 'docs', 'gone.md'), gone)
    expect(checkUi(fixtureRoots(dir)).some((f) => f.startsWith('docs/gone.md'))).toBe(true)
    expect(writeUi(fixtureRoots(dir))).toContain('docs/gone.md')
  })
})
