import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Prose } from './prose'

afterEach(cleanup)

const root = (container: HTMLElement): HTMLElement => container.firstElementChild as HTMLElement

describe('Prose', () => {
  test('renders the typography root with its slot and the caller class', () => {
    const { container } = render(<Prose className="mt-4">body</Prose>)
    const el = root(container)
    expect(el.getAttribute('data-slot')).toBe('prose')
    expect(el.classList.contains('vx-prose')).toBe(true)
    expect(el.classList.contains('mt-4')).toBe(true)
    expect(el.textContent).toBe('body')
  })

  test('article is the default: 16px/1.7 and a 72ch measure', () => {
    const el = root(render(<Prose>x</Prose>).container)
    expect(el.className).toContain('max-w-[72ch]')
    expect(el.className).toContain('leading-[1.7]')
    expect(el.className).not.toContain('text-[15px]')
  })

  test('chat density is 15px/1.55', () => {
    const el = root(render(<Prose density="chat">x</Prose>).container)
    expect(el.className).toContain('text-[15px]')
    expect(el.className).toContain('leading-[1.55]')
  })

  test('measure={false} drops the max-width', () => {
    const el = root(render(<Prose measure={false}>x</Prose>).container)
    expect(el.className).not.toContain('max-w-')
  })

  test('server render keeps the slot', () => {
    expect(renderToString(<Prose>x</Prose>)).toContain('data-slot="prose"')
  })
})
