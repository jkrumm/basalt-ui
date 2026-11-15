/**
 * Seeded-offender tests for the shipped stylelint preset (static-framework-free P6): one offender per
 * bypass class, each firing its rule, plus clean fixtures that must yield nothing. The runner is the
 * stylelint Node API over the SHIPPED `configs/stylelint.basalt.json`, the file a consumer's `sync`
 * writes, so a drift between renderer and file fails here too.
 */
import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import stylelint from 'stylelint'
import { SHIPPED_CONFIG } from './gen'
import preset from './index'
import { renderStylelintConfig, stylelintConfig } from './render'

const PKG = resolve(import.meta.dirname, '..', '..', '..')
const FIXTURES = join(PKG, 'test', 'fixtures', 'lint', 'stylelint')

type Finding = { rule: string; text: string }

async function lint(files: string, configFile = SHIPPED_CONFIG): Promise<Map<string, Finding[]>> {
  const { results } = await stylelint.lint({
    files: join(FIXTURES, files),
    configFile,
    allowEmptyInput: false,
  })
  const byFile = new Map<string, Finding[]>()
  for (const r of results) {
    const warnings = [
      ...r.warnings.map((w) => ({ rule: w.rule, text: w.text })),
      ...(r.parseErrors ?? []).map((w) => ({ rule: 'parse-error', text: w.text })),
    ]
    byFile.set(r.source?.slice(FIXTURES.length + 1) ?? '?', warnings)
  }
  return byFile
}

/** Each offender fixture and the rule it must fire. */
const OFFENDERS: [file: string, rule: string][] = [
  ['named-colour.css', 'color-named'],
  ['hex.css', 'color-no-hex'],
  ['rgb.css', 'function-disallowed-list'],
  ['oklch.css', 'function-disallowed-list'],
  ['light-dark.css', 'function-disallowed-list'],
  ['color-mix-raw.css', 'declaration-property-value-disallowed-list'],
  ['rem-padding.css', 'declaration-property-value-disallowed-list'],
  ['px-gap.css', 'declaration-property-value-disallowed-list'],
  ['calc-padding.css', 'declaration-property-value-disallowed-list'],
  ['font-size-px.css', 'declaration-property-value-disallowed-list'],
  ['font-shorthand.css', 'declaration-property-value-disallowed-list'],
  ['grid-gap.css', 'declaration-property-value-disallowed-list'],
  ['scroll-margin.css', 'declaration-property-value-disallowed-list'],
  ['border-left-brand.css', 'declaration-property-value-disallowed-list'],
  ['background-tint.css', 'declaration-property-value-disallowed-list'],
  ['outline-status.css', 'declaration-property-value-disallowed-list'],
  ['shadow-chart.css', 'declaration-property-value-disallowed-list'],
  ['overflow-scroll.css', 'declaration-property-value-disallowed-list'],
  ['raw-radius.css', 'declaration-property-value-allowed-list'],
  ['raw-line-height.css', 'declaration-property-value-allowed-list'],
  ['vx-declaration.css', 'property-disallowed-list'],
  ['important.css', 'declaration-no-important'],
  ['viewport-media.css', 'media-feature-name-disallowed-list'],
  ['viewport-media-range.css', 'media-feature-name-disallowed-list'],
  ['data-slot.css', 'selector-disallowed-list'],
  ['mantine-class.css', 'selector-disallowed-list'],
  ['utility.css', 'at-rule-disallowed-list'],
  ['needless-disable.css', '--report-needless-disables'],
  ['reasonless-disable.css', '--report-descriptionless-disables'],
]

describe('seeded offenders', () => {
  it('has a fixture per offender and no orphan', () => {
    const onDisk = readdirSync(join(FIXTURES, 'offenders')).filter((f) => f.endsWith('.css'))
    expect(onDisk.toSorted()).toEqual(OFFENDERS.map(([f]) => f).toSorted())
  })

  for (const [file, rule] of OFFENDERS) {
    it(`${file} fires ${rule}`, async () => {
      const findings = (await lint(`offenders/${file}`)).get(`offenders/${file}`) ?? []
      const text = JSON.stringify(findings)
      expect(findings.length, text).toBeGreaterThan(0)
      // `--report-*` disables surface under the `--report-` pseudo rule name or a plain-text message
      expect(
        findings.some((f) => f.rule === rule || f.text.includes(rule)),
        text,
      ).toBe(true)
    })
  }

  it('a scroll container in app CSS names ui/scroll-area, for every overflow longhand', async () => {
    const root = mkdtempSync(join(tmpdir(), 'basalt-stylelint-scroll-'))
    try {
      const css = [
        'overflow: auto',
        'overflow: scroll',
        'overflow: hidden auto',
        'overflow-x: scroll',
        'overflow-y: auto',
        'overflow-block: auto',
        'overflow-inline: scroll',
      ]
        .map((d, i) => `.c${i} { ${d}; }`)
        .join('\n')
      writeFileSync(join(root, 'app.css'), `${css}\n`)
      const { results } = await stylelint.lint({
        files: join(root, 'app.css'),
        configFile: SHIPPED_CONFIG,
      })
      const warnings = results[0]?.warnings ?? []
      expect(warnings).toHaveLength(7)
      for (const w of warnings) expect(w.text).toContain('ui/scroll-area')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('a style block in an .astro fixture is linted', async () => {
    const findings = (await lint('offenders/page.astro')).get('offenders/page.astro') ?? []
    expect(findings.map((f) => f.rule)).toContain('color-no-hex')
  })

  it('a style block in an .mdx fixture is linted', async () => {
    const findings = (await lint('offenders/page.mdx')).get('offenders/page.mdx') ?? []
    expect(findings.map((f) => f.rule)).toContain('declaration-property-value-disallowed-list')
  })
})

describe('clean fixtures', () => {
  it('yield 0 warnings', async () => {
    const results = await lint('clean/*.{css,astro}')
    expect(results.size).toBeGreaterThanOrEqual(10)
    for (const [file, findings] of results) expect(findings, file).toEqual([])
  })
})

describe('scan coverage', () => {
  it('a scan of 0 files fails', async () => {
    await expect(lint('offenders/does-not-exist/*.css')).rejects.toThrow()
  })
})

describe('renderStylelintConfig', () => {
  it('the shipped file is the default render (no drift)', () => {
    expect(readFileSync(SHIPPED_CONFIG, 'utf8')).toBe(renderStylelintConfig())
  })

  it('the default export is the config object', () => {
    expect(preset).toEqual(stylelintConfig())
  })

  it('lists tokens[].out in ignoreFiles, and a hex inside that file is then not reported', async () => {
    // A consumer root: the config sits at the root and `ignoreFiles` is relative to it.
    const root = mkdtempSync(join(tmpdir(), 'basalt-stylelint-'))
    try {
      mkdirSync(join(root, 'src', 'styles'), { recursive: true })
      const sheet = readFileSync(join(FIXTURES, 'generated', 'tokens.css'), 'utf8')
      writeFileSync(join(root, 'src', 'styles', 'tokens.css'), sheet)
      writeFileSync(join(root, 'src', 'styles', 'app.css'), sheet)

      const lintRoot = async (ignoreFiles: string[]) => {
        const configFile = join(root, '.stylelintrc.basalt.json')
        const rendered = renderStylelintConfig({ ignoreFiles })
        expect(JSON.parse(rendered).ignoreFiles).toEqual(ignoreFiles)
        writeFileSync(configFile, rendered)
        const { results } = await stylelint.lint({
          files: join(root, 'src/styles/*.css'),
          configFile,
          cwd: root,
        })
        return new Map(
          results.map((r) => [basename(r.source ?? ''), r.warnings.map((w) => w.rule)]),
        )
      }

      const open = await lintRoot([])
      expect(open.get('tokens.css')).toContain('color-no-hex')

      const ignored = await lintRoot(['src/styles/tokens.css'])
      expect(ignored.get('tokens.css') ?? []).toEqual([])
      expect(ignored.get('app.css')).toContain('color-no-hex')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

const scrollOf = (value: unknown): boolean => JSON.stringify(value).includes('overflow')

describe('scroll ban per root', () => {
  const OVERRIDE = 'declaration-property-value-disallowed-list'

  it('with no options the ban holds everywhere', () => {
    const config = stylelintConfig()
    expect(scrollOf(config.rules[OVERRIDE])).toBe(true)
    expect(config.overrides).toHaveLength(1)
  })

  it('a scroll-free base drops the entry and its message, and a parts root turns it back on', async () => {
    const config = stylelintConfig({
      scroll: { base: false, roots: { 'apps/web': true, '.': false } },
    })
    expect(scrollOf(config.rules[OVERRIDE])).toBe(false)
    expect(JSON.stringify(config.rules[OVERRIDE])).not.toContain('scroll-area')
    const root = mkdtempSync(join(tmpdir(), 'basalt-stylelint-roots-'))
    try {
      mkdirSync(join(root, 'apps/web'), { recursive: true })
      mkdirSync(join(root, 'site'), { recursive: true })
      for (const dir of ['apps/web', 'site']) {
        writeFileSync(join(root, dir, 'a.css'), 'pre { overflow-x: auto; }\n')
      }
      const configFile = join(root, '.stylelintrc.basalt.json')
      writeFileSync(configFile, JSON.stringify(config))
      const { results } = await stylelint.lint({
        files: join(root, '**/*.css'),
        configFile,
        cwd: root,
      })
      const bySource = new Map(results.map((r) => [r.source?.slice(root.length + 1), r.warnings]))
      expect(bySource.get('site/a.css')).toEqual([])
      expect(
        bySource
          .get('apps/web/a.css')
          ?.map((w) => w.text)
          .join(),
      ).toContain('ui/scroll-area')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('a scroll-full base gets an override only for a root that opts out; a nested root that agrees with it gets none', () => {
    const config = stylelintConfig({
      scroll: { base: true, roots: { 'a/b': false, a: false, c: true } },
    })
    expect(config.overrides.slice(1).map((o) => o.files)).toEqual([['a/**']])
  })

  it('a root nested in a differing root gets its own override even when it equals the base', () => {
    const inherited = stylelintConfig({ scroll: { base: true, roots: { '.': false, src: true } } })
    expect(inherited.overrides.slice(1).map((o) => o.files)).toEqual([['**'], ['src/**']])
    const mirrored = stylelintConfig({
      scroll: { base: false, roots: { a: true, 'a/b': false } },
    })
    expect(mirrored.overrides.slice(1).map((o) => o.files)).toEqual([['a/**'], ['a/b/**']])
    const same = stylelintConfig({ scroll: { base: true, roots: { a: true, 'a/b': true } } })
    expect(same.overrides).toHaveLength(1)
  })
})
