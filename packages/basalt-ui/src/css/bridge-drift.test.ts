import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { compile } from 'tailwindcss'
import { bridgeEntries } from '../tokens/table'
import { generateCss } from './generate'

const tailwind = generateCss()['tailwind.css']
const require = createRequire(import.meta.url)
const tailwindIndex = join(dirname(require.resolve('tailwindcss/package.json')), 'index.css')

async function build(candidates: string[], source = tailwind): Promise<string> {
  const { build: run } = await compile(source, {
    base: import.meta.dir,
    loadStylesheet: async (id, base) => {
      const path = id === 'tailwindcss' ? tailwindIndex : join(import.meta.dir, id)
      const stub = id.startsWith('@fontsource-variable/')
      return {
        path: stub ? id : path,
        base: stub ? base : dirname(path),
        content: stub ? '' : readFileSync(path, 'utf8'),
      }
    },
  })
  return run(candidates)
}

describe('tailwind bridge drift', () => {
  test('every bridge target is emitted with its value', () => {
    for (const { tw, value } of bridgeEntries()) {
      expect(tailwind, tw).toContain(`  ${tw}: ${value};`)
    }
  })

  test('the closed-namespace resets precede every definition', () => {
    const lastReset = tailwind.lastIndexOf('--breakpoint-*: initial')
    const firstDefinition = tailwind.search(/--(color|shadow|radius|text|breakpoint)-(?!\*)/)
    expect(firstDefinition).toBeGreaterThan(lastReset)
    for (const ns of ['color', 'shadow', 'radius', 'text', 'breakpoint']) {
      const reset = tailwind.indexOf(`--${ns}-*: initial`)
      expect(reset).toBeGreaterThan(-1)
      expect(reset).toBeLessThan(lastReset + 1)
    }
  })

  test('the stylesheet order is layer statement, tailwind, tokens in theme, fonts', () => {
    const order = [
      '@layer theme, base, basalt, components, utilities;',
      "@import 'tailwindcss';",
      "@import './tokens.css' layer(theme);",
      "@import './fonts.css';",
      '@custom-variant dark',
    ].map((s) => tailwind.indexOf(s))
    expect(order.every((i) => i > -1)).toBe(true)
    expect(order.toSorted((a, b) => a - b)).toEqual(order)
  })

  test('compiled: resets hold, accent is hover, brand is the blue', async () => {
    const css = await build(['bg-accent', 'bg-brand', 'text-display', 'bg-blue-500'])
    expect(css).toMatch(/\.bg-accent\s*\{\s*background-color:\s*var\(--basalt-hover\)/)
    expect(css).not.toMatch(/\.bg-accent\s*\{[^}]*--basalt-brand/)
    expect(css).toMatch(/\.bg-brand\s*\{\s*background-color:\s*var\(--basalt-brand\)/)
    expect(css).toContain('.text-display')
    expect(css).not.toContain('.bg-blue-500')
    expect(css).not.toContain('--color-blue-500')
  })

  test('compiled: a reset after the definitions wipes them', async () => {
    const late = `${tailwind}\n@theme {\n  --color-*: initial;\n}\n`
    expect(await build(['bg-accent'])).toContain('.bg-accent')
    expect(await build(['bg-accent'], late)).not.toContain('.bg-accent')
  })

  test('compiled: the size utilities exist', async () => {
    const css = await build(['h-ctl', 'size-ctl', 'min-h-row', 'size-icon', 'focus-ring', 'link'])
    expect(css).toMatch(/\.h-ctl\s*\{\s*height:\s*var\(--basalt-ctl-h\)/)
    expect(css).toMatch(/\.size-ctl\s*\{\s*width:\s*var\(--basalt-ctl-h\)/)
    expect(css).toMatch(/\.min-h-row\s*\{\s*min-height:\s*var\(--basalt-row-h\)/)
    expect(css).toContain('.size-icon')
  })

  test('compiled: the dark variant matches an explicit dark scheme and a dark system scheme under auto', async () => {
    const css = await build(['dark:bg-card'])
    expect(css).toContain(":where([data-theme='dark'], [data-theme='dark'] *)")
    const media = css.indexOf('@media (prefers-color-scheme: dark)')
    expect(media).toBeGreaterThan(-1)
    const auto = css.indexOf(':where(:root:not([data-theme]), :root:not([data-theme]) *)')
    expect(auto).toBeGreaterThan(media)
    expect(css.slice(media)).toContain('background-color: var(--basalt-card)')
  })

  test('compiled: the coarse input floor sits inside its media query', async () => {
    const css = await build([])
    const floor = css.indexOf('font-size: max(var(--basalt-input-fz-floor, 16px)')
    expect(floor).toBeGreaterThan(-1)
    // The nearest media query before the declaration is the coarse pointer one, in the `basalt` layer.
    const media = css.lastIndexOf('@media', floor)
    expect(css.slice(media, floor)).toContain('(pointer: coarse)')
  })
})
