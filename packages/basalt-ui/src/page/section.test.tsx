/**
 * `Section`: a titled, anchored part of a page. The offset against the band is geometry
 * (`tests/layout/page-core.layout.test.ts`); here the markup, the anchor and the controls home.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Page } from './page'
import { slotOf } from './page.test-support'
import { Section } from './section'

afterEach(cleanup)

const section = (): HTMLElement => document.querySelector<HTMLElement>('[data-slot="section"]')!

describe('Section', () => {
  test('renders an h2 title and its children', () => {
    render(
      <Section title="Latency">
        <p>body</p>
      </Section>,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Latency' })).toBeDefined()
    expect(section().textContent).toContain('body')
  })

  test('is a region named by its title', () => {
    render(<Section title="Latency" />)
    expect(screen.getByRole('region', { name: 'Latency' })).toBe(section())
  })

  test('its id is the slug of the title, the anchor a #hash jump lands on', () => {
    render(<Section title="Error budget (30 d)" />)
    expect(section().id).toBe('error-budget-30-d')
  })

  test('a title with no sluggable characters gets no id', () => {
    render(<Section title="…" />)
    expect(section().hasAttribute('id')).toBe(false)
  })

  test('the scroll margin is the page sticky offset, so an anchor lands below the band', () => {
    render(<Section title="Latency" />)
    expect(section().className).toContain('scroll-mt-(--page-sticky-top)')
  })

  test('controls render on the heading row through their slot', () => {
    render(<Section title="Latency" controls={slotOf('Range')} />)
    const row = section().querySelector('header')!
    expect(row.querySelector('h2')).not.toBeNull()
    expect(row.querySelector('[data-slot="section-controls"]')?.textContent).toBe('Range')
  })

  test('an empty controls slot draws no controls home', () => {
    render(<Section title="Latency" controls={slotOf('Range', 0)} />)
    expect(section().querySelector('[data-slot="section-controls"]')).toBeNull()
  })

  test('it works with no Page around it', () => {
    render(<Section title="Alone">x</Section>)
    expect(section().textContent).toContain('x')
  })

  test('several sections under one Page keep their own anchors', () => {
    render(
      <Page>
        <Section title="One" />
        <Section title="Two" />
      </Page>,
    )
    expect([...document.querySelectorAll('[data-slot="section"]')].map((el) => el.id)).toEqual([
      'one',
      'two',
    ])
  })

  test('it carries no look of its own: no border, background or shadow classes', () => {
    render(<Section title="Latency" />)
    expect(section().className).not.toMatch(/\b(border|bg-|shadow)/)
  })

  test('renders the same markup on the server', () => {
    const html = renderToString(<Section title="Latency" controls={slotOf('Range')} />)
    expect(html).toContain('id="latency"')
    expect(html).toContain('<h2')
  })
})
