/**
 * Shell cycle 1's visual fixes, measured in a real browser on the v3 fixture
 * (`fixture/v3/scenarios/shell-chrome-mount.tsx`):
 * - at 390 a page with a long title and two actions leaves the title unclipped, because only the
 *   primary action stays in the header and the other folds into the one overflow menu;
 * - at 1800 the first content row of a page with no band and of a page with a band start within
 *   4 px of each other, so content starts at one height on every page.
 *
 * v3 only: the 2.x oracle has neither the `mobile` fold nor the band-less inset.
 */
import { acquireShellTarget } from './shell-target'
import { afterAll, describe, expect, test } from 'bun:test'
import { providedSlots } from './fixture/v3/registry'
import type { FixtureSpec } from './fixture/spec'
import { LAYOUT_TARGET } from './shell-slots'
import { PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { Viewport } from './harness'
import { slot } from './harness/slots'

acquireShellTarget()
const ready = await initLayoutSuite()

afterAll(closeLayoutSuite)

const runnable =
  ready &&
  LAYOUT_TARGET === 'v3' &&
  ['shell-header-row', 'shell-page-bar-host'].every((s) => providedSlots().has(s))
const layout = runnable ? describe : describe.skip

const DESKTOP_1800: Viewport = { name: 'wide desktop', width: 1800, height: 1200 }

const specOf = (bar?: NonNullable<FixtureSpec['bar']>): FixtureSpec => ({
  sections: [
    {
      label: 'Main',
      items: [{ key: 'fleet', label: 'Fleet overview', mobile: 'tab', active: true }],
    },
  ],
  // `sidebar` routes the spec to the shell-chrome scenario, which mounts the page body with or
  // without a `PageBar`.
  sidebar: {},
  ...(bar !== undefined && { bar }),
})

layout('the phone header keeps the title readable', () => {
  test('390: a title and two actions leave the title unclipped', async () => {
    const page = await openFixture(specOf({ actions: 2 }), PHONE)
    const m = await page.raw.evaluate(() => {
      const leaf = document.querySelector<HTMLElement>('[data-slot="page-breadcrumb-leaf"]')
      if (leaf === null) throw new Error('LAYOUT: no breadcrumb leaf')
      const buttons = [...document.querySelectorAll<HTMLElement>('[data-slot="page-actions"] > *')]
      return {
        clipped: leaf.scrollWidth - leaf.clientWidth,
        width: leaf.getBoundingClientRect().width,
        visible: buttons
          .filter((b) => b.getBoundingClientRect().width > 0)
          .map((b) => b.dataset['actionId'] ?? b.getAttribute('aria-label')),
      }
    })
    expect(m.clipped, 'the leaf is not truncated').toBeLessThanOrEqual(0)
    expect(m.visible, 'the primary and the overflow menu').toEqual(['action-0', 'More actions'])
  })
})

layout('content starts at one height on every page', () => {
  const firstRow = async (bar?: NonNullable<FixtureSpec['bar']>): Promise<number> => {
    const page = await openFixture(specOf(bar), DESKTOP_1800)
    await page.raw.waitForSelector(slot('section'))
    await page.settle()
    return page.raw.evaluate((sectionSel) => {
      const section = document.querySelector<HTMLElement>(sectionSel)
      if (section === null) throw new Error('LAYOUT: no section')
      return section.getBoundingClientRect().top
    }, slot('section'))
  }

  test('1800: the first row of a band-less page and of a page with a band are within 4 px', async () => {
    const bare = await firstRow()
    const banded = await firstRow({ pills: 2 })
    expect(Math.abs(bare - banded)).toBeLessThanOrEqual(4)
  })
})
