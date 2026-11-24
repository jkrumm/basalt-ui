/**
 * `init --profile site` on a stock Astro project: the config wired, the layout written, the generated
 * sheet ignored and the site agent set placed; and the class rules reach the site's `.astro` pages.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { loadProject, runTemplateClasses } from '../lint/engine'
import { templateClassFindings } from '../lint/template-classes'
import { init } from './index'
import { patchAstroConfig } from './site'

const STOCK =
  "// @ts-check\nimport { defineConfig } from 'astro/config';\n\n// https://astro.build/config\nexport default defineConfig({});\n"

describe('patchAstroConfig', () => {
  it('wires the stock create-astro config: react() then basaltAstro(), both imported', () => {
    const out = patchAstroConfig(STOCK) ?? ''
    expect(out).toContain("import react from '@astrojs/react'")
    expect(out).toContain("import { basaltAstro } from 'basalt-ui/astro'")
    expect(out).toContain('defineConfig({\n  integrations: [react(), basaltAstro()],\n});')
    expect(out.indexOf("from 'astro/config'")).toBeLessThan(out.indexOf("from '@astrojs/react'"))
  })

  it('puts basaltAstro() after an existing react(), options included, and keeps a wired config as it is', () => {
    const text =
      "import react from '@astrojs/react'\nexport default defineConfig({ integrations: [react({ include: ['**/*.tsx'] }), mdx()] })\n"
    const out = patchAstroConfig(text) ?? ''
    expect(out).toContain("react({ include: ['**/*.tsx'] }), basaltAstro(), mdx()")
    expect(patchAstroConfig(out)).toBe(out)
  })

  it('puts the import after a wrapped last import, never inside it', () => {
    const text =
      "import react from '@astrojs/react'\nimport {\n  defineConfig,\n  envField,\n} from 'astro/config'\n\nexport default defineConfig({ integrations: [react()] })\n"
    const out = patchAstroConfig(text) ?? ''
    expect(out).toContain("} from 'astro/config'\nimport { basaltAstro } from 'basalt-ui/astro'\n")
    expect(out).toContain('[react(), basaltAstro()]')
  })

  it('leaves integrations without react() and a config without defineConfig to a to-do', () => {
    expect(patchAstroConfig('export default defineConfig({ integrations: [mdx()] })\n')).toBeNull()
    expect(patchAstroConfig('export default {}\n')).toBeNull()
  })
})

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

async function siteRepo(): Promise<{ dir: string; log: string }> {
  const dir = mkdtempSync(resolve(tmpdir(), 'basalt-site-'))
  dirs.push(dir)
  mkdirSync(join(dir, '.git'))
  writeFileSync(
    join(dir, 'package.json'),
    '{ "name": "site", "private": true, "type": "module" }\n',
  )
  writeFileSync(join(dir, 'astro.config.mjs'), STOCK)
  const lines: string[] = []
  const saved = { log: console.log, error: console.error }
  console.log = console.error = (...args: unknown[]) => void lines.push(args.join(' '))
  try {
    await init(['--profile', 'site', '--no-install'], dir, { doctor: async () => 0 })
  } finally {
    console.log = saved.log
    console.error = saved.error
  }
  return { dir, log: lines.join('\n') }
}

describe('init --profile site', () => {
  it('wires astro.config, writes the layout, ignores the generated sheet and places the site set', async () => {
    const { dir, log } = await siteRepo()
    const read = (path: string): string => readFileSync(join(dir, path), 'utf8')
    expect(read('astro.config.mjs')).toContain('integrations: [react(), basaltAstro()]')
    expect(read('src/layouts/Layout.astro')).toContain(
      "import BasaltFonts from 'basalt-ui/astro/BasaltFonts.astro'",
    )
    expect(read('.gitignore').split('\n')).toContain('.basalt/sources.css')
    expect(existsSync(join(dir, '.claude/rules/basalt-site.md'))).toBe(true)
    expect(existsSync(join(dir, '.claude/skills/basalt-site/SKILL.md'))).toBe(true)
    expect(existsSync(join(dir, '.claude/rules/basalt-page.md'))).toBe(false)
    expect(existsSync(join(dir, '.claude/skills/basalt-design'))).toBe(false)
    expect(read('AGENTS.md')).toContain('/basalt-site')
    expect(log).not.toContain('add basaltAstro()')
  })

  it('keeps a layout the site already has', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'basalt-site-'))
    dirs.push(dir)
    mkdirSync(join(dir, '.git'))
    mkdirSync(join(dir, 'src/layouts'), { recursive: true })
    writeFileSync(join(dir, 'src/layouts/Layout.astro'), '<slot />\n')
    writeFileSync(join(dir, 'astro.config.mjs'), STOCK)
    const saved = console.log
    console.log = () => {}
    try {
      await init(['--profile', 'site', '--no-install'], dir, { doctor: async () => 0 })
    } finally {
      console.log = saved
    }
    expect(readFileSync(join(dir, 'src/layouts/Layout.astro'), 'utf8')).toBe('<slot />\n')
  })

  it('the class rules fire on class="…" in a site page, and a reasoned waiver holds', async () => {
    const { dir } = await siteRepo()
    const page = 'src/pages/offender.astro'
    mkdirSync(dirname(join(dir, page)), { recursive: true })
    writeFileSync(
      join(dir, page),
      [
        '---',
        '---',
        '<div class="ml-4 bg-[#fff] md:flex">x</div>',
        '<!-- oxlint-disable-next-line basalt/logical-properties -- a fixed print margin -->',
        '<p class:list={["mr-2", { on: true }]}>y</p>',
        '',
      ].join('\n'),
    )
    const project = loadProject(dir)
    if ('error' in project) throw new Error(project.error)
    const found = runTemplateClasses(project, [page]).map((f) => `${f.line} ${f.id}`)
    expect(found).toContain('3 basalt/logical-properties')
    expect(found).toContain('3 basalt/colour-literal')
    expect(found).toContain('3 basalt/viewport-keyed')
    expect(found.some((f) => f.startsWith('5 '))).toBe(false)
  })
})

describe('templateClassFindings', () => {
  it('skips a class in fenced code, an example, and keeps the line numbers after it', () => {
    const text = '# Guide\n\n```astro\n<div class="ml-4" />\n```\n\n<p class="mr-2">x</p>\n'
    expect(templateClassFindings(text, new Set(['logical-properties'])).map((f) => f.line)).toEqual(
      [7],
    )
  })

  it('reads only the enabled ids, and className and template-literal values too', () => {
    const text = '<A className="pl-3" />\n<B class={`ml-1`} />\n'
    expect(templateClassFindings(text, new Set()).length).toBe(0)
    expect(templateClassFindings(text, new Set(['logical-properties'])).map((f) => f.line)).toEqual(
      [1, 2],
    )
  })
})
