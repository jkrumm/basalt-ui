import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { defineGlossary, InfoHint, infoHintParts } from './info-hint'

afterEach(cleanup)

const { InfoHint: Hint } = defineGlossary({
  errand: 'A step only a person can do.',
  'held signal': 'A signal waiting on a decision.',
})

const panel = (): HTMLElement | null => document.querySelector('[role="dialog"]')

describe('InfoHint', () => {
  test('closed, it renders one named glyph and no panel', () => {
    render(<InfoHint label="Net revenue">After refunds.</InfoHint>)
    const glyph = screen.getByRole('button', { name: 'What Net revenue means' })
    expect(glyph.getAttribute('data-slot')).toBe('info-hint')
    expect(panel()).toBeNull()
  })

  test('a press opens the panel with the title and the text, Escape closes it', async () => {
    render(<InfoHint label="Net revenue">After refunds.</InfoHint>)
    const glyph = screen.getByRole('button', { name: 'What Net revenue means' })
    await act(async () => {
      glyph.click()
    })
    const open = panel()
    expect(open?.textContent).toContain('Net revenue')
    expect(open?.textContent).toContain('After refunds.')
    expect(open?.getAttribute('aria-labelledby')).not.toBeNull()
    for (const slot of document.querySelectorAll('[data-slot]')) {
      expect(infoHintParts as readonly string[]).toContain(slot.getAttribute('data-slot') ?? '')
    }
    expect(open?.getAttribute('data-slot')).toBeNull()
    await act(async () => {
      fireEvent.keyDown(open as HTMLElement, { key: 'Escape' })
    })
    expect(panel()).toBeNull()
  })

  test('focus alone does not open it: a row of hints would otherwise open one panel each', () => {
    render(<InfoHint label="Net revenue">After refunds.</InfoHint>)
    screen.getByRole('button', { name: 'What Net revenue means' }).focus()
    expect(panel()).toBeNull()
  })

  test('hover opens it after the delay', async () => {
    render(<InfoHint label="Net revenue">After refunds.</InfoHint>)
    const glyph = screen.getByRole('button', { name: 'What Net revenue means' })
    await act(async () => {
      fireEvent.mouseEnter(glyph)
      fireEvent.mouseMove(glyph)
      await new Promise((resolve) => setTimeout(resolve, 250))
    })
    expect(panel()).not.toBeNull()
  })

  test('className is layout on the glyph', () => {
    render(
      <InfoHint label="Net" className="-my-0.5">
        x
      </InfoHint>,
    )
    expect(screen.getByRole('button').className).toContain('-my-0.5')
  })

  test('the server render carries the glyph and no panel', () => {
    const html = renderToString(<InfoHint label="Net">x</InfoHint>)
    expect(html).toContain('data-slot="info-hint"')
    expect(html).not.toContain('role="dialog"')
  })
})

describe('defineGlossary', () => {
  test('a term prints its definition under a capitalised title, in either capitalisation', async () => {
    render(<Hint term="Errand" />)
    await act(async () => {
      screen.getByRole('button', { name: 'What Errand means' }).click()
    })
    expect(panel()?.textContent).toContain('A step only a person can do.')
    cleanup()
    render(<Hint term="held signal" />)
    await act(async () => {
      screen.getByRole('button', { name: 'What Held signal means' }).click()
    })
    expect(panel()?.textContent).toContain('A signal waiting on a decision.')
  })

  test('two terms that differ only in case throw, naming both as written', () => {
    expect(() => defineGlossary({ Errand: 'a', errand: 'b' })).toThrow(
      '"Errand" and "errand" are one term',
    )
  })

  test('an empty definition throws, naming the term', () => {
    expect(() => defineGlossary({ errand: ' ' })).toThrow('"errand" has an empty definition')
  })

  test('two terms that differ only in case throw, naming both', () => {
    expect(() => defineGlossary({ errand: 'a', Errand: 'b' })).toThrow(
      '"errand" and "Errand" are one term',
    )
  })

  test('a term the glossary does not define is a type error', () => {
    // @ts-expect-error `errnd` is not a term of this glossary
    const wrong = <Hint term="errnd" />
    expect(wrong).toBeDefined()
  })
})
