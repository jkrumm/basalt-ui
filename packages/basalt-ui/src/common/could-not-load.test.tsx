import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { ChartCard } from '../charts/ChartCard'
import { couldNotLoad } from './could-not-load'

afterEach(cleanup)

describe('couldNotLoad', () => {
  test.each([undefined, '', '   '])('%p stays bare', (label) => {
    expect(couldNotLoad(label)).toBe('Could not load')
  })
  test.each([
    ['A', 'A'],
    ['  Revenue  ', 'revenue'],
    ['Revenue', 'revenue'],
    ['KPI', 'KPI'],
    ['MRR', 'MRR'],
    ['2024 sales', '2024 sales'],
    ['(Revenue)', '(Revenue)'],
  ])('%p → %p', (label, noun) => {
    expect(couldNotLoad(label)).toBe(`Could not load ${noun}`)
  })
})

describe('ChartCard error noun', () => {
  const alert = (props: { title?: string; stateNoun?: string }): string =>
    render(<ChartCard {...props} state={{ error: new Error('boom') }} />).container.querySelector(
      '[role="alert"]',
    )?.textContent ?? ''
  test('neither title nor stateNoun: bare, no "undefined", no trailing space', () => {
    const text = alert({})
    expect(text).not.toContain('undefined')
    expect(text).toMatch(/^Could not load(?! )/)
  })
  test('stateNoun wins over title', () => {
    expect(alert({ title: 'Revenue', stateNoun: 'stuck items' })).toContain(
      'Could not load stuck items',
    )
  })
})
