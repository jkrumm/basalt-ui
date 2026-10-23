import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { generateLlmsTxt, outPath } from './gen-llms'
import {
  MAX_LITERAL_MAP_KEYS,
  MAX_OPTION_TYPES,
  MAX_PROP_TYPE,
  MAX_PROPS,
  MAX_UNION_MEMBERS,
  namedOptionTypes,
  optionTypeBlock,
  propShapeLines,
  typeGlossary,
  valueSignature,
} from './llms-signatures'

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

  test('VX lists every token, untruncated (row 78 b)', () => {
    const at = text.indexOf('Signature: VX:')
    const block = text.slice(at, text.indexOf('\nSignature: ', at + 1))
    expect(block).not.toContain('…')
    for (const key of ['ink', 'ink2', 'muted', 'accent', 'surface: {', 'status: {'])
      expect(block).toContain(key)
  })

  test('a literal-only constant map prints its values (row 78 c)', () => {
    expect(text).toContain(
      'Signature: CONTAINER_KEYS: { compact: "240px", regular: "480px", wide: "800px" }',
    )
  })

  test('the glossary spells out a named literal union, in declaration order (row 78 a)', () => {
    const glossary = text.split('\n## Types\n')[1] ?? ''
    expect(glossary).toContain("type CalloutKind = 'info' | 'good' | 'warn' | 'bad'")
  })

  test('inline unions print exactly as they always did (no checker-order drift)', () => {
    expect(text).toContain('  settingsMenu?: "auto" | "flat" | "menu"')
    expect(text).toContain('  sparklinePlacement?: "bleed" | "right"')
  })

  test('the committed llms.txt is in sync', () => {
    expect(readFileSync(outPath, 'utf8')).toBe(text)
  })
})

/** Type-checks one in-memory module. */
function compile(source: string) {
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
  const sf = program.getSourceFile(file)
  if (sf === undefined) throw new Error('fixture did not load')
  const exports = checker.getExportsOfModule(checker.getSymbolAtLocation(sf)!)
  return { checker, sf, exports }
}

const FLAGS = ts.TypeFormatFlags.NoTruncation

describe('valueSignature', () => {
  /** The signature line(s) of the fixture's exported const `v`. */
  function sig(source: string): string {
    const { checker, exports } = compile(source)
    const v = exports.find((e) => e.name === 'v')
    if (v?.valueDeclaration === undefined) throw new Error('no v')
    const type = checker.getTypeOfSymbolAtLocation(v, v.valueDeclaration)
    return valueSignature(checker, 'v', type, v.valueDeclaration, FLAGS)
  }
  const keys = (n: number) => Array.from({ length: n }, (_, i) => `k${i}: 'x${i}'`).join(', ')

  test('a literal map at the key cap prints values; one key over prints keys only', () => {
    expect(sig(`export const v = { ${keys(MAX_LITERAL_MAP_KEYS)} } as const`)).toContain('k0: "x0"')
    const over = sig(`export const v = { ${keys(MAX_LITERAL_MAP_KEYS + 1)} } as const`)
    expect(over).not.toContain('"x0"')
    expect(over).toContain('k8')
  })

  test('a self-referential object type terminates', () => {
    const out = sig(
      `type Node = { name: string; next: Node }
      export const v: Node = null as unknown as Node`,
    )
    expect(out).toContain('name')
  })

  test('nested groups get their own line; no empty leaves line', () => {
    const out = sig(
      `export const v = { ${Array.from({ length: 40 }, (_, i) => `group${i}: { a: 1, b: 2 }`).join(', ')} } as const`,
    )
    expect(out.split('\n').every((l) => l.trim() !== '')).toBe(true)
    expect(out).toContain('  group0: { a, b }')
  })
})

describe('typeGlossary', () => {
  const MEMBERS = (n: number) => Array.from({ length: n }, (_, i) => `'m${i}'`).join(' | ')
  function glossary(source: string, printed: string): string[] {
    const { checker, sf } = compile(source)
    return typeGlossary(checker, sf, printed)
  }

  test('lists an exported literal union in declaration order, string and numeric', () => {
    expect(
      glossary(
        `export type Kind = 'info' | 'good' | 'warn'
        export type Cols = 2 | 3 | 4 | 5`,
        'kind?: Kind  cols?: Cols',
      ),
    ).toEqual(['type Cols = 2 | 3 | 4 | 5', "type Kind = 'info' | 'good' | 'warn'"])
  })

  test('a non-exported alias never appears, nor one no signature names', () => {
    expect(
      glossary(
        `type Hidden = 'a' | 'b'
        export type Unused = 'c' | 'd'
        export type Used = 'e' | 'f'`,
        'x?: Hidden  y?: Used',
      ),
    ).toEqual(["type Used = 'e' | 'f'"])
  })

  test('only a name, not a substring or a quoted word, counts as referenced', () => {
    expect(glossary(`export type Kind = 'a' | 'b'`, 'x: MyKind  y: "Kind"')).toEqual([])
  })

  test('12 members are listed, 13 are not', () => {
    expect(glossary(`export type T = ${MEMBERS(MAX_UNION_MEMBERS)}`, 'x: T')).toHaveLength(1)
    expect(glossary(`export type T = ${MEMBERS(MAX_UNION_MEMBERS + 1)}`, 'x: T')).toEqual([])
  })

  test('a union with a non-literal member is not a literal union', () => {
    expect(glossary(`export type T = 'a' | number`, 'x: T')).toEqual([])
  })
})

describe('propShapeLines', () => {
  /** The first parameter type of the fixture's `f` export. */
  function firstParam(source: string) {
    const { checker, exports } = compile(source)
    const fn = exports.find((e) => e.name === 'f')!
    const param = checker.getTypeOfSymbol(fn).getCallSignatures()[0]!.getParameters()[0]!
    const flags = FLAGS
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

describe('option types (row 187)', () => {
  const decl = (source: string): ts.TypeAliasDeclaration | ts.InterfaceDeclaration =>
    compile(source).sf.statements.findLast(
      (n): n is ts.TypeAliasDeclaration | ts.InterfaceDeclaration =>
        ts.isTypeAliasDeclaration(n) || ts.isInterfaceDeclaration(n),
    )!

  test('llms.txt expands the three shapes an agent had to grep dist for', () => {
    expect(text).toMatch(/^Type: DateOptions = .*format\?: 'short' \| 'medium' \| 'long'/m)
    expect(text).toMatch(/^Type: ChartLegendConfig = .*placement\?: 'top' \| 'bottom' \| 'header'/m)
    expect(text).toMatch(/^Type: ResponsiveChartHeight = \{ base: number, regular\?/m)
  })

  test('the slot and composite types an agent builds first are expanded (row 197)', () => {
    expect(text).toMatch(/^Type: StatStripCell = \{/m)
    expect(text).toMatch(/^Type: MeterSegment = \{ value: number, label: string/m)
    expect(text).toMatch(/^Type: QueryStateLike<TData> = \{/m)
    expect(text).toMatch(/^Type: ChartSeries<T> = \{/m)
    expect(text).toMatch(/^ {2}getValue: \(d: T\) => number \| null/m)
  })

  test('a generic member list keeps its parameters in the name; a conditional alias and a literal union stay out', () => {
    const generic = decl(
      `export type S<T, K extends string = string> = { key: K; get: (d: T) => number }`,
    )
    expect(optionTypeBlock(generic)).toBe(
      'Type: S<T, K extends string = string> = { key: K, get: (d: T) => number }',
    )
    expect(text).not.toMatch(/^Type: (EmitArgs|CalloutKind)\b/m)
  })

  test('an intersection of a Pick and a member list (BarsBar<T>) gets its Type block', () => {
    expect(text).toMatch(/^Type: BarsBar<T> = Pick<ChartSeries<T>, .*> & \{ fillOpacity\?: number/m)
  })

  test('no subpath prints more option types than MAX_OPTION_TYPES, plus the remainder line', () => {
    for (const section of text.split(/^## /m).slice(1)) {
      const types = section.split('\n').filter((line) => line.startsWith('Type: '))
      expect(types.length, section.split('\n')[0]).toBeLessThanOrEqual(MAX_OPTION_TYPES + 1)
      if (types.length > MAX_OPTION_TYPES)
        expect(types.at(-1)).toMatch(/^Type: … \+\d+ more option types$/)
    }
  })

  test('an element type of an array prop is expanded, generic or not', () => {
    const { checker, exports } = compile(
      `export type Cell<T> = { id: T }
       export function f(p: { cells: readonly Cell<string>[] }) {}`,
    )
    const fn = exports.find((e) => e.name === 'f')!
    const param = checker.getTypeOfSymbol(fn).getCallSignatures()[0]!.getParameters()[0]!
    const cells = checker.getTypeOfSymbol(param).getProperty('cells')!
    const [found] = namedOptionTypes(checker, checker.getTypeOfSymbol(cells))
    expect(found && optionTypeBlock(found as ts.TypeAliasDeclaration)).toBe(
      'Type: Cell<T> = { id: T }',
    )
  })

  test('a short object prints on one line, comments dropped', () => {
    expect(
      optionTypeBlock(decl(`/** doc */ export type O = { /** a */ a?: number; b: 'x' | 'y' }`)),
    ).toBe("Type: O = { a?: number, b: 'x' | 'y' }")
  })

  test('a wide object prints one member per line, capped with a count', () => {
    const members = Array.from({ length: 20 }, (_, i) => `member${i}?: string | undefined`)
    const out = optionTypeBlock(decl(`export interface Wide { ${members.join('; ')} }`)).split('\n')
    expect(out[0]).toBe('Type: Wide = {')
    expect(out.at(-2)).toBe('  … +8 more')
    expect(out.at(-1)).toBe('}')
  })

  test('a string literal keeps its inner spacing and `; `', () => {
    expect(optionTypeBlock(decl(`export type S = { sep?: 'a; b  c' }`))).toBe(
      "Type: S = { sep?: 'a; b  c' }",
    )
  })

  test('a union alias prints its body on one line', () => {
    expect(optionTypeBlock(decl(`type A = {a: 1}; export type U = A | { b: 2 }`))).toBe(
      'Type: U = A | { b: 2; }',
    )
  })
})
