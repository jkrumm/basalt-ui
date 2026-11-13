/**
 * P9 parts (docs/v3/concepts/ai-mdx.md section 8): the fixture page uses every `mdxComponents` key
 * and is compiled by a real `@mdx-js/mdx` `compile` (never `evaluate`); the output is written to a
 * temp module and imported. `a` with `//h` emits no href, and axe finds nothing serious.
 */
import { cleanup, render } from '@testing-library/react'
import { compile } from '@mdx-js/mdx'
import axe from 'axe-core'
import { mdxComponents } from 'basalt-ui/page'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import type { ComponentType } from 'react'
import remarkGfm from 'remark-gfm'

const KEYS = [
  'h2',
  'h3',
  'h4',
  'a',
  'table',
  'blockquote',
  'Callout',
  'Steps',
  'Step',
  'Tabs',
  'Tab',
  'Figure',
  'Kbd',
]

const SOURCE = readFileSync(join(import.meta.dir, 'mdx-fixture.mdx'), 'utf8')

let dir = ''
let Content: ComponentType<{ components: object }>

beforeAll(async () => {
  const scratch = join(import.meta.dir, '.mdx-scratch')
  mkdirSync(scratch, { recursive: true })
  dir = mkdtempSync(join(scratch, 'run-'))
  const compiled = await compile(SOURCE, { remarkPlugins: [remarkGfm] })
  const file = join(dir, 'fixture.mjs')
  writeFileSync(file, String(compiled))
  Content = ((await import(file)) as { default: typeof Content }).default
})

afterAll(() => {
  cleanup()
  rmSync(join(import.meta.dir, '.mdx-scratch'), {
    recursive: true,
    force: true,
  })
})

const page = () =>
  render(
    createElement(
      'div',
      { className: 'vx-prose' },
      createElement(Content, { components: mdxComponents }),
    ),
  ).container

describe('mdxComponents map', () => {
  test('has exactly the thirteen keys', () => {
    expect(Object.keys(mdxComponents).toSorted()).toEqual(KEYS.toSorted())
  })
})

describe('the compiled fixture renders every key', () => {
  test('headings carry an id and an anchor link', () => {
    const root = page()
    for (const tag of ['h2', 'h3', 'h4']) {
      const h = root.querySelector(tag)!
      expect(h.id).not.toBe('')
      expect(h.querySelector(`a[href="#${h.id}"]`)).not.toBeNull()
    }
  })

  test('table, blockquote, callout, steps, tabs, figure and kbd', () => {
    const root = page()
    expect(root.querySelector('table th')).not.toBeNull()
    const alerts = [...root.querySelectorAll('[data-slot="alert"]')]
    expect(alerts.length).toBe(2) // blockquote and Callout
    expect(root.querySelector('ol > li')?.textContent).toContain('Add the package')
    expect(root.querySelectorAll('[role="tab"]').length).toBe(2)
    expect(root.querySelector('[role="tabpanel"]')?.textContent).toContain('bun add basalt-ui')
    expect(root.querySelector('figure > figcaption')?.textContent).toBe(
      'One component map, one look.',
    )
    expect([...root.querySelectorAll('[data-slot="kbd"]')].length).toBe(2)
  })

  test('a safe link keeps its href; a //h link emits none', () => {
    const root = page()
    expect(root.querySelector('a[href="/docs/guide"]')).not.toBeNull()
    expect(root.querySelector('a[href="https://example.com"]')).not.toBeNull()
    const blocked = [...root.querySelectorAll('a')].find((a) => a.textContent === 'blocked link')!
    expect(blocked.hasAttribute('href')).toBe(false)
    expect(root.innerHTML).not.toContain('attacker.example')
  })
})

describe('axe', () => {
  test('finds nothing serious or critical', async () => {
    const root = page()
    document.body.append(root)
    const result = await axe.run(root, {
      resultTypes: ['violations'],
      rules: { 'color-contrast': { enabled: false } },
    })
    const bad = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`)).toEqual([])
  })
})
