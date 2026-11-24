import { cleanup, fireEvent, render } from '@testing-library/react'
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
    const { getByRole } = render(<Button size="sm" shape="icon" aria-label="Close" />)
    expect(getByRole('button', { name: 'Close' })).toBeTruthy()
  })

  test('a small icon button reserves its coarse hit slop in its own margin box', () => {
    const { getByRole } = render(<Button size="sm" shape="icon" aria-label="Close" />)
    const { className } = getByRole('button', { name: 'Close' })
    expect(className).toContain('pointer-coarse:mx-2.5')
    expect(className).toContain('pointer-coarse:after:-inset-x-2.5')
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

  test('Pressable has no color of its own', () => {
    const { getByRole } = render(<Pressable size="chip">Tag</Pressable>)
    expect(getByRole('button').className).not.toContain('bg-')
  })
})

describe('button loading spinner', () => {
  test('loading draws an animated spinner and keeps the label', () => {
    const { getByRole } = render(<Button loading>Save</Button>)
    const el = getByRole('button')
    const svg = el.querySelector('svg')
    expect(svg?.getAttribute('class')).toContain('animate-spin')
    expect(svg?.getAttribute('class')).toContain('motion-reduce:animate-none')
    expect(el.textContent).toBe('Save')
    // The label stays in place, transparent, so the width holds and it still names the button.
    expect(getByRole('button', { name: 'Save' })).toBe(el)
    expect(el.querySelector('span')?.className).toContain('opacity-0')
  })

  test('no spinner when not loading', () => {
    const { getByRole } = render(<Button>Save</Button>)
    expect(getByRole('button').querySelector('svg')).toBeNull()
  })
})
