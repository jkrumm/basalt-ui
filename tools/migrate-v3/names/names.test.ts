import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadRenameRows } from '../imports/index.ts'
import { transformImports } from '../imports/transform.ts'
import { loadNameRows } from './index.ts'
import { transformNames } from './transform.ts'

const AREAS = join(import.meta.dir, '../../../packages/basalt-ui/migrations/areas')
const FIXTURES = join(import.meta.dir, 'fixtures')
const read = (name: string) => readFileSync(join(FIXTURES, name), 'utf8')

const renames = loadRenameRows(AREAS)
const names = loadNameRows(AREAS)

/** The 3.0 naming pass (Issue 3201): every symbol it renamed or moved goes through the imports codemod. */
const NAMING_IMPORT_ROWS = [
  'router-control-handle',
  'cards-frame-types-Phase',
  'cards-frame-types-QueryStateLike',
  'cards-frame-types-Empty',
  'cards-frame-types-FrameState',
  'cards-verdict',
  'cards-cardmenu',
  'charts-frame-types-CardAction',
  'charts-frame-types-Empty',
  'charts-frame-types-Fact',
  'charts-frame-types-FootFacts',
  'charts-frame-types-FrameHead',
  'charts-frame-types-FrameState',
  'charts-frame-types-Menu',
  'charts-frame-types-MenuEntry',
  'page-favoritetoggle',
  'page-use-favorite',
  'page-favoritetoggleprops',
  'page-favoriteentry',
  'page-favoriteinput',
  'page-favoritesstore',
]

function migrate(source: string, file = 'app.tsx') {
  const imported = transformImports(source, { file, rows: renames.rows })
  const named = transformNames(imported.text, { file, ...names })
  return {
    text: named.text,
    rows: new Set([...imported.changes, ...named.changes].map((c) => c.row)),
  }
}

describe('names', () => {
  test('every row of the codemods loads', () => {
    expect(names.skipped).toEqual([])
    expect(names.props.length).toBeGreaterThan(0)
    expect(names.values.length).toBeGreaterThan(0)
    expect(names.rules.length).toBeGreaterThan(0)
  })

  test('a fixture that uses every old name comes out on the new names', () => {
    const { text, rows } = migrate(read('every-old-name.in.txt'))
    expect(text).toBe(read('every-old-name.out.txt'))
    const expected = [
      ...NAMING_IMPORT_ROWS,
      ...names.props.map((r) => r.id),
      ...names.values.map((r) => r.id),
      ...names.rules.map((r) => `rule ${r.old}`),
    ]
    expect(expected.filter((id) => !rows.has(id))).toEqual([])
  })

  test('the output is stable: a second run changes nothing', () => {
    const once = read('every-old-name.out.txt')
    expect(migrate(once).text).toBe(once)
  })

  test('a prop is renamed only on the part the row names, under a local alias too', () => {
    const source = [
      "import { StatCell as Cell } from 'basalt-ui/cards'",
      "import { Other } from 'elsewhere'",
      'export const A = () => [<Cell label="a" />, <Other label="b" />]',
      '',
    ].join('\n')
    expect(migrate(source).text).toBe(source.replace('<Cell label=', '<Cell title='))
  })

  test('both names given: the old prop is left for a person', () => {
    const source =
      'import { StatCell } from \'basalt-ui/cards\'\nexport const A = () => <StatCell label="a" title="b" />\n'
    expect(migrate(source).text).toBe(source)
  })

  test('a value word is rewritten only where the type takes it', () => {
    const source = [
      "import { useDataTable } from 'basalt-ui/table'",
      "const size = 'compact'",
      "const t = useDataTable({ rows: [], columns: [], rowHeight: 'compact' })",
      '',
    ].join('\n')
    expect(migrate(source).text).toBe(source.replace("rowHeight: 'compact'", "rowHeight: 'dense'"))
  })

  test('a rule id inside a longer id is left alone; a config key is renamed', () => {
    const json =
      '{ "rules": { "basalt/app-colour-arbitrary": "off", "basalt/app-colour": "warn" } }\n'
    expect(migrate(json, '.oxlintrc.json').text).toBe(
      '{ "rules": { "basalt/app-color-arbitrary": "off", "basalt/app-color": "warn" } }\n',
    )
  })
})
