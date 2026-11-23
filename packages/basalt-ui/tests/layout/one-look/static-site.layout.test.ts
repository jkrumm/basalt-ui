import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { themeScript } from '../../../src/css/theme-script'

// Runs under the layout bunfig (no happy-dom) because `test/fixtures/**` is hidden from the root loop.
const pkg = resolve(import.meta.dir, '../../..')
const doc = readFileSync(resolve(pkg, 'docs/static-site.md'), 'utf8')

describe('docs/static-site.md (static recipe, drift)', () => {
  test('names the four CSS entries, in import order', () => {
    const imports = [...doc.matchAll(/@import 'basalt-ui\/([a-z]+\.css)'/g)].map((m) => m[1])
    expect(imports).toEqual(['fonts.css', 'tokens.css', 'typography.css', 'prose.css'])
  })

  test('shows tokens:css with --out, its json form and --check', () => {
    expect(doc).toMatch(/tokens:css [^\n]*--out /)
    expect(doc).toMatch(/tokens:css [^\n]*--format json [^\n]*--out /)
    expect(doc).toContain('--check')
  })

  // A static page has no appearance setter: the recipe and the fixture carry the scheme half only.
  test('the script literal equals themeScript({ appearance: false }), byte for byte', () => {
    const block = doc.match(/<script>\n([\s\S]*?)\n<\/script>/)
    expect(block?.[1]).toBe(themeScript({ appearance: false }))
  })

  test('the fixture page embeds the same script', () => {
    const html = readFileSync(resolve(pkg, 'test/fixtures/tokens/index.html'), 'utf8')
    expect(html).toContain(themeScript({ appearance: false }))
  })
})
