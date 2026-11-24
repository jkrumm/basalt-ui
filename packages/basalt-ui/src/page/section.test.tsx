/**
 * `Section`: a titled, anchored part of a page. The offset against the band is geometry
 * (`tests/layout/page-core.layout.test.ts`); here the markup, the anchor and the controls home.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { memoryHandle } from '../controls/control-view.handles'
import { filterSlot } from '../controls/filter-slot'
import { spec } from '../controls/spec'
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

  test('the heading keeps a word space at its step', () => {
    render(<Section title="All orders">body</Section>)
    expect(screen.getByRole('heading', { level: 2 }).className).toContain('word-head')
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

  test('tabs take { handle, label } and draw a tab strip on the heading row', () => {
    const view = memoryHandle<string>('view', 'a', {
      kind: 'enum',
      options: [
        { value: 'a', label: 'Alpha' },
        { value: 'b', label: 'Beta' },
      ],
    })
    render(<Section title="Latency" tabs={{ state: view, label: 'Latency view' }} />)
    const home = section().querySelector('header [data-slot="section-tabs"]')
    expect(home?.querySelector('[data-slot="tabs"]')).not.toBeNull()
    expect(screen.getByRole('tablist', { name: 'Latency view' })).toBeDefined()
    // Under the regular tier the home is a block line, so the strip fills it and each tab takes an equal share.
    expect(home?.className).toContain('@max-regular:block')
    expect(home?.className).toContain('@max-regular:basis-full')
    expect(home?.querySelector('[data-slot="tabs"]')?.getAttribute('data-variant')).toBe('segment')
    expect(screen.getByRole('tab', { name: 'Alpha' }).className).toContain('@max-regular:flex-1')
  })

  test('a tabs slot renders as is; an empty one draws no tabs home', () => {
    const { rerender } = render(<Section title="Latency" tabs={slotOf('Views')} />)
    expect(section().querySelector('[data-slot="section-tabs"]')?.textContent).toBe('Views')
    rerender(<Section title="Latency" tabs={slotOf('Views', 0)} />)
    expect(section().querySelector('[data-slot="section-tabs"]')).toBeNull()
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

describe('Section summary', () => {
  test('draws one line beside the title', () => {
    render(<Section title="Latency" summary="p95 118 ms" />)
    const row = section().querySelector('header')!
    expect(row.querySelector('[data-slot="section-summary"]')?.textContent).toBe('p95 118 ms')
    expect(row.querySelector('h2')?.textContent).toBe('Latency')
  })

  test('draws nothing for an empty summary', () => {
    render(<Section title="Latency" summary="" />)
    expect(section().querySelector('[data-slot="section-summary"]')).toBeNull()
  })
})

describe('Section collapsible', () => {
  const trigger = (): HTMLElement => screen.getByRole('button', { name: 'Latency' })

  test('the heading holds the trigger and the body is open by default', () => {
    render(
      <Section title="Latency" collapsible={{}}>
        <p>body</p>
      </Section>,
    )
    expect(section().querySelector('h2 [data-slot="collapsible-trigger"]')).toBe(trigger())
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('heading', { level: 2, name: 'Latency' })).toBeDefined()
    expect(screen.getByText('body')).toBeDefined()
  })

  test('defaultOpen false starts closed, keeps the summary and the trigger opens it', () => {
    render(
      <Section title="Latency" summary="p95 118 ms" collapsible={{ defaultOpen: false }}>
        <p>body</p>
      </Section>,
    )
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('body')).toBeNull()
    expect(section().querySelector('[data-slot="section-summary"]')).not.toBeNull()
    fireEvent.click(trigger())
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('body')).toBeDefined()
  })

  test('a boolean handle owns the open state and receives the toggle', () => {
    const open = memoryHandle<boolean>('open', false, { kind: 'boolean' })
    render(
      <Section title="Latency" collapsible={{ state: open }}>
        <p>body</p>
      </Section>,
    )
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger())
    expect(open.writes).toEqual([true])
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('body')).toBeDefined()
    fireEvent.click(trigger())
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
  })

  test('a section without collapsible has no trigger', () => {
    render(<Section title="Latency">x</Section>)
    expect(section().querySelector('[data-slot="collapsible-trigger"]')).toBeNull()
  })

  test('renders the same markup on the server', () => {
    const html = renderToString(
      <Section title="Latency" collapsible={{ defaultOpen: true }}>
        <p>body</p>
      </Section>,
    )
    expect(html).toContain('data-slot="collapsible-trigger"')
    expect(html).toContain('body')
  })
})

describe('Section controls home', () => {
  test('a filterSlot in the controls slot renders as a FilterSet', () => {
    const slot = filterSlot([
      spec(
        memoryHandle<string>('r', 'a', {
          kind: 'enum',
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ],
        }),
        'Range',
      ),
      spec(
        memoryHandle<string>('t', 'a', { kind: 'enum', options: [{ value: 'a', label: 'A' }] }),
        'Team',
      ),
    ])
    render(<Section title="Latency" controls={slot} />)
    expect(
      section().querySelector('[data-slot="section-controls"] [data-slot="filter-set"]'),
    ).not.toBeNull()
  })
})
