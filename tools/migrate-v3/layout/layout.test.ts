import { describe, expect, test } from 'bun:test'
import { cpSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderReport, runLayout } from './index.ts'
import { transformSource } from './transform.ts'

const FIXTURES = join(import.meta.dir, 'fixtures')
const run = (name: string) =>
  transformSource(readFileSync(join(FIXTURES, `${name}.in.txt`), 'utf8'), {
    file: 'fixture.tsx',
    cnImport: '@/lib/utils',
  })

describe('fixtures: one per trap', () => {
  const names = readdirSync(FIXTURES)
    .filter((f) => f.endsWith('.in.txt'))
    .map((f) => f.replace('.in.txt', ''))

  test.each(names)('%s matches its expected output', (name) => {
    expect(run(name).text).toBe(readFileSync(join(FIXTURES, `${name}.out.txt`), 'utf8'))
  })

  test.each(names)('%s: a second run over its own output is a no-op', (name) => {
    const first = run(name)
    const second = transformSource(first.text, { file: 'fixture.tsx', cnImport: '@/lib/utils' })
    expect(second.text).toBe(first.text)
    expect(second.converted).toBe(0)
  })
})

describe('traps', () => {
  test('type sizes map by px, not by name: lg is text-base, xl is text-lg, default is text-md', () => {
    const { text } = run('text-sizes')
    expect(text).toContain('<p className="font-normal text-md">default</p>')
    expect(text).toContain('<p className="font-normal text-base">lg</p>')
    expect(text).toContain('<p className="font-normal text-lg">xl</p>')
    expect(text).not.toContain('text-xl')
  })

  test('every converted Text without fw carries font-normal; the retired /[1.55] form is never emitted', () => {
    for (const name of ['text-sizes', 'text-reset']) {
      const { text } = run(name)
      const classes = [...text.matchAll(/<(?:p|span) className="([^"]*)"/g)].map((m) => m[1]!)
      expect(classes.length).toBeGreaterThan(0)
      for (const c of classes.filter((c) => !c.includes('font-bold')))
        expect(c).toContain('font-normal')
      expect(text).not.toContain('/[1.55]')
    }
  })

  test('flex 0 is not flex-none (basis and shrink differ); flex none is', () => {
    const src =
      'import { Box } from \'@mantine/core\'\nexport const a = <><Box flex={0} /><Box flex="none" /></>\n'
    const r = transformSource(src, { file: 'f.tsx', cnImport: '@/lib/utils' })
    expect(r.text).toContain('<Box flex={0} />')
    expect(r.text).toContain('<div className="flex-none" />')
    expect(r.worklist.map((w) => w.prop)).toEqual(['flex'])
  })

  test('a target nested in an attribute of a converted element waits for the next run and keeps its import', () => {
    const src = [
      "import { Box, Stack } from '@mantine/core'",
      'export const a = <Box p="md" onClick={() => open(<Stack gap="xs" />)} />',
      '',
    ].join('\n')
    const first = transformSource(src, { file: 'n.tsx', cnImport: '@/lib/utils' })
    expect(first.text).toContain("import { Stack } from '@mantine/core'")
    expect(first.text).toContain('<div className="p-4" onClick={() => open(<Stack gap="xs" />)} />')
    expect(first.worklist[0]?.reason).toContain('run the codemod again')
    const second = transformSource(first.text, { file: 'n.tsx', cnImport: '@/lib/utils' })
    expect(second.text).toContain('open(<div className="flex flex-col gap-2" />)')
    expect(second.text).not.toContain('@mantine/core')
  })

  test('lineClamp emits text-ellipsis', () => {
    expect(run('text-reset').text).toContain('line-clamp-2 text-ellipsis')
  })

  test('Stack, Group and SimpleGrid defaults are emitted explicitly', () => {
    const { text } = run('defaults')
    expect(text).toContain('"flex flex-col gap-4"')
    expect(text).toContain('"flex gap-4 items-center flex-wrap"')
    expect(text).toContain('"grid grid-cols-1 gap-4"')
  })

  test('fw="semibold" is refused as a latent bug, appears in the worklist, source unchanged', () => {
    const r = run('latent-semibold')
    expect(r.converted).toBe(0)
    expect(r.text).toBe(readFileSync(join(FIXTURES, 'latent-semibold.in.txt'), 'utf8'))
    expect(r.worklist).toHaveLength(1)
    expect(r.worklist[0]).toMatchObject({ kind: 'latent-bug', tag: 'Text', prop: 'fw' })
    expect(r.worklist[0]!.reason).toContain('latent bug')
  })

  test('breakpoints emit md/xl; a Mantine breakpoint with no v3 twin goes to the worklist', () => {
    const r = run('responsive')
    expect(r.text).toContain('grid-cols-1 md:grid-cols-2 xl:grid-cols-4')
    expect(r.text).toContain("<Stack gap={{ base: 'xs', md: 'lg' }}>")
    expect(r.worklist.map((w) => w.reason)).toEqual([expect.stringContaining('breakpoint md')])
  })

  test('a Button with mt and a responsive prop land in the worklist with reasons, unchanged in source', () => {
    const source = readFileSync(join(FIXTURES, 'worklist-composites.in.txt'), 'utf8')
    const r = run('worklist-composites')
    expect(r.text).toBe(source)
    const byKey = (kind: string, tag: string, prop: string) =>
      r.worklist.find((w) => w.kind === kind && w.tag === tag && w.prop === prop)
    expect(byKey('composite-style-prop', 'Button', 'mt')?.reason).toContain('no className')
    expect(byKey('responsive-prop', 'Button', 'w')?.reason).toContain('responsive')
    expect(byKey('responsive-prop', 'Grid.Col', 'span')).toBeDefined()
    // A non-style prop on a composite is not a finding.
    expect(r.worklist.some((w) => w.tag === 'Button' && w.prop === 'size')).toBe(false)
  })

  test('colours, arbitrary sizes and spreads stay Mantine and are listed with the written prop name', () => {
    const r = run('worklist-composites')
    expect(r.worklist.find((w) => w.prop === 'c')?.reason).toContain('token-name map')
    expect(r.worklist.find((w) => w.prop === 'fz' || w.prop === 'size')?.reason).toContain(
      'closed v3 scale',
    )
    expect(r.worklist.find((w) => w.prop === '{...spread}')).toBeDefined()
  })

  test('a Mantine import still referenced is kept, one no longer referenced is dropped', () => {
    const { text } = run('keeps-imports')
    expect(text.split('\n')[0]).toBe("import { Text, type MantineTheme } from '@mantine/core'")
    expect(run('text-sizes').text).not.toContain('@mantine/core')
  })

  test('cn is imported once when a conditional class needs it', () => {
    const { text } = run('primitives')
    expect(text.match(/import \{ cn \}/g)).toHaveLength(1)
  })
})

describe('runLayout over a directory', () => {
  function scratch() {
    const dir = mkdtempSync(join(tmpdir(), 'layout-'))
    mkdirSync(join(dir, 'src'))
    for (const f of readdirSync(FIXTURES).filter((f) => f.endsWith('.in.txt'))) {
      cpSync(join(FIXTURES, f), join(dir, 'src', f.replace('.in.txt', '.tsx')))
    }
    writeFileSync(join(dir, 'src', 'plain.tsx'), 'export const x = <div />\n')
    return dir
  }

  test('dry run writes nothing; a real run writes; the second run changes nothing', () => {
    const dir = scratch()
    const before = readFileSync(join(dir, 'src', 'text-sizes.tsx'), 'utf8')
    const dry = runLayout({ dir, cnImport: '@/lib/utils', write: false })
    expect(dry.converted).toBeGreaterThan(0)
    expect(readFileSync(join(dir, 'src', 'text-sizes.tsx'), 'utf8')).toBe(before)

    const first = runLayout({ dir, cnImport: '@/lib/utils', write: true })
    expect(first.changedFiles).toBe(dry.changedFiles)
    const second = runLayout({ dir, cnImport: '@/lib/utils', write: true })
    expect(second.changedFiles).toBe(0)
    expect(second.converted).toBe(0)
    expect(second.worklist).toEqual(first.worklist)
  })

  test('the report is a worklist grouped by kind', () => {
    const report = renderReport(
      runLayout({ dir: scratch(), cnImport: '@/lib/utils', write: false }),
    )
    expect(report).toContain('## latent-bug (1)')
    expect(report).toContain('## composite-style-prop')
    expect(report).toContain('never an exemption')
  })
})
