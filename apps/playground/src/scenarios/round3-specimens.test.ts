/**
 * Wave 36 round 3 after-board specimens: a sectioned Button anchor, the zoned Meters' end ticks,
 * and one empty line on readiness.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it } from 'bun:test'
import { ComponentsSection } from '../demo/gallery/components'
import { TrainingScenario } from './S2Training'

afterEach(cleanup)

const mount = (ui: ReactElement) => render(createElement(MantineProvider, null, ui)).container
const anchor = (c: HTMLElement, name: string) =>
  c.querySelector<HTMLElement>(`[data-shot="${name}"]`)

describe('buttons-sections specimen', () => {
  it('carries a left and a right section', () => {
    const c = mount(createElement(ComponentsSection, { shotState: undefined }))
    const buttons = [...(anchor(c, 'buttons-sections')?.querySelectorAll('button') ?? [])]
    expect(buttons.length).toBeGreaterThan(0)
    expect(buttons.some((b) => b.querySelector('[data-position="left"]') !== null)).toBe(true)
    expect(buttons.some((b) => b.querySelector('[data-position="right"]') !== null)).toBe(true)
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
