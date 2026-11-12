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
