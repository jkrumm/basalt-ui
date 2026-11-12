/**
 * `hydrate.subpath` (quality-contract section 10, section 5): the rows that run now, `tokens` and
 * `.`, hydrate clean with `de-DE` and `Europe/Berlin`, and the positive control raises. The `full`
 * row has no fixture yet and is reported as not covered, never as passed.
 *
 * Hydration needs jsdom, so these cases only run in the jsdom lane; under the default happy-dom
 * process they are skipped and `hydrate.subpath.lane.test.ts` runs them in a child.
 */
import { afterEach, describe, expect, test } from 'bun:test'

import { domRunner } from '../../../src/testing/dom-shims'
import { expectHydrates, fixturePath, rowStatus } from './harness'
import type { Fixture } from './harness'
import { expected } from './fixtures/root'

const OPTIONS = { locale: 'de-DE', timeZone: 'Europe/Berlin' } as const

const tokens: Fixture = { name: 'tokens', entry: fixturePath('tokens'), document: true }
const root: Fixture = { name: 'root', entry: fixturePath('root') }
const control: Fixture = { name: 'control', entry: fixturePath('control') }

const jsdom = domRunner() === 'jsdom'

afterEach(() => {
  localStorage.clear()
})

describe.skipIf(!jsdom)('hydrate.subpath', () => {
  test('tokens: the document hydrates clean and the boot script has stamped data-theme', async () => {
    localStorage.setItem('basalt:scheme', 'dark')
    const report = await expectHydrates(tokens, OPTIONS)
    expect(report.html).toContain('--vx-')
    expect(report.html).toContain('data-theme')
    expect(report.theme).toBe('dark')
  }, 60_000)

  test('.: de-DE and Europe/Berlin print identically on both sides, and lang arrives in an effect', async () => {
    const report = await expectHydrates(root, OPTIONS)
    const figures = expected(OPTIONS)
    for (const figure of figures) expect(report.html).toContain(figure.replaceAll('&', '&amp;'))
    // Berlin is already the next day for the fixture moment: the zone reached the server render.
    expect(report.html).toContain('2.')
    expect(report.html).not.toContain(' lang=')
    expect(report.lang).toBe('de-DE')
  }, 60_000)

  test('positive control: Math.random() in a value raises Hydration failed', async () => {
    await expect(expectHydrates(control, OPTIONS)).rejects.toThrow(/Hydration failed/)
  }, 60_000)
})

describe('hydrate.subpath coverage', () => {
  test('the full row is reported as not covered while no such fixture exists', () => {
    expect(rowStatus('tokens')).toBe('covered')
    expect(rowStatus('root')).toBe('covered')
    expect(rowStatus('full')).toBe('not covered')
  })

  // A todo is reported as pending, never as passed; it becomes a real case when `fixtures/full.tsx`
  // lands (`rowStatus('full')` flips and the test above then fails, forcing this one to be written).
  test.todo('full: the shell and page fixture hydrates clean (no fixture yet)', () => {})
})
