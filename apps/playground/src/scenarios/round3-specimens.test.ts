/**
 * Wave 36 round 3 after-board specimens: a sectioned Button anchor, the zoned Meters' end ticks,
 * one empty line on readiness, and a goal line that does not collide with its series.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it } from 'bun:test'
import { ComponentsSurfaces } from '../demo/ComponentsPage'
import { TrainingScenario } from './S2Training'

afterEach(cleanup)

const mount = (ui: ReactElement) => render(createElement(MantineProvider, null, ui)).container
const anchor = (c: HTMLElement, name: string) =>
  c.querySelector<HTMLElement>(`[data-shot="${name}"]`)

describe('buttons-sections specimen', () => {
  it('carries left and right sections at xs/sm/md in default and filled', () => {
    const c = mount(createElement(ComponentsSurfaces, null))
    const buttons = [...(anchor(c, 'buttons-sections')?.querySelectorAll('button') ?? [])]
    expect(buttons.length).toBeGreaterThan(0)
    const sizes = new Set(buttons.map((b) => b.getAttribute('data-size')))
    expect([...sizes].toSorted()).toEqual(['md', 'sm', 'xs'])
    const variants = new Set(buttons.map((b) => b.getAttribute('data-variant')))
    expect([...variants].toSorted()).toEqual(['default', 'filled'])
    for (const size of sizes) {
      for (const variant of variants) {
        const cell = buttons.filter(
          (b) => b.getAttribute('data-size') === size && b.getAttribute('data-variant') === variant,
        )
        expect(cell.some((b) => b.querySelector('[data-position="left"]') !== null)).toBe(true)
        expect(cell.some((b) => b.querySelector('[data-position="right"]') !== null)).toBe(true)
      }
    }
  })
})

describe('S2 zoned Meter end ticks', () => {
  const ends = (name: string) => {
    const c = mount(createElement(TrainingScenario, { shotState: undefined }))
    return [...(anchor(c, name)?.querySelectorAll('[data-meter-tick-label]') ?? [])].map(
      (n) => n.textContent,
    )
  }

  it('training load shows 0 and 2.0 as end ticks', () => {
    expect(ends('training-load')).toEqual(['0', '2.0'])
  })

  it('readiness shows 0 and 100 as end ticks, with no detached scale caption', () => {
    expect(ends('readiness')).toEqual(['0', '100'])
    const c = mount(createElement(TrainingScenario, { shotState: undefined }))
    expect(anchor(c, 'readiness')?.textContent).not.toContain('Scale 0–100')
  })

  it('readiness empty states the absence once', () => {
    const c = mount(createElement(TrainingScenario, { shotState: 'empty' }))
    const text = anchor(c, 'readiness')?.textContent ?? ''
    expect(text).toContain('No readiness reading today')
    expect(text).not.toContain('No contributor has a reading')
  })
})
