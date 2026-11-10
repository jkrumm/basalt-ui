import { describe, expect, test } from 'bun:test'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { cn } from './cn'
import { CN_THEME } from './cn-theme'
import { generate, themeNames } from './cn-theme.gen'

const SRC = new URL('..', import.meta.url).pathname
const BUDGET = 9216

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(?:ts|tsx)$/.test(name) ? [path] : []
  })
}

describe('cn: disambiguation', () => {
  test('text size and text colour coexist', () => {
    expect(cn('text-display', 'text-red-500')).toBe('text-display text-red-500')
    expect(cn('text-red-500', 'text-display')).toBe('text-red-500 text-display')
    expect(cn('text-good', 'text-lg')).toBe('text-good text-lg')
    expect(cn('text-[13px]', 'text-red-500')).toBe('text-[13px] text-red-500')
  })

  test('same-kind text utilities conflict', () => {
    expect(cn('text-sm', 'text-display')).toBe('text-display')
    expect(cn('text-red-500', 'text-good')).toBe('text-good')
    expect(cn('text-left', 'text-center')).toBe('text-center')
    expect(cn('text-ellipsis', 'text-clip')).toBe('text-clip')
    expect(cn('text-balance', 'text-nowrap')).toBe('text-nowrap')
    expect(cn('text-left', 'text-sm', 'text-ellipsis')).toBe('text-left text-sm text-ellipsis')
  })

  test('border width, style and colour are separate', () => {
    expect(cn('border', 'border-line')).toBe('border border-line')
    expect(cn('border-2', 'border-4')).toBe('border-4')
    expect(cn('border-dashed', 'border-solid')).toBe('border-solid')
    expect(cn('border-line', 'border-good')).toBe('border-good')
    expect(cn('border-t-2', 'border-t-line')).toBe('border-t-2 border-t-line')
    expect(cn('border-t-2', 'border-4')).toBe('border-4')
  })

  test('shadow size vs colour, rounded, bg, font', () => {
    expect(cn('shadow-card', 'shadow-overlay')).toBe('shadow-overlay')
    expect(cn('shadow-card', 'shadow-good')).toBe('shadow-card shadow-good')
    expect(cn('rounded-card', 'rounded-t-ctrl')).toBe('rounded-card rounded-t-ctrl')
    expect(cn('rounded-t-ctrl', 'rounded-card')).toBe('rounded-card')
    expect(cn('bg-card', 'bg-brand')).toBe('bg-brand')
    expect(cn('bg-card', 'bg-cover', 'bg-no-repeat')).toBe('bg-card bg-cover bg-no-repeat')
    expect(cn('font-sans', 'font-bold', 'font-mono')).toBe('font-bold font-mono')
  })
})

describe('cn: conflicts', () => {
  test('display: last wins, both orders', () => {
    expect(cn('hidden', 'inline-flex')).toBe('inline-flex')
    expect(cn('inline-flex', 'hidden')).toBe('hidden')
    expect(cn('flex', 'flex-col', 'grid')).toBe('flex-col grid')
  })

  test('p overrides earlier px, never the reverse', () => {
    expect(cn('px-2', 'p-4')).toBe('p-4')
    expect(cn('p-4', 'px-2')).toBe('p-4 px-2')
    expect(cn('pt-1', 'py-2')).toBe('py-2')
    expect(cn('py-2', 'pt-1')).toBe('py-2 pt-1')
    expect(cn('mx-2', 'm-0')).toBe('m-0')
    expect(cn('size-4', 'w-2')).toBe('size-4 w-2')
    expect(cn('w-2', 'size-4')).toBe('size-4')
    expect(cn('gap-x-1', 'gap-2')).toBe('gap-2')
    expect(cn('overflow-x-hidden', 'overflow-auto')).toBe('overflow-auto')
  })

  test('variants scope conflicts', () => {
    expect(cn('hidden', 'md:flex')).toBe('hidden md:flex')
    expect(cn('md:hidden', 'hidden')).toBe('md:hidden hidden')
    expect(cn('md:hidden', 'md:flex')).toBe('md:flex')
    expect(cn('hover:md:p-2', 'hover:md:p-4')).toBe('hover:md:p-4')
    expect(cn('[&:hover]:p-2', '[&:hover]:p-4')).toBe('[&:hover]:p-4')
  })

  test('important flag partitions', () => {
    expect(cn('!p-2', 'p-4')).toBe('!p-2 p-4')
    expect(cn('!p-2', '!p-4')).toBe('!p-4')
    expect(cn('p-2!', 'p-4!')).toBe('p-4!')
  })

  test('negative, opacity and arbitrary values', () => {
    expect(cn('mt-2', '-mt-4')).toBe('-mt-4')
    expect(cn('w-4', 'w-[10px]')).toBe('w-[10px]')
    expect(cn('w-[calc(100%-4px)]', 'w-4')).toBe('w-4')
    expect(cn('bg-card/50', 'bg-brand/20')).toBe('bg-brand/20')
    expect(cn('[mask-type:alpha]', '[mask-type:luminance]')).toBe('[mask-type:luminance]')
  })

  test('unknown classes always survive, order kept', () => {
    expect(cn('foo', 'p-2', 'bar', 'p-4', 'foo')).toBe('foo bar p-4 foo')
    expect(cn('card-x', 'card-x')).toBe('card-x card-x')
  })

  test('clsx forms', () => {
    expect(cn(['p-2', ['hidden']], { flex: true, grid: false }, null, undefined, 0, '')).toBe(
      'p-2 flex',
    )
    expect(cn('p-2   p-4\n  m-1')).toBe('p-4 m-1')
    expect(cn()).toBe('')
  })
})

const survives = (...classes: string[]): void => {
  expect(cn(...classes)).toBe(classes.join(' '))
  expect(cn(...classes.toReversed())).toBe(classes.toReversed().join(' '))
}

describe('cn: one prefix, several CSS properties', () => {
  test('list style type, position and image', () => {
    survives('list-disc', 'list-inside')
    survives('list-disc', 'list-image-none')
    survives('list-inside', 'list-image-[url(/a.png)]')
    expect(cn('list-disc', 'list-decimal')).toBe('list-decimal')
    expect(cn('list-inside', 'list-outside')).toBe('list-outside')
  })

  test('break and wrap utilities', () => {
    survives('break-words', 'break-all')
    survives('break-after-page', 'break-before-page', 'break-inside-avoid')
    survives('break-all', 'wrap-anywhere')
    expect(cn('break-all', 'break-keep')).toBe('break-keep')
    expect(cn('wrap-normal', 'wrap-anywhere')).toBe('wrap-anywhere')
    expect(cn('break-words', 'wrap-anywhere')).toBe('wrap-anywhere')
    expect(cn('break-all', 'break-words', 'break-normal')).toBe('break-normal')
  })

  test('touch action groups', () => {
    survives('touch-pan-x', 'touch-pinch-zoom')
    survives('touch-pan-x', 'touch-pan-y')
    expect(cn('touch-pan-x', 'touch-pan-left')).toBe('touch-pan-left')
    expect(cn('touch-auto', 'touch-none')).toBe('touch-none')
    expect(cn('touch-pan-x', 'touch-none')).toBe('touch-none')
  })

  test('inset vs inset-shadow and inset-ring', () => {
    survives('inset-0', 'inset-shadow-sm', 'inset-ring-1')
    survives('inset-shadow-sm', 'inset-shadow-red-500')
    survives('inset-ring-1', 'inset-ring-red-500')
    expect(cn('inset-shadow-sm', 'inset-shadow-lg')).toBe('inset-shadow-lg')
    expect(cn('inset-ring-1', 'inset-ring-2')).toBe('inset-ring-2')
  })

  test('font weight, family and stretch', () => {
    survives('font-bold', 'font-stretch-condensed')
    expect(cn('font-stretch-condensed', 'font-stretch-expanded')).toBe('font-stretch-expanded')
  })

  test('border-spacing is its own group', () => {
    survives('border-line', 'border-spacing-2')
    survives('border-2', 'border-spacing-x-2')
    expect(cn('border-spacing-x-2', 'border-spacing-4')).toBe('border-spacing-4')
    expect(cn('border-spacing-4', 'border-spacing-x-2')).toBe('border-spacing-4 border-spacing-x-2')
    expect(cn('border-spacing-y-1', 'border-spacing-y-2')).toBe('border-spacing-y-2')
  })

  test('rotate axes, space reverse, transition behavior, content, decoration, text shadow', () => {
    survives('rotate-45', 'rotate-x-12')
    survives('rotate-x-12', 'rotate-y-12')
    survives('space-x-2', 'space-x-reverse')
    survives('transition-colors', 'transition-discrete')
    survives('content-center', 'content-["x"]')
    survives('decoration-red-500', 'decoration-clone')
    survives('text-red-500', 'text-shadow-sm')
    survives('text-shadow-sm', 'text-shadow-red-500')
  })
})

describe('cn-theme', () => {
  test('committed cn-theme.ts equals generator output', () => {
    expect(readFileSync(new URL('./cn-theme.ts', import.meta.url), 'utf8')).toBe(generate())
  })

  test('names include display and exclude any hue name', () => {
    const names = themeNames()
    expect(names.textSizes).toContain('display')
    expect(CN_THEME.textSizes).toContain('display')
    const hues = /^(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo)$/
    const violet = /^(?:violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)$/
    for (const name of [...names.colors, ...names.textSizes]) {
      expect(hues.test(name) || violet.test(name)).toBe(false)
    }
  })
})

describe('tailwind-merge stays at zero', () => {
  test('package.json names it nowhere', () => {
    const pkg = readFileSync(join(SRC, '..', 'package.json'), 'utf8')
    expect(pkg).not.toContain('tailwind-merge')
  })

  test('nothing under src imports it', () => {
    const importers = sourceFiles(SRC).filter((file) => {
      if (file.endsWith('cn.test.ts')) return false
      return /from ['"]tailwind-merge|require\(['"]tailwind-merge/.test(readFileSync(file, 'utf8'))
    })
    expect(importers).toEqual([])
  })
})

describe('cn size budget', () => {
  test('minified + gzipped bundle (with clsx) stays under 9 KB', async () => {
    const result = await Bun.build({
      entrypoints: [join(SRC, 'core', 'cn.ts')],
      minify: true,
      target: 'browser',
      format: 'esm',
    })
    expect(result.success).toBe(true)
    const code = await result.outputs[0]!.text()
    const gz = gzipSync(code).length
    // oxlint-disable-next-line no-console
    console.log(`cn bundle: ${code.length} B minified, ${gz} B gzip (budget ${BUDGET})`)
    expect(gz).toBeLessThan(BUDGET)
  })
})
