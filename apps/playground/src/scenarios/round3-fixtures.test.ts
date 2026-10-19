/**
 * Wave 36 round 1 fixture fixes: each assertion is one defect the round's crops showed.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { readdirSync, readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'bun:test'
import { ComponentsSurfaces } from '../demo/ComponentsPage'
import { STUCK } from './agents-data'
import { fmtEurCompact, fmtRatio } from './fixture-utils'
import { LOAD_RATIO, READINESS_SCORE } from './training-data'
import { AgentsScenario } from './S3Agents'
import { SpendScenario } from './S4Spend'
import { TrainingScenario } from './S2Training'
import { cardStateProps } from './shot-state'
import type { ShotState } from './shot-state'

afterEach(cleanup)

const mount = (ui: ReactElement) => render(createElement(MantineProvider, null, ui)).container
const anchor = (c: HTMLElement, name: string) =>
  c.querySelector<HTMLElement>(`[data-shot="${name}"]`)
const source = (file: string): string => readFileSync(new URL(file, import.meta.url), 'utf8')

const SCENARIOS = [
  ['S3', AgentsScenario],
  ['S4', SpendScenario],
] as const

describe('strip cells in empty and error', () => {
  it.each(SCENARIOS)('%s: every empty cell says why', (_, Scenario) => {
    const c = mount(createElement(Scenario, { shotState: 'empty' }))
    const cells = [...c.querySelectorAll('[data-strip-cell]')]
    expect(cells.length).toBeGreaterThan(0)
    for (const cell of cells) {
      // W37 r2: the budget cell keeps the cap as its hero and says why in its footer, not a `p`.
      const reason = cell.querySelector('p') ?? cell.querySelector('[data-strip-footer]')
      expect(reason?.textContent?.length ?? 0).toBeGreaterThan(10)
    }
  })

  it.each(SCENARIOS)('%s: every error cell fails visibly and offers Retry', (_, Scenario) => {
    const c = mount(createElement(Scenario, { shotState: 'error' }))
    const cells = [...c.querySelectorAll('[data-strip-cell]')]
    expect(cells.length).toBeGreaterThan(0)
    for (const cell of cells) {
      expect(cell.querySelector('[data-strip-state="error"]')).not.toBeNull()
      const retry = [...cell.querySelectorAll('button')].find((b) => b.textContent === 'Retry')
      expect(retry).toBeDefined()
    }
  })

  it('S3: the budget footer is declared absent in empty and error, and absent there', () => {
    const rest = mount(createElement(AgentsScenario, { shotState: undefined }))
    for (const name of ['strip-footer-day', 'strip-footer-week']) {
      const declared = [...rest.querySelectorAll(`[data-shot="${name}"][data-shot-absent]`)]
      expect(declared.map((n) => n.getAttribute('data-shot-absent'))).toEqual(['empty error'])
    }
    cleanup()
    for (const s of ['empty', 'error'] as const) {
      const c = mount(createElement(AgentsScenario, { shotState: s }))
      expect(c.querySelector('[data-shot^="strip-footer"]')).toBeNull()
      cleanup()
    }
  })
})

describe('retry', () => {
  it('no scenario imports RETRY_ACTION and the helper file is gone', () => {
    const files = readdirSync(new URL('.', import.meta.url)).filter((f) => !f.includes('.test.'))
    expect(files).not.toContain('retry-action.tsx')
    for (const f of files.filter((n) => n.endsWith('.ts') || n.endsWith('.tsx'))) {
      expect(source(f)).not.toContain('RETRY_ACTION')
    }
  })

  it('cardStateProps retries through onRetry, not a stateAction', () => {
    const props = cardStateProps('error', 'boom', 72, 'none')
    expect(typeof props.onRetry).toBe('function')
    expect('stateAction' in props).toBe(false)
  })

  it.each<ShotState>(['error'])('S4 charts render one shared Retry button in %s', (s) => {
    const c = mount(createElement(SpendScenario, { shotState: s }))
    for (const name of ['spend-over-time', 'spend-distribution']) {
      const buttons = [...(anchor(c, name)?.querySelectorAll('button') ?? [])].filter(
        (b) => b.textContent === 'Retry',
      )
      expect(buttons).toHaveLength(1)
    }
  })
})

describe('S2 / S3 / S4 encodings', () => {
  // Wave 37 r1 changed this law: six discrete monthly values are bars, not a smoothed line.
  it('S2 hit rate is one bar per month with the goal as a labelled reference', () => {
    const src = source('./S2Training.tsx')
    expect(src).toContain('<Bars')
    expect(src).not.toContain('<Lines')
    expect(src).toContain('label: `Goal ${GOAL_SESSIONS}`')
    expect(src).toContain('xTicks={HIT_TICKS}')
  })

  it('S3 item flow is two lines, not grouped bars', () => {
    const src = source('./S3Agents.tsx')
    expect(src).toContain('<Lines')
    expect(src).not.toContain('<Bars')
    expect(src).not.toContain('layout="grouped"')
  })

  it('S4 cumulative spend ticks carry the €', () => {
    expect(fmtEurCompact(400)).toBe('€400')
    expect(fmtEurCompact(1200)).toMatch(/^€1\.?2?K$/i)
    expect(source('./S4Spend.tsx')).toContain('format: fmtEurCompact')
    const c = mount(createElement(SpendScenario, { shotState: undefined }))
    const card = anchor(c, 'spend-over-time')
    // W38: the headline is the day the forecast reaches the budget, a date, not a figure.
    expect(card?.querySelector('[data-basalt-fact-value]')?.textContent).toMatch(/^\d+ \w+$/)
    const ticks = [...(card?.querySelectorAll('svg text') ?? [])].map((t) => t.textContent ?? '')
    expect(ticks.filter((t) => /^€\d/.test(t)).length).toBeGreaterThanOrEqual(3)
  })
})

describe('S3 stuck items at a phone width', () => {
  it('keeps all nine items with the title alone as the label', () => {
    const c = mount(createElement(AgentsScenario, { shotState: undefined }))
    const rows = [...(anchor(c, 'stuck-items')?.querySelectorAll('li') ?? [])]
    expect(rows).toHaveLength(9)
    expect(rows.map((r) => r.querySelector('[title]')?.getAttribute('title'))).toEqual(
      STUCK.map((i) => i.title),
    )
  })

  it('exposes the reason on every blocked row, as a short phrase', () => {
    const c = mount(createElement(AgentsScenario, { shotState: undefined }))
    const rows = [...(anchor(c, 'stuck-items')?.querySelectorAll('li') ?? [])]
    const blocked = STUCK.filter((i) => i.state === 'blocked')
    expect(blocked).toHaveLength(3)
    for (const item of blocked) {
      const row = rows[STUCK.indexOf(item)]
      expect(row?.querySelector('[data-verdict-word]')?.textContent).toBe(
        `Blocked · ${item.reason}`,
      )
      expect((item.reason ?? '').split(/\s+/).length).toBeLessThanOrEqual(2)
    }
  })

  it('keeps titles short enough for one line at 390 px', () => {
    // Measured at 390 px beside the widest status (`Blocked · Failing check`): 25 characters hold one line.
    const TITLE_MAX = 25
    for (const item of STUCK) expect(item.title.length).toBeLessThanOrEqual(TITLE_MAX)
  })
})

describe('components buttons specimen', () => {
  const FONT_SIZES_PER_ANCHOR = 3

  it('splits the buttons into anchors and drops no button', () => {
    const c = mount(createElement(ComponentsSurfaces, null))
    expect(anchor(c, 'buttons')).toBeNull()
    const anchors = [...c.querySelectorAll('[data-shot^="buttons-"]')]
    expect(anchors.length).toBeGreaterThanOrEqual(3)
    const labels = anchors.flatMap((a) =>
      [...a.querySelectorAll('button')].map((b) => b.textContent),
    )
    expect(labels).toEqual(
      expect.arrayContaining([
        'Filled',
        'Default',
        'Light',
        'Outline',
        'Subtle',
        'Extra small',
        'Small',
        'Medium',
        'Large',
        'Disabled',
      ]),
    )
  })

  it('keeps at most three Button sizes in one anchor', () => {
    const c = mount(createElement(ComponentsSurfaces, null))
    for (const a of c.querySelectorAll('[data-shot^="buttons-"]')) {
      const sizes = new Set(
        [...a.querySelectorAll('button')].map((b) => b.getAttribute('data-size') ?? 'default'),
      )
      expect(sizes.size).toBeLessThanOrEqual(FONT_SIZES_PER_ANCHOR)
    }
  })
})

describe('list and Meter cards in empty and loading', () => {
  // W38 r4: the card takes the state too, so no loaded headline prints above an empty or pending body.
  const CARDS = [
    [TrainingScenario, 'training-load', fmtRatio(LOAD_RATIO)],
    [TrainingScenario, 'goal', 'ahead of pace'],
    [TrainingScenario, 'readiness', `${READINESS_SCORE}of 100`],
    [TrainingScenario, 'top-lifts', 'of volume'],
    [AgentsScenario, 'stuck-items', `${STUCK.length}items`],
    [SpendScenario, 'spend-by-project', 'of spend in'],
    [SpendScenario, 'top-drivers', 'added by'],
  ] as const

  it.each(['empty', 'loading'] as const)('%s: no card prints its loaded headline', (shotState) => {
    for (const [Scenario, name, headline] of CARDS) {
      const c = mount(createElement(Scenario, { shotState }))
      expect(anchor(c, name)?.textContent ?? '').not.toContain(headline)
      cleanup()
    }
  })
})
