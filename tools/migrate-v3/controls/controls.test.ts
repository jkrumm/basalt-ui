import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { buildReport } from '../../../packages/basalt-ui/src/cli/migrate/index.ts'
import { renderReport, runControls } from './index.ts'
import { transformSource } from './transform.ts'

const FIXTURES = join(import.meta.dir, 'fixtures')
const PKG = resolve(import.meta.dir, '../../../packages/basalt-ui')
const run = (name: string) =>
  transformSource(readFileSync(join(FIXTURES, `${name}.in.txt`), 'utf8'), { file: `${name}.tsx` })

const names = readdirSync(FIXTURES)
  .filter((f) => f.endsWith('.in.txt'))
  .map((f) => f.replace('.in.txt', ''))

describe('fixtures: one per trap', () => {
  test.each(names)('%s matches its expected output', (name) => {
    expect(run(name).text).toBe(readFileSync(join(FIXTURES, `${name}.out.txt`), 'utf8'))
  })

  test.each(names)('%s: a second run over its own output changes nothing', (name) => {
    const first = run(name)
    const second = transformSource(first.text, { file: `${name}.tsx` })
    expect(second.text).toBe(first.text)
    expect(second.filterSets).toBe(0)
    expect(second.renames).toBe(0)
  })
})

describe('argo window-stores.ts', () => {
  const result = run('argo-window-store')
  const by = (reason: string) => result.worklist.filter((w) => w.reason === reason)

  test('a store is flagged and never rewritten', () => {
    expect(result.text).toBe(readFileSync(join(FIXTURES, 'argo-window-store.in.txt'), 'utf8'))
    expect(by('create-search-store').map((w) => w.row)).toEqual([
      'ctl-createSearchStore',
      'ctl-createSearchStore',
    ])
  })

  test('a persisting URL field yields a worklist entry with the recipe stub, never a silent deletion', () => {
    const [persist] = by('url-persist')
    expect(persist?.text).toContain('window')
    expect(persist?.stub).toContain("persisted<{ window?: unknown }>('garmin-health:window'")
    expect(persist?.stub).toContain("fallback '30d'")
    expect(persist?.stub).toContain('basalt:garmin-health:window is read as it stands')
    expect(persist?.stub).toContain('docs/recipes/remembered-values.md')
  })

  test('a field with persist: false or url: false is not a persist site', () => {
    expect(by('url-persist').map((w) => w.line)).toEqual([5, 32])
  })

  test('a createLocalStore has no URL lane unless one is declared: the state row, not defineControls', () => {
    expect(by('create-local-store').map((w) => w.row)).toEqual([
      'st-createLocalStore',
      'st-createLocalStore',
      'ctl-createLocalStore',
    ])
  })

  test('the stub holds one persisted() per store, shaped as the 2.x record', () => {
    expect(by('url-persist')[0]?.stub).toContain('persisted<{ window?: unknown }>')
  })

  test('a label the JSX decodes differently from JS stays put', () => {
    const { text, worklist } = transformSource(
      `import { FilterSet, SelectFilter } from 'basalt-ui/controls'\nexport const a = <FilterSet><SelectFilter field={s.f} label="Tom &amp; Jerry" /></FilterSet>\n`,
      { file: 'a.tsx' },
    )
    expect(text).toContain('<SelectFilter')
    expect(worklist.map((w) => w.reason)).toContain('filter-prop')
  })

  test('linkSearch and a spread validateSearch are found through the store variable', () => {
    expect(by('link-search')).toHaveLength(1)
    expect(by('validate-search')).toHaveLength(1)
  })
})

describe('FilterSet to specs', () => {
  test('options, clearable and placeholder move into the spec; a bare clearable is true', () => {
    const { text, filterSets } = run('filterset-specs')
    expect(filterSets).toBe(1)
    expect(text).toContain("spec(garminStore.field.window, 'Window', { clearable: true })")
    expect(text).toContain(
      "spec(usageStore.field.payer, 'Payer', { options: regions, placeholder: 'All payers' })",
    )
    expect(text).toContain("import { FilterSet, spec } from 'basalt-ui/controls'")
  })

  test('a FilterSet the codemod cannot convert stays whole and is listed by reason', () => {
    const { worklist } = run('filterset-stays')
    expect(worklist.map((w) => w.reason).toSorted()).toEqual([
      'filter-label',
      'filter-prop',
      'filterset-child',
      'standalone-filter',
    ])
  })
})

describe('FormSection and FormActions', () => {
  const result = run('shutterflow-forms')

  test('the tags and the imports are renamed', () => {
    expect(result.renames).toBe(2)
    expect(result.text).toContain("import { FormFooter, FormRow } from 'basalt-ui/controls'")
    expect(result.text).toContain("import { Section } from 'basalt-ui/page'")
    expect(result.text).not.toContain('FormSection')
  })

  test('props Section or FormFooter does not carry over are listed, not dropped', () => {
    expect(result.worklist.map((w) => w.reason)).toContain('form-footer-props')
    expect(result.worklist.map((w) => w.reason)).toContain('form-section-prop')
  })

  test('a name already bound blocks the rename instead of shadowing it', () => {
    const blocked = run('form-conflict')
    expect(blocked.renames).toBe(0)
    expect(blocked.worklist.map((w) => w.reason)).toEqual(['rename-conflict'])
  })

  test('the symbols that need a hand rewrite are listed with their row', () => {
    const rows = result.worklist.filter((w) => w.reason === 'manual-row').map((w) => w.row)
    expect(rows).toEqual(
      expect.arrayContaining([
        'ctl-FormStateProvider',
        'ctl-useFormSubmit',
        'ctl-inputProps',
        'ctl-fieldKey',
      ]),
    )
  })
})

const ids = (area: string) =>
  (
    JSON.parse(readFileSync(join(PKG, 'migrations/areas', `${area}.json`), 'utf8')) as {
      rows: { id: string }[]
    }
  ).rows.map((r) => r.id)

describe('rows', () => {
  const known = new Set([...ids('controls'), ...ids('state')])

  test('every row the codemod names exists in controls.json or state.json', () => {
    for (const name of names) {
      for (const w of run(name).worklist) {
        if (w.row !== '-') expect(known).toContain(w.row)
      }
    }
  })
})

function app(): string {
  const dir = mkdtempSync(join(tmpdir(), 'controls-'))
  mkdirSync(join(dir, 'src'), { recursive: true })
  writeFileSync(
    join(dir, 'src/toolbar.tsx'),
    readFileSync(join(FIXTURES, 'filterset-specs.in.txt')),
  )
  writeFileSync(
    join(dir, 'src/window-stores.ts'),
    readFileSync(join(FIXTURES, 'argo-window-store.in.txt')),
  )
  return dir
}

describe('a consumer tree', () => {
  test('migrate --check fails naming the row while SelectFilter is imported, passes after the codemod', () => {
    const dir = app()
    const before = buildReport({ from: '2.29.0', profile: 'app' }, dir, PKG)
    expect(before.failures.map((f) => f.detail).join('\n')).toContain('ctl-SelectFilter')

    const summary = runControls({ dir, write: true })
    expect(summary.filterSets).toBe(1)

    const after = buildReport({ from: '2.29.0', profile: 'app' }, dir, PKG)
    expect(after.failures.map((f) => f.detail).join('\n')).not.toContain('ctl-SelectFilter')
    expect(after.failures.map((f) => f.detail).join('\n')).not.toContain('ctl-MultiSelectFilter')
  })

  test('a second run changes no file and the report groups the worklist by reason', () => {
    const dir = app()
    const first = runControls({ dir, write: true })
    const snapshot = readFileSync(join(dir, 'src/toolbar.tsx'), 'utf8')
    const second = runControls({ dir, write: true })
    expect(second.changedFiles).toBe(0)
    expect(readFileSync(join(dir, 'src/toolbar.tsx'), 'utf8')).toBe(snapshot)
    expect(second.worklist).toEqual(first.worklist.filter((w) => w.file !== 'src/toolbar.tsx'))

    const report = renderReport(second)
    expect(report).toContain('## url-persist (2)')
    expect(report).toContain("persisted<{ window?: unknown }>('garmin-health:window'")
    expect(report).toContain('never an exemption')
  })

  test('--dry-run writes nothing', () => {
    const dir = app()
    const before = readFileSync(join(dir, 'src/toolbar.tsx'), 'utf8')
    const summary = runControls({ dir, write: false })
    expect(summary.changedFiles).toBe(1)
    expect(readFileSync(join(dir, 'src/toolbar.tsx'), 'utf8')).toBe(before)
  })
})
