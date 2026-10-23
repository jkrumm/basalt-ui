/** Wave 49: the copy fixes the W48 audit found in the playground scenarios (S1, S3, S5, S6, S7). */
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it } from 'bun:test'
import { BODY, INOL_DEFINITION } from './body/body-data'
import { JOURNAL } from './learning-data'
import { OpsScenario } from './S1Ops'
import { AgentsScenario } from './S3Agents'
import { LearningScenario } from './S5Learning'
import { SettingsScenario } from './S6Settings'
import { BodyScenario } from './S7Body'
import type { ShotState } from './shot-state'

afterEach(cleanup)

const mount = (ui: ReactElement) => render(createElement(MantineProvider, null, ui)).container
const text = (c: HTMLElement, name: string) =>
  c.querySelector(`[data-shot="${name}"]`)?.textContent ?? ''
const shotState: ShotState | undefined = undefined

describe('S7 body', () => {
  const body = () => mount(createElement(BodyScenario, { shotState }))

  it('scopes the weight meter to its 60-day window and keeps the weight as the headline', () => {
    const meter = text(body(), 'weight-meter-start')
    expect(meter).toContain('60-day range')
    expect(meter).toContain('60-day low')
    expect(meter).toContain('60-day high')
    expect(meter).toContain(String(BODY.weightKg))
  })

  it('names the period of every sparkline and defines INOL once', () => {
    const c = body()
    expect(text(c, 'inol-sparks')).toContain('last 8 sessions')
    expect(text(c, 'lift-pr-spark')).toContain('last 10 sessions')
    expect(INOL_DEFINITION).toContain('Intensity-Number of Lifts')
  })
})

describe('S1 ops', () => {
  it('names the packet-loss period and gives every KPI the same breakdown slot', () => {
    const c = mount(createElement(OpsScenario, { shotState }))
    expect(text(c, 'packet-loss')).toContain('Packet loss, 7 days')
    for (const anchor of ['latency-now', 'packet-loss', 'download'])
      expect(text(c, anchor)).toMatch(/7[- ]day|7 days/)
  })
})

describe('S3 agents', () => {
  it('titles both footer meters', () => {
    const c = mount(createElement(AgentsScenario, { shotState }))
    expect(text(c, 'strip-footer-day')).toContain('Dispatch spend, today')
    expect(text(c, 'strip-footer-week')).toContain('Dispatch spend, last 7 days')
  })
})

describe('S5 learning', () => {
  it('sizes the journal skeleton to the loaded list', () => {
    const skeletonRows = mount(
      createElement(LearningScenario, { shotState: 'loading' }),
    ).querySelectorAll('[data-shot="learning-journal"] [class*="Skeleton"]').length
    expect(skeletonRows).toBeGreaterThanOrEqual(Math.min(JOURNAL.length, 40))
  })
})

describe('S6 settings', () => {
  it('names the form group by its function and leaves "Notes" to the field', () => {
    const c = mount(createElement(SettingsScenario, { shotState }))
    const labels = [...c.querySelectorAll('label, legend, h2, h3')].map((e) => e.textContent)
    expect(labels).toContain('Set details')
    expect(labels.filter((l) => l === 'Notes').length).toBe(1)
  })
})
