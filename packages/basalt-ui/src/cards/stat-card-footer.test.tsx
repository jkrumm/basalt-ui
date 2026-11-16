/** `StatCard` footer in a loading or failed card: no figure shows beside a state that says none. */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { StatCardProps } from './contract'
import { StatCard } from './stat-card'

afterEach(cleanup)

const footer = [
  { label: 'Peak', value: 5 },
  { label: 'Open', value: '12' },
]
const facts = (): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>('[data-slot="stat-footer"] dd'),
]
const labels = (): (string | null)[] =>
  [...document.querySelectorAll('[data-slot="stat-footer"] dt')].map((dt) => dt.textContent)

function card(props: Partial<StatCardProps>): void {
  render(<StatCard title="Leads" value={9} footer={footer} {...(props as object)} />)
}

describe('StatCard footer by phase', () => {
  test('ready prints the values', () => {
    card({})
    expect(facts().map((dd) => dd.textContent)).toEqual(['5', '12'])
  })

  test('loading draws a bar per value, keeps the labels and prints no figure', () => {
    card({ phase: 'loading' })
    expect(labels()).toEqual(['Peak', 'Open'])
    expect(facts().map((dd) => dd.textContent)).toEqual(['', ''])
    expect(facts().every((dd) => dd.querySelector('[aria-hidden="true"]') !== null)).toBe(true)
    expect(document.querySelector('[data-slot="stat-footer"]')?.textContent).not.toMatch(/\d/)
  })

  test('error prints the muted dash for each value', () => {
    card({ phase: { tag: 'error', retry: () => undefined } })
    expect(labels()).toEqual(['Peak', 'Open'])
    expect(facts().map((dd) => dd.textContent)).toEqual(['–', '–'])
    expect(facts()[0]?.className).toContain('text-muted-foreground')
  })

  test('the footer row keeps its height at every phase', () => {
    for (const phase of ['ready', 'loading', { tag: 'error', retry: () => undefined }] as const) {
      card({ phase })
      expect(document.querySelector('[data-slot="stat-footer"]')?.className).toContain('h-10')
      cleanup()
    }
  })
})
