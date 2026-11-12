/**
 * The meta-test (quality-contract section 4): every assertion has a seeded offender under
 * `offenders/` that it must fail, and the clean page must pass all of them, so an offender fails for
 * its defect and not for the harness. An assertion without an offender is deleted.
 *
 * Runs with the matrix (`BASALT_MATRIX` set); the root `bun test` skips it.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { Page } from 'playwright-core'
import { quality } from '../../../src/testing/quality'
import type { PageLike } from '../../../src/testing/quality'
import { fit, forcedColors, hitFloor, hitOverlap, reducedMotion } from './assertions'
import { bootMatrix } from './harness'

const enabled = process.env['BASALT_MATRIX'] !== undefined && process.env['BASALT_MATRIX'] !== ''
const harness = enabled ? await bootMatrix() : null
afterAll(async () => {
  await harness?.close()
}, 30_000)

/** A Playwright `Page` is a `PageLike` as is: this line is the structural-typing proof (tsc). */
const like = (page: Page): PageLike => page

type Case = {
  /** The assertion under test. */
  assertion: string
  offender: string
  run: (page: Page) => Promise<unknown>
  /** What the failure must say, so the offender is failing for its own defect. */
  fails: RegExp
  /** Run `setScheme` on the loaded page first. */
  scheme?: 'dark'
}

const CASES: Case[] = [
  {
    assertion: 'axe',
    offender: 'axe-image-alt',
    run: (p) => quality.axe(like(p)),
    fails: /image-alt \(critical\)/,
  },
  {
    assertion: 'axe (overlay open)',
    offender: 'axe-overlay',
    run: (p) => quality.axe(like(p), { overlays: ['dialog'] }),
    fails: /button-name[\s\S]*|with the dialog open/,
  },
  {
    assertion: 'overflow',
    offender: 'overflow',
    run: (p) => quality.overflow(like(p)),
    fails: /document scrollWidth 20\d\d/,
  },
  {
    assertion: 'ringWalk (none)',
    offender: 'ring-none',
    run: (p) => quality.ringWalk(like(p)),
    fails: /no focus outline/,
  },
  {
    assertion: 'ringWalk (translucent)',
    offender: 'ring-translucent',
    run: (p) => quality.ringWalk(like(p)),
    fails: /translucent|under 3:1/,
  },
  {
    assertion: 'ringWalk (clipped)',
    offender: 'ring-clipped',
    run: (p) => quality.ringWalk(like(p)),
    fails: /clipped by div/,
  },
  {
    assertion: 'focusNotObscured',
    offender: 'focus-obscured',
    run: (p) => quality.focusNotObscured(like(p)),
    fails: /covered at/,
  },
  {
    assertion: 'textSpacing',
    offender: 'text-spacing',
    run: (p) => quality.textSpacing(like(p)),
    fails: /text clipped/,
  },
  {
    assertion: 'setScheme',
    offender: 'no-theme',
    run: (p) => quality.setScheme(like(p), 'dark'),
    fails: /expected data-theme="dark"/,
    scheme: 'dark',
  },
  {
    assertion: 'forcedColors',
    offender: 'forced-colors',
    run: forcedColors,
    fails: /frame vanishes/,
  },
  { assertion: 'fit', offender: 'fit', run: fit, fails: /overflows its box/ },
  {
    assertion: 'reducedMotion',
    offender: 'reduced-motion',
    run: reducedMotion,
    fails: /animations run under/,
  },
  {
    assertion: 'hitFloor',
    offender: 'hit-floor',
    run: (p) => hitFloor(p, 'fine'),
    fails: /smaller than the floor/,
  },
  { assertion: 'hitOverlap', offender: 'hit-overlap', run: hitOverlap, fails: /hit boxes overlap/ },
]

async function openOffender(name: string): Promise<Page> {
  if (harness === null) throw new Error('no harness')
  const page = await harness.open({ width: 1280, height: 800 })
  await page.goto(harness.offenderUrl(name))
  return page
}

describe.skipIf(harness === null)('seeded offenders', () => {
  test.each(CASES)(
    '$assertion fails on offenders/$offender',
    async (c) => {
      const page = await openOffender(c.offender)
      try {
        // Not `expect(promise).rejects`: under bun it was observed to stall on a promise that Playwright settles.
        const error = await c.run(page).then(
          () => null,
          (thrown: unknown) => thrown,
        )
        expect(error, `${c.offender} did not fail ${c.assertion}`).toBeInstanceOf(Error)
        expect((error as Error).message).toMatch(c.fails)
      } finally {
        await page.context().close()
      }
    },
    170_000,
  )

  test('every assertion of the matrix has an offender', () => {
    const covered = CASES.map((c) => c.assertion.split(' ')[0])
    for (const name of [
      'axe',
      'overflow',
      'ringWalk',
      'focusNotObscured',
      'textSpacing',
      'setScheme',
      'forcedColors',
      'fit',
      'reducedMotion',
      'hitFloor',
      'hitOverlap',
    ]) {
      expect(covered).toContain(name)
    }
  })

  test('the clean page passes every assertion', async () => {
    const page = await openOffender('clean')
    try {
      const page_like = like(page)
      await quality.setScheme(page_like, 'light')
      await quality.axe(page_like)
      await quality.overflow(page_like)
      await quality.ringWalk(page_like)
      await quality.focusNotObscured(page_like)
      await quality.textSpacing(page_like)
      await forcedColors(page)
      await fit(page)
      await reducedMotion(page)
      await hitFloor(page, 'fine')
      await hitOverlap(page)
    } finally {
      await page.context().close()
    }
  }, 170_000)
})
