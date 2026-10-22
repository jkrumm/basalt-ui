/** Wave 43 round 2: each assertion is one playground defect the r1 S7 and S8 crops showed. */
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it } from 'bun:test'
import { BODY } from './body/body-data'
import { BodyScenario } from './S7Body'
import { MapScenario } from './S8Map'
import type { ShotState } from './shot-state'

afterEach(cleanup)

const mount = (ui: ReactElement) => render(createElement(MantineProvider, null, ui)).container
const body = (shotState: ShotState | undefined) =>
  mount(createElement(BodyScenario, { shotState })).textContent ?? ''
const map = (shotState: ShotState | undefined) =>
  mount(createElement(MapScenario, { shotState })).textContent ?? ''

describe('S7 body', () => {
  it('words the weigh-in gap and the weight failure once', () => {
    const empty = body('empty')
    expect(empty).not.toContain('No weigh-in in')
    expect(empty).not.toContain('No weigh-ins in this window,')
    const error = body('error')
    expect(error).not.toContain('The weight source')
    expect(error).toContain('The weight log did not answer. Retry')
  })

  it('gives every error state a Retry', () => {
    const c = mount(createElement(BodyScenario, { shotState: 'error' }))
    expect(c.querySelectorAll('button').length).toBeGreaterThanOrEqual(7)
  })

  it('states one body-fat and lean-mass reading with its date', () => {
    const text = body(undefined)
    expect(text).toContain(String(BODY.fatPct))
    expect(text).toContain(`Measured ${BODY.measured}`)
    expect(text).not.toContain('18.4')
    expect(text).not.toContain('66.9')
  })

  it('renders an empty state in the skinfold table and a next step', () => {
    const c = mount(createElement(BodyScenario, { shotState: 'empty' }))
    const table = c.querySelector('[data-shot="skinfold-history"]')
    expect(table?.textContent).not.toContain('Delete')
    expect(table?.textContent).toContain('Log a session')
  })
})

describe('S8 map', () => {
  it('names the area and the night, and places the field', () => {
    const text = map(undefined)
    expect(text).toContain('Cloud cover, Harrow Coast')
    expect(text).toContain('Night of Fri 23 Oct')
    expect(text).toContain('Port Elden')
    expect(text).toContain('Fri 23:00')
  })

  it('hides the scrubber under empty and error', () => {
    for (const s of ['empty', 'error'] as const) {
      expect(
        mount(createElement(MapScenario, { shotState: s })).querySelector(
          '[data-shot="map-scrubber"]',
        ),
      ).toBeNull()
    }
  })
})
