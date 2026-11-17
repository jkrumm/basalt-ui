import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import {
  PreviewCard,
  PreviewCardContent,
  PreviewCardTrigger,
  previewCardParts,
} from './preview-card'

afterEach(cleanup)

const card = (): HTMLElement | null => document.querySelector('[data-slot="preview-card-content"]')

function Fixture({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  return (
    <PreviewCard {...(onOpenChange !== undefined && { onOpenChange })}>
      <PreviewCardTrigger href="/issues/12" delay={0} closeDelay={0}>
        #12
      </PreviewCardTrigger>
      <PreviewCardContent>Retry the deploy.</PreviewCardContent>
    </PreviewCard>
  )
}

const link = (): HTMLElement => screen.getByRole('link', { name: '#12' })

describe('PreviewCard', () => {
  test('closed, it renders one link and no card', () => {
    render(<Fixture />)
    expect(link().getAttribute('data-slot')).toBe('preview-card-trigger')
    expect(link().getAttribute('href')).toBe('/issues/12')
    expect(card()).toBeNull()
  })

  test('mouse hover opens the card, leaving closes it', async () => {
    render(<Fixture />)
    await act(async () => {
      fireEvent.mouseEnter(link())
      fireEvent.mouseMove(link())
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    expect(card()?.textContent).toContain('Retry the deploy.')
    for (const slot of document.querySelectorAll('[data-slot]')) {
      expect(previewCardParts as readonly string[]).toContain(slot.getAttribute('data-slot') ?? '')
    }
  })

  test('keyboard focus opens the card and Escape closes it', async () => {
    render(<Fixture />)
    await act(async () => {
      fireEvent.focus(link())
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    expect(card()).not.toBeNull()
    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    })
    expect(card()).toBeNull()
  })

  test('a first touch tap opens the card and does not follow the link; the second tap follows it', async () => {
    const opened: boolean[] = []
    render(<Fixture onOpenChange={(open) => opened.push(open)} />)
    const first = new MouseEvent('click', { bubbles: true, cancelable: true })
    await act(async () => {
      fireEvent.pointerDown(link(), { pointerType: 'touch' })
    })
    expect(link().hasAttribute('data-preview-first-tap')).toBe(true)
    await act(async () => {
      link().dispatchEvent(first)
    })
    expect(first.defaultPrevented).toBe(true)
    expect(link().hasAttribute('data-preview-first-tap')).toBe(false)
    expect(card()).not.toBeNull()
    expect(opened).toContain(true)

    const second = new MouseEvent('click', { bubbles: true, cancelable: true })
    await act(async () => {
      fireEvent.pointerDown(link(), { pointerType: 'touch' })
    })
    expect(link().hasAttribute('data-preview-first-tap')).toBe(false)
    await act(async () => {
      link().dispatchEvent(second)
    })
    expect(second.defaultPrevented).toBe(false)
    expect(card()).toBeNull()
  })

  test('a mouse click follows the link and marks nothing', async () => {
    render(<Fixture />)
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    await act(async () => {
      fireEvent.pointerDown(link(), { pointerType: 'mouse' })
      link().dispatchEvent(click)
    })
    expect(link().hasAttribute('data-preview-first-tap')).toBe(false)
    expect(click.defaultPrevented).toBe(false)
  })

  test('the server render carries the link and no card', () => {
    const html = renderToString(<Fixture />)
    expect(html).toContain('data-slot="preview-card-trigger"')
    expect(html).not.toContain('preview-card-content')
  })
})
