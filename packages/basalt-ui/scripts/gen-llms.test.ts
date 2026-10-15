import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { generateLlmsTxt, outPath } from './gen-llms'
import { MAX_PROP_TYPE, MAX_PROPS, propShapeLines } from './llms-signatures'

const text = generateLlmsTxt()
const surface = JSON.parse(
  readFileSync(join(import.meta.dir, 'export-surface.json'), 'utf8'),
) as Record<string, string[]>

/** The `Signature:` names listed under one `## basalt-ui/<sub>` heading. */
function signatureNames(subpath: string): string[] {
  const heading = subpath === '.' ? '## basalt-ui\n' : `## basalt-ui${subpath.slice(1)}\n`
  const section = text.split(heading)[1]?.split('\n\n')[0] ?? ''
  return section
    .split('\n')
    .filter((l) => l.startsWith('Signature: '))
    .map((l) => /^Signature: ([\w$]+)/.exec(l)?.[1] ?? '')
}

describe('gen-llms signatures', () => {
  test('every published value export of every JS subpath has exactly one signature line', () => {
    for (const [subpath, names] of Object.entries(surface)) {
      expect(signatureNames(subpath).toSorted(), subpath).toEqual(names.toSorted())
    }
  })

  test('signatures are one clipped line, with no destructured-parameter placeholders', () => {
    const lines = text.split('\n').filter((l) => l.startsWith('Signature: '))
    expect(lines.length).toBeGreaterThan(100)
    expect(lines.every((l) => l.length <= 'Signature: '.length + 170)).toBe(true)
    expect(text).not.toContain('__0')
  })

  test('reads real parameter and return types', () => {
    expect(text).toContain('Signature: alpha(token: string, a: number): string')
  })

  test('every subpath carries an indented props block for object-taking exports', () => {
    const block = (name: string): string[] => {
      const lines = text.split('\n')
      const at = lines.findIndex((l) => l.startsWith(`Signature: ${name}(`))
      if (at === -1) throw new Error(`no signature for ${name}`)
      const rest = lines.slice(at + 1)
      const end = rest.findIndex((l) => !l.startsWith('  '))
      return rest.slice(0, end === -1 ? rest.length : end)
    }
    const table = block('BasaltDataTable')
    expect(table).toContain('  data: T[]')
    expect(table).toContain('  striped?: boolean | "odd" | "even"')
    expect(table.at(-1)).toMatch(/^  … \+\d+ more$/)
    expect(block('Bars')).toContain('  ariaLabel: string')
    // Exactly the own props; nothing inherited from Mantine/DOM leaks in.
    expect(block('useBasaltForm')).toEqual([
      '  mode?: "controlled" | "uncontrolled"',
      '  schema?: StandardSchemaV1<unknown, Values>',
    ])
    // Subpaths beyond table/charts/forms get their props too (friction row 57).
    const aside = block('PageAside')
    expect(aside.some((l) => l.startsWith('  title: '))).toBe(true)
    expect(aside.some((l) => l.startsWith('  persistKey?: '))).toBe(true)
    expect(block('FilterSet').length).toBeGreaterThan(0)
  })

  test('the committed llms.txt is in sync', () => {
    expect(readFileSync(outPath, 'utf8')).toBe(text)
  })
})

describe('propShapeLines', () => {
  /** Type-checks one in-memory module and returns the first parameter type of its `f` export. */
  function firstParam(source: string) {
    const file = '/virtual/fixture.ts'
    const options: ts.CompilerOptions = { strict: true, noEmit: true, types: [] }
    const host = ts.createCompilerHost(options)
    const read = host.readFile.bind(host)
    host.readFile = (name) => (name === file ? source : read(name))
    host.fileExists = (
      (exists) => (name: string) =>
        name === file || exists(name)
    )(host.fileExists.bind(host))
    host.getSourceFile = (
      (get) =>
      (name, lang, ...rest) =>
        name === file ? ts.createSourceFile(name, source, lang) : get(name, lang, ...rest)
    )(host.getSourceFile.bind(host))
    const program = ts.createProgram([file], options, host)
    const checker = program.getTypeChecker()
    const sf = program.getSourceFile(file)!
    const fn = checker
      .getExportsOfModule(checker.getSymbolAtLocation(sf)!)
      .find((e) => e.name === 'f')!
    const param = checker.getTypeOfSymbol(fn).getCallSignatures()[0]!.getParameters()[0]!
    const flags = ts.TypeFormatFlags.NoTruncation
    return {
      lines: propShapeLines(checker, checker.getTypeOfSymbol(param), fn.valueDeclaration!, flags),
    }
  }

  test('lists name, optionality and type of each own member', () => {
    const { lines } = firstParam('export function f(p: { a: string; b?: number }) {}')
    expect(lines).toEqual(['  a: string', '  b?: number'])
  })

  test('an optional props parameter still gets its block', () => {
    const { lines } = firstParam('export function f(p?: { a: string }) {}')
    expect(lines).toEqual(['  a: string'])
  })

  test('a primitive first parameter gets no block', () => {
    expect(firstParam('export function f(p: string) {}').lines).toEqual([])
  })

  test('a union props type lists the modes once, then each prop; a discriminant is not tagged with itself', () => {
    const { lines } = firstParam(
      `type Mode =
        | { router: string; children?: never }
        | { router?: never; children: number }
      export function f(p: { theme?: string } & Mode) {}`,
    )
    expect(lines).toEqual([
      '  one of: router | children',
      '  theme?: string',
      '  router: string',
      '  children: number',
    ])
  })

  test('`?` follows optionality, not the mode tag; a mode-only prop is tagged with the mode that owns it', () => {
    const { lines } = firstParam(
      `type Mode =
        | { url: string; retries?: number }
        | { client: object; retries?: never }
      export function f(p: Mode) {}`,
    )
    expect(lines).toContain('  retries?: number  [with url]')
    expect(lines).toContain('  url: string')
  })

  test('modes are named from a discriminant literal; with none the header is omitted and not counted', () => {
    const { lines } = firstParam(
      `type Mode = { kind: 'a'; a: string } | { kind: 'b'; b: number }
      export function f(p: Mode) {}`,
    )
    expect(lines[0]).toBe('  one of: kind="a" | kind="b"')
    expect(lines).toContain('  a: string  [with kind="a"]')
    const wide = Array.from({ length: MAX_PROPS }, (_, i) => `p${i}: 1`).join('; ')
    const sized = firstParam(
      `type Mode = { kind: 'a'; ${wide} } | { kind: 'b' }
      export function f(p: Mode) {}`,
    ).lines
    expect(sized).toHaveLength(MAX_PROPS + 2)
    const anon = firstParam(
      `type Mode = { x?: 1; a?: 1 } | { x?: 2; b?: 1 }
      export function f(p: Mode) {}`,
    ).lines
    expect(anon.some((l) => l.includes('one of'))).toBe(false)
  })

  test('a prop shared by modes with different types merges them into one union', () => {
    const { lines } = firstParam(
      `type Mode =
        | { kind: 'a'; a: string }
        | { kind: 'b'; b: number }
      export function f(p: Mode) {}`,
    )
    expect(lines).toContain('  kind: "a" | "b"')
    expect(lines).toContain('  a: string  [with kind="a"]')
  })

  test('a long member type is clipped to MAX_PROP_TYPE', () => {
    const long = Array.from({ length: 30 }, (_, i) => `'variant${i}'`).join(' | ')
    const [line] = firstParam(`export function f(p: { v: ${long} }) {}`).lines
    expect(line!.length).toBe('  v: '.length + MAX_PROP_TYPE)
    expect(line!.endsWith('…')).toBe(true)
  })

  test('more than MAX_PROPS members are cut to MAX_PROPS plus an exact remainder line', () => {
    const members = Array.from({ length: MAX_PROPS + 5 }, (_, i) => `m${i}: 1`).join('; ')
    const { lines } = firstParam(`export function f(p: { ${members} }) {}`)
    expect(lines).toHaveLength(MAX_PROPS + 1)
    expect(lines.at(-1)).toBe('  … +5 more')
  })
})
