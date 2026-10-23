/** Wave 45 round 1: the record-page recipe's fixture invariants. */
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it } from 'bun:test'
import {
  JOURNAL,
  KNOT_TITLE,
  PARTNERS_BY_SESSIONS,
  PARTNER_COUNT,
  RECENT_RATINGS,
  SESSIONS_LAST_30,
} from './learning-data'
import { BodyScenario } from './S7Body'
import { SettingsScenario } from './S6Settings'
import { OpsScenario } from './S1Ops'
import { AgentsScenario } from './S3Agents'
import { LearningScenario } from './S5Learning'
import type { ShotState } from './shot-state'

afterEach(cleanup)

const mount = (ui: ReactElement) => render(createElement(MantineProvider, null, ui)).container
const s5 = (shotState?: ShotState) => mount(createElement(LearningScenario, { shotState }))
const s3 = (shotState?: ShotState) => mount(createElement(AgentsScenario, { shotState }))

describe('S5 record page', () => {
  it('leads with a sentence that states a live number', () => {
    const summary = s5().querySelector('[data-page-summary] h2')?.textContent ?? ''
    expect(summary).not.toContain(KNOT_TITLE)
    expect(summary).toContain(String(SESSIONS_LAST_30))
    expect(summary).toMatch(/\d/)
  })

  it('draws the decision card with exactly one primary', () => {
    const card = s5().querySelector('[data-shot="learning-decision"]')
    expect(card?.textContent).toContain('Next review')
    expect(card?.querySelectorAll('button[data-variant="filled"]').length).toBe(1)
  })

  it('states the partner rows from the journal, once each', () => {
    expect(PARTNERS_BY_SESSIONS.length).toBe(PARTNER_COUNT)
    expect(RECENT_RATINGS.length).toBeLessThanOrEqual(3)
    const aside = s5().querySelector('[data-shot="learning-aside"]')?.textContent ?? ''
    for (const p of PARTNERS_BY_SESSIONS) expect(aside).toContain(p.name)
  })

  it('removes the decision and the summary where a state replaces them', () => {
    const empty = s5('empty')
    expect(empty.querySelector('[data-shot="learning-decision"]')?.textContent).toBe('')
    expect(empty.querySelector('[data-shot="learning-summary"]')?.textContent).toBe('')
    const journal = empty.querySelector('[data-shot="learning-journal"]')
    expect(journal?.textContent).toContain('No sessions logged yet')
    const logs = [...empty.querySelectorAll('button')].filter(
      (b) => b.textContent === 'Log a session',
    )
    expect(logs).toHaveLength(1)
    expect(journal?.contains(logs[0] ?? null)).toBe(true)
  })
})

describe('S3 decision', () => {
  it('has exactly one primary and leaves a board slot', () => {
    const c = s3()
    const card = c.querySelector('[data-shot="agents-decision"]')
    expect(card?.querySelectorAll('button[data-variant="filled"]').length).toBe(1)
    expect(c.querySelector('[data-shot="board"]')).not.toBeNull()
  })

  it('draws no decision when the queue is empty or failed', () => {
    for (const state of ['empty', 'error'] as const) {
      expect(s3(state).querySelector('[data-shot="agents-decision"]')?.textContent).toBe('')
    }
  })
})

describe('Wave 49 playground copy', () => {
  const text = (c: HTMLElement, name: string) =>
    c.querySelector(`[data-shot="${name}"]`)?.textContent ?? ''

  it('S7 states the weight figure once and defines INOL and the low/high window', () => {
    const c = mount(createElement(BodyScenario, {}))
    const meter = text(c, 'weight-meter-start')
    expect(meter).toContain('60-day low')
    expect(meter).toContain('60-day high')
    expect(meter).not.toMatch(/\b75\.\d\b/)
    expect(text(c, 'inol-sparks')).toContain('last 8 sessions')
    expect(text(c, 'lift-pr-spark')).toContain('last 10 sessions')
  })

  it('S1 names the packet-loss period and gives every KPI a breakdown', () => {
    const c = mount(createElement(OpsScenario, {}))
    expect(text(c, 'packet-loss')).toContain('Packet loss, 7 days')
    for (const a of ['latency-now', 'packet-loss', 'download'])
      expect(text(c, a)).toMatch(/7[- ]day|7 days/)
  })

  it('S3 titles both footer meters', () => {
    const c = mount(createElement(AgentsScenario, {}))
    expect(text(c, 'strip-footer-day')).toContain('Dispatch spend, today')
    expect(text(c, 'strip-footer-week')).toContain('Dispatch spend, last 7 days')
  })

  it('S6 names the form group by function, not "Notes" twice', () => {
    const c = mount(createElement(SettingsScenario, {}))
    const labels = [...c.querySelectorAll('label, legend, h2, h3')].map((e) => e.textContent)
    expect(labels.filter((l) => l === 'Notes').length).toBeLessThanOrEqual(1)
  })

  it('S5 journal skeleton is as tall as the loaded list', () => {
    const skeletonRows = s5('loading').querySelectorAll(
      '[data-shot="learning-journal"] [class*="Skeleton"]',
    ).length
    expect(skeletonRows).toBeGreaterThanOrEqual(Math.min(JOURNAL.length, 40))
  })
})
