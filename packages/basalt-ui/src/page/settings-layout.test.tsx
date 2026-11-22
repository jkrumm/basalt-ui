/** `SettingsLayout`: a centred column under a title, and a link to a row scrolls to it and marks it once. */
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { SettingsLayout } from './settings-layout'

afterEach(() => {
  cleanup()
  window.location.hash = ''
})

let scrolled: string[] = []
beforeEach(() => {
  scrolled = []
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this.id)
  }
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q })) as never
})

const page = (row?: string) => (
  <SettingsLayout title="Profile" description="Your name." {...(row !== undefined && { row })}>
    <div id="row-name">Name</div>
    <div id="row-email">Email</div>
  </SettingsLayout>
)

describe('SettingsLayout', () => {
  test('the title is the pane heading and the column is centred and capped', () => {
    const { getByRole, container } = render(page())
    expect(getByRole('heading', { level: 2, name: 'Profile' })).toBeTruthy()
    const root = container.querySelector('[data-slot="settings-layout"]')!
    expect(root.className).toContain('mx-auto')
    expect(root.className).toContain('max-w-3xl')
    expect(root.className).toContain('gap-10')
    expect(root.className).not.toMatch(/(^|\s)p[xy]?-/)
  })

  test('the row prop scrolls to the row and marks it, once', async () => {
    const { container, rerender } = render(page('row-email'))
    const el = container.querySelector('#row-email')!
    expect(scrolled).toEqual(['row-email'])
    expect(el.hasAttribute('data-flash')).toBe(true)
    rerender(page('row-email'))
    expect(scrolled).toEqual(['row-email'])
    rerender(page('row-name'))
    expect(scrolled).toEqual(['row-email', 'row-name'])
    expect(el.hasAttribute('data-flash')).toBe(false)
  })

  test('the URL hash is followed when no row is given', () => {
    window.location.hash = '#row-name'
    const { container } = render(page())
    expect(scrolled).toEqual(['row-name'])
    expect(container.querySelector('#row-name')!.hasAttribute('data-flash')).toBe(true)
    act(() => {
      window.location.hash = '#row-email'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(scrolled).toEqual(['row-name', 'row-email'])
  })

  test('an unknown row is ignored', () => {
    render(page('row-missing'))
    expect(scrolled).toEqual([])
  })
})
