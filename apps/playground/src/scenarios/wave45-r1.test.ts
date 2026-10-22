/** Wave 45 round 1: the record-page recipe's fixture invariants. */
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it } from 'bun:test'
import {
  KNOT_TITLE,
  PARTNERS_BY_SESSIONS,
  PARTNER_COUNT,
  RECENT_RATINGS,
  SESSIONS_LAST_30,
} from './learning-data'
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
    expect(summary).toContain(KNOT_TITLE)
    expect(summary).toContain(String(SESSIONS_LAST_30))
    expect(summary).toMatch(/\d/)
  })

  it('draws the decision card with exactly one primary', () => {
    const card = s5().querySelector('[data-shot="learning-decision"]')
    expect(card?.textContent).toContain(`Review ${KNOT_TITLE} now?`)
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
    expect(empty.textContent).toContain('No sessions logged yet')
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
