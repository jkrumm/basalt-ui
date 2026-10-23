/** Wave 43 round 3: each assertion is one playground defect the r2 S7 and S8 crops showed. */
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it } from 'bun:test'
import { BodyScenario } from './S7Body'
import { MapScenario } from './S8Map'
import type { ShotState } from './shot-state'

afterEach(cleanup)

const mount = (ui: ReactElement) => render(createElement(MantineProvider, null, ui)).container
const body = (shotState: ShotState | undefined) => mount(createElement(BodyScenario, { shotState }))
const shot = (c: HTMLElement, name: string) => c.querySelector(`[data-shot="${name}"]`)
const occurrences = (text: string, needle: string) => text.split(needle).length - 1

describe('S7 body, r3', () => {
  it('gives the e1RM sparks their own empty reason, not the INOL one', () => {
    const c = body('empty')
    for (const name of ['lift-pr-spark', 'strip-squat', 'strip-press']) {
      const el = shot(c, name)
      if (el === null) continue
      expect(el.textContent).not.toContain('INOL')
    }
    expect(shot(c, 'lift-pr-spark')?.textContent).toContain('No estimated 1RM')
  })

  it('renders a loading state in the INOL card, not the data', () => {
    const el = shot(body('loading'), 'inol-sparks')
    expect(el?.textContent).not.toContain('0.88')
    expect(el?.textContent).not.toContain('1.35')
  })

  it('words the INOL gap and the caliper gap once', () => {
    const c = body('empty')
    const inol = shot(c, 'inol-sparks')?.textContent ?? ''
    const zone = shot(c, 'zone-readout')?.textContent ?? ''
    for (const t of [inol, zone]) {
      expect(t).toContain('No sessions logged in this window')
      expect(t).toContain('INOL needs at least two sessions per lift.')
    }
    const skin = shot(c, 'skinfold-history')?.textContent ?? ''
    const row = shot(c, 'empty-row')?.textContent ?? ''
    for (const t of [skin, row]) expect(t).toContain('No caliper session in this window')
    expect(skin).not.toContain('listed')
  })

  it('gives every skinfold row a distinct date label', () => {
    const times = [...(shot(body(undefined), 'skinfold-history')?.querySelectorAll('time') ?? [])]
    expect(times.length).toBe(5)
    const labels = times.map((t) => t.firstChild?.textContent)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('keeps the empty row out of the weight strip anchor', () => {
    const empty = body('empty')
    const row = shot(empty, 'empty-row')
    expect(row).not.toBeNull()
    expect(shot(empty, 'weight-strip')?.contains(row ?? null)).toBe(false)
  })

  it('states body fat and lean mass once, with the change since the last reading', () => {
    const c = body(undefined)
    const text = c.textContent ?? ''
    expect(occurrences(text, 'Body fat')).toBe(1)
    expect(occurrences(text, 'Lean mass')).toBe(1)
    expect(shot(c, 'weight-strip')?.textContent).toContain('vs 5 Oct')
  })
})

describe('S8 map, r3', () => {
  it('hides the key under empty and error', () => {
    for (const s of ['empty', 'error'] as const) {
      expect(shot(mount(createElement(MapScenario, { shotState: s })), 'map-key')).toBeNull()
    }
    expect(
      shot(mount(createElement(MapScenario, { shotState: undefined })), 'map-key'),
    ).not.toBeNull()
  })
})
