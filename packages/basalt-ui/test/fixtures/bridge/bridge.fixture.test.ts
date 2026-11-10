import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { compile } from 'tailwindcss'

const dir = import.meta.dir
const require = createRequire(import.meta.url)
const tailwindIndex = join(dirname(require.resolve('tailwindcss/package.json')), 'index.css')

const html = readFileSync(resolve(dir, 'index.html'), 'utf8')
const candidates = [
  ...new Set(
    [...html.matchAll(/class="([^"]*)"/g)].flatMap((m) =>
      (m[1] ?? '').split(/\s+/).filter(Boolean),
    ),
  ),
]

async function build(): Promise<string> {
  const { build: run } = await compile(readFileSync(resolve(dir, 'app.css'), 'utf8'), {
    base: dir,
    loadStylesheet: async (id, base) => {
      if (id.startsWith('@fontsource-variable/')) return { path: id, base, content: '' }
      const path = id === 'tailwindcss' ? tailwindIndex : resolve(base, id)
      return { path, base: dirname(path), content: readFileSync(path, 'utf8') }
    },
  })
  return run(candidates)
}

describe('bridge fixture (Tailwind 4 build)', () => {
  test('the page uses the bridge utilities', () => {
    for (const c of ['h-ctl', 'size-ctl', 'min-h-row', 'size-icon', 'bg-accent', 'text-display']) {
      expect(candidates).toContain(c)
    }
    expect(html).toContain('<input')
  })

  test('the size utilities are defined', async () => {
    const css = await build()
    expect(css).toMatch(/\.h-ctl\s*\{\s*height:\s*var\(--vx-ctl-h\)/)
    expect(css).toMatch(/\.size-ctl\s*\{\s*width:\s*var\(--vx-ctl-h\)/)
    expect(css).toMatch(/\.min-h-row\s*\{\s*min-height:\s*var\(--vx-row-h\)/)
    expect(css).toContain('.size-icon')
  })

  test('text-display compiles to the display font size token', async () => {
    const css = await build()
    expect(css).toMatch(/\.text-display\s*\{[^}]*font-size:\s*var\(--vx-text-display\)/)
  })

  test('bg-accent is the hover wash, not the brand', async () => {
    const css = await build()
    expect(css).toMatch(/\.bg-accent\s*\{\s*background-color:\s*var\(--vx-hover\)/)
    expect(css).not.toMatch(/\.bg-accent\s*\{[^}]*--vx-brand/)
  })

  test('the build is deterministic', async () => {
    expect(await build()).toBe(await build())
  })
})
