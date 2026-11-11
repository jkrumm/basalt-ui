/**
 * `EmptyState`: one line of why, one action, a filtered variant whose action is Clear filters.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { IntlScope } from '../core/provider-props'
import { EmptyState } from './empty-state'

afterEach(cleanup)

const root = (): HTMLElement => {
  const el = document.querySelector<HTMLElement>('[data-slot="empty-state"]')
  if (el === null) throw new Error('no empty state')
  return el
}

describe('EmptyState', () => {
  test('renders the one line of why', () => {
    render(<EmptyState why="The queue is filtered to Blocked." />)
    expect(screen.getByText('The queue is filtered to Blocked.')).toBeDefined()
    expect(document.querySelector('[data-slot="empty-state-action"]')).toBeNull()
  })

  test('a button action calls its handler', () => {
    const onSelect = mock(() => {})
    render(<EmptyState why="No runs." action={{ label: 'Start a run', onSelect }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start a run' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  test('a link action is an anchor', () => {
    render(<EmptyState why="No runs." action={{ label: 'Open docs', href: '/docs' }} />)
    expect(screen.getByRole('link', { name: 'Open docs' }).getAttribute('href')).toBe('/docs')
  })

  test('the filtered variant renders Clear filters and calls reset', () => {
    const reset = mock(() => {})
    render(<EmptyState why="Filters hid all 12." filtered={{ reset }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(reset).toHaveBeenCalledTimes(1)
  })

  test('the filtered copy is an app override away', () => {
    render(
      <IntlScope messages={{ 'home.filtersClear': 'Filter zurücksetzen' }}>
        <EmptyState why="x" filtered={{ reset: () => {} }} />
      </IntlScope>,
    )
    expect(screen.getByRole('button', { name: 'Filter zurücksetzen' })).toBeDefined()
  })

  test('the icon renders aria-hidden', () => {
    const Icon = (p: { 'aria-hidden'?: boolean | 'true' | 'false' }) => <svg data-icon {...p} />
    render(<EmptyState why="x" icon={Icon} />)
    expect(document.querySelector('[data-icon]')?.getAttribute('aria-hidden')).toBe('true')
    expect(document.querySelector('[data-slot="empty-state-icon"]')).not.toBeNull()
  })

  test('the page tier is the default and has no ring', () => {
    render(<EmptyState why="x" />)
    expect(root().dataset['tier']).toBe('page')
    expect(root().className).not.toContain('shadow-')
  })

  test('the section tier is a ring-edged tile at the inset radius', () => {
    render(<EmptyState why="x" tier="section" />)
    expect(root().dataset['tier']).toBe('section')
    expect(root().className).toContain('shadow-[inset_0_0_0_1px')
    expect(root().className).toContain('rounded-inset')
  })

  test('the line is md on a page and sm in a section, never two sizes in one tile', () => {
    render(<EmptyState why="x" />)
    expect(document.querySelector('[data-slot="empty-state-why"]')?.className).toContain('text-md')
    cleanup()
    render(<EmptyState why="x" tier="section" />)
    expect(document.querySelector('[data-slot="empty-state-why"]')?.className).toContain('text-sm')
  })

  test('server markup carries the slots', () => {
    const html = renderToString(<EmptyState why="x" action={{ label: 'Go', href: '/' }} />)
    expect(html).toContain('data-slot="empty-state-why"')
    expect(html).toContain('data-slot="empty-state-action"')
  })
})
