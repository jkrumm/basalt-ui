/**
 * `ChartCard`'s `facts` slot: the headline figure, its unit, a comparison and the period the figure
 * covers, under the title. The value is the proportional sans (Wave 35 typography law), the line wraps
 * at half width and never clips the value, and facts take the subtitle row's place.
 */
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'bun:test'
import { ChartCard } from './ChartCard'

const css = readFileSync(new URL('./chart-card.module.css', import.meta.url), 'utf8')
const rule = (selector: string): string =>
  css.match(new RegExp(`\\.${selector}\\b[^{]*\\{([^}]*)\\}`))?.[1] ?? ''

const facts = (el: HTMLElement): HTMLElement | null => el.querySelector('[data-basalt-facts]')

describe('ChartCard facts', () => {
  test('renders value, unit, comparison, period in order', () => {
    const { container } = render(
      <ChartCard
        title="Sleep"
        facts={{ value: '7.4', unit: 'h', comparison: <b>+0.3</b>, period: 'last 30 d' }}
      />,
    )
    const text = facts(container)?.textContent ?? ''
    expect(text.indexOf('7.4')).toBeGreaterThanOrEqual(0)
    expect(text.indexOf('7.4')).toBeLessThan(text.indexOf('h'))
    expect(text.indexOf('h')).toBeLessThan(text.indexOf('+0.3'))
    expect(text.indexOf('+0.3')).toBeLessThan(text.indexOf('last 30 d'))
  })

  test('an array renders several facts in a row', () => {
    const { container } = render(
      <ChartCard title="HRV" facts={[{ value: '52' }, { value: '61', period: 'peak' }]} />,
    )
    expect(container.querySelectorAll('[data-basalt-fact]').length).toBe(2)
    expect(facts(container)?.textContent).toContain('peak')
  })

  test('the value face is not mono', () => {
    expect(rule('factValue')).not.toContain('mono')
    expect(rule('factValue')).toContain('--basalt-font-sans')
    expect(rule('factValue')).not.toContain('tabular-nums')
  })

  test('the period text is present and muted', () => {
    const { getByText } = render(
      <ChartCard title="T" facts={{ value: '1', period: 'last 30 d' }} />,
    )
    expect(getByText('last 30 d')).toBeTruthy()
    expect(rule('factPeriod')).toContain('--vx-muted')
  })

  test('wraps at a narrow container: no nowrap, no ellipsis on the value', () => {
    for (const name of ['factsRow', 'fact', 'factValue']) {
      expect(rule(name)).not.toContain('nowrap')
      expect(rule(name)).not.toContain('ellipsis')
    }
    expect(rule('factsRow')).toContain('flex-wrap: wrap')
  })

  test('the rendered value node is the factValue element', () => {
    const { container } = render(<ChartCard title="T" facts={{ value: '7.4' }} />)
    // Bun's test loader maps CSS-module classes to '', so the value node is found by its data hook;
    // the face itself is pinned against the `.factValue` rule in the CSS test above.
    expect(container.querySelector('[data-basalt-fact-value]')?.textContent).toBe('7.4')
  })

  test('facts alone render, with no title', () => {
    const { container } = render(<ChartCard facts={{ value: '7.4', period: 'last 30 d' }} />)
    expect(facts(container)?.textContent).toContain('last 30 d')
  })

  test('a subtitle stays as the muted basis line after the facts row', () => {
    const { container, getByText } = render(
      <ChartCard title="T" subtitle="7-day rolling" facts={{ value: '1' }} />,
    )
    const basis = getByText('7-day rolling')
    expect(basis.hasAttribute('data-basalt-facts-basis')).toBe(true)
    const root = facts(container)
    expect(root?.contains(basis)).toBe(true)
    expect(root?.lastElementChild).toBe(basis)
  })

  test('facts show only at rest: hidden while pending, in error and when empty', () => {
    const f = { value: '7.4' }
    const pending = render(<ChartCard title="T" facts={f} state={{ pending: true }} />)
    expect(facts(pending.container)).toBeNull()
    pending.unmount()
    const rest = render(<ChartCard title="T" facts={f} />)
    expect(facts(rest.container)).not.toBeNull()
    rest.unmount()
    const error = render(<ChartCard title="T" facts={f} state={{ error: new Error('x') }} />)
    expect(facts(error.container)).toBeNull()
    error.unmount()
    const empty = render(<ChartCard title="T" facts={f} state={{ empty: true }} />)
    expect(facts(empty.container)).toBeNull()
  })

  test('facts and the legacy value/delta hero are exclusive in the type', () => {
    // @ts-expect-error `value` is `undefined` when `facts` is set
    const bad = <ChartCard title="T" facts={{ value: '1' }} value="2" />
    expect(bad).toBeTruthy()
  })

  test('no facts: header unchanged', () => {
    const { container, queryByText } = render(<ChartCard title="T" subtitle="Basis" />)
    expect(facts(container)).toBeNull()
    expect(queryByText('Basis')).not.toBeNull()
  })
})
