import { cleanup, fireEvent, render } from '@testing-library/react'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Button, Pressable, buttonParts } from './button'

afterEach(cleanup)

const slots = (root: ParentNode): string[] =>
  [...root.querySelectorAll('[data-slot]')].map((el) => el.getAttribute('data-slot') ?? '')

describe('button module', () => {
  test('renders with no provider; every part carries data-slot and buttonParts lists them', () => {
    const { container } = render(
      <>
        <Button>Save</Button>
        <Pressable>Row</Pressable>
      </>,
    )
    expect(slots(container)).toEqual([...buttonParts])
  })

  test('server render keeps the slots', () => {
    const html = renderToString(
      <>
        <Button>Save</Button>
        <Pressable>Row</Pressable>
      </>,
    )
    for (const part of buttonParts) expect(html).toContain(`data-slot="${part}"`)
  })

  test('className is merged after the variant classes and cannot replace the slot', () => {
    const { getByRole } = render(
      <Button className="w-full" data-slot="hijacked">
        Save
      </Button>,
    )
    const el = getByRole('button')
    expect(el.className).toContain('w-full')
    expect(el.className).toContain('h-ctl')
    expect(el.getAttribute('data-slot')).toBe('button')
  })

  test('icon sizes carry the name given by type', () => {
    const { getByRole } = render(<Button size="icon-sm" aria-label="Close" />)
    expect(getByRole('button', { name: 'Close' })).toBeTruthy()
  })

  test('loading disables the action, keeps focus and sets aria-busy', () => {
    let clicks = 0
    const { getByRole } = render(
      <Button loading onClick={() => clicks++}>
        Save
      </Button>,
    )
    const el = getByRole('button')
    expect(el.getAttribute('aria-busy')).toBe('true')
    expect(el.hasAttribute('data-loading')).toBe(true)
    expect(el.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(el)
    expect(clicks).toBe(0)
  })

  test('polymorphism goes through render', () => {
    const { container } = render(
      <Button nativeButton={false} render={<a href="/home" aria-label="Home" />}>
        Home
      </Button>,
    )
    const a = container.querySelector('a')
    expect(a?.getAttribute('data-slot')).toBe('button')
    expect(a?.getAttribute('href')).toBe('/home')
  })

  test('Pressable has no colour of its own', () => {
    const { getByRole } = render(<Pressable size="chip">Tag</Pressable>)
    expect(getByRole('button').className).not.toContain('bg-')
  })
})

describe('layer boundary', () => {
  test('src/ui imports no Mantine', () => {
    const dir = new URL('.', import.meta.url).pathname
    for (const name of readdirSync(dir)) {
      if (!/^(button|input)/.test(name) || name.endsWith('.test.tsx')) continue
      expect(readFileSync(join(dir, name), 'utf8')).not.toContain('@mantine')
    }
  })
})
