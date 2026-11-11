/**
 * `Callout` — a thin mapping onto `Alert`: the kind picks the tone, the title is the alert's title,
 * and a title-less callout still names its kind for assistive tech.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { Callout } from './callout'

afterEach(cleanup)

describe('className reaches the root', () => {
  test('className is appended, never a replacement, and the title renders', () => {
    const { container } = render(
      <Callout kind="warn" title="Heads up" className="my-callout">
        <p>Rate-limited.</p>
      </Callout>,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.classList.contains('my-callout')).toBe(true)
    expect(root.getAttribute('data-slot')).toBe('alert')
    expect(screen.getByText('Heads up')).toBeDefined()
  })

  test('no className and no style leave the root without a style attr', () => {
    const { container } = render(<Callout>body</Callout>)
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute('style')).toBeNull()
    expect(root.textContent).toBe('Infobody')
  })

  test('a title replaces the kind word — the body always renders', () => {
    const { container } = render(<Callout title="Note">body</Callout>)
    expect(container.querySelector('[data-callout-kind-word]')).toBeNull()
    expect(container.textContent).toBe('Notebody')
  })
})

describe('a title-less callout still names its kind, so it is never tint-only', () => {
  const KINDS = [
    ['info', 'Info'],
    ['good', 'Success'],
    ['warn', 'Warning'],
    ['bad', 'Error'],
  ] as const

  for (const [kind, word] of KINDS) {
    test(kind, () => {
      const { container } = render(<Callout kind={kind}>body</Callout>)
      expect(container.querySelector('[data-callout-kind-word]')?.textContent).toBe(word)
    })
  }
})

describe('the kind maps onto the alert tone', () => {
  const TONES = [
    ['info', 'status', 'bg-info-tint'],
    ['good', 'status', 'bg-good-tint'],
    ['warn', 'alert', 'bg-warn-tint'],
    ['bad', 'alert', 'bg-bad-tint'],
  ] as const

  for (const [kind, role, tint] of TONES) {
    test(kind, () => {
      render(<Callout kind={kind}>body</Callout>)
      expect(screen.getByRole(role).className).toContain(tint)
    })
  }
})
