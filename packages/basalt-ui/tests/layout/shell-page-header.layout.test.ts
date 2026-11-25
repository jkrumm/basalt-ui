/**
 * Shell cycle 1's visual fixes, measured in a real browser on the v3 fixture
 * (`fixture/v3/scenarios/shell-chrome-mount.tsx`):
 * - at 390 a page with a long title and two actions leaves the title unclipped: the actions end the
 *   band under the header, where only the primary stays and the other folds into the one overflow menu;
 * - at 1800 the first content row starts one page gutter under the chrome's last rule, the band's
 *   when the page has one and the header's when it has none (owner review 1: the page top).
 *
 * v3 only: the 2.x oracle has neither the `mobile` fold nor the page inset.
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
  ready && LAYOUT_TARGET === 'v3' && ['shell-header-row'].every((s) => providedSlots().has(s))
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

layout('a title-only PageBar in a shell draws no band', () => {
  for (const viewport of [DESKTOP_1800, PHONE]) {
    test(`${viewport.name}: 0 px of band, one h1, --page-bar-h reads 0`, async () => {
      const page = await openFixture(specOf({ title: 'Orders' }), viewport)
      await page.raw.waitForSelector(slot('section'))
      await page.settle()
      const m = await page.raw.evaluate(() => {
        const band = document.querySelector<HTMLElement>('[data-slot="page-bar"]')
        const main = document.querySelector<HTMLElement>('main') ?? document.body
        const raw = getComputedStyle(document.documentElement).getPropertyValue('--page-bar-h')
        const owner = [...document.querySelectorAll<HTMLElement>('*')].find(
          (el) => el.style.getPropertyValue('--page-bar-h') !== '',
        )
        return {
          bandHeight: band === null ? 0 : band.getBoundingClientRect().height,
          h1: main.querySelectorAll('h1').length,
          raw: raw.trim(),
          inline: owner?.style.getPropertyValue('--page-bar-h') ?? '',
        }
      })
      expect(m.bandHeight, 'no band element has height').toBe(0)
      expect(m.h1, 'the title stays as one h1').toBe(1)
      expect(parseFloat(m.inline || m.raw || '0'), '--page-bar-h reads 0').toBe(0)
    })
  }

  test('1800: a title-only page and a bar-less page start content at one height', async () => {
    const top = async (bar?: NonNullable<FixtureSpec['bar']>): Promise<number> => {
      const page = await openFixture(specOf(bar), DESKTOP_1800)
      await page.raw.waitForSelector(slot('section'))
      await page.settle()
      return page.raw.evaluate(
        (sel) => document.querySelector<HTMLElement>(sel)?.getBoundingClientRect().top ?? -1,
        slot('section'),
      )
    }
    const bare = await top()
    const titled = await top({ title: 'Orders' })
    expect(Math.abs(bare - titled)).toBeLessThanOrEqual(1)
  })
})

layout('content starts one gutter under the chrome', () => {
  const firstRow = async (
    bar?: NonNullable<FixtureSpec['bar']>,
  ): Promise<{ gap: number; gutter: number }> => {
    const page = await openFixture(specOf(bar), DESKTOP_1800)
    await page.raw.waitForSelector(slot('section'))
    await page.settle()
    return page.raw.evaluate((sectionSel) => {
      const section = document.querySelector<HTMLElement>(sectionSel)
      const header = document.querySelector<HTMLElement>('[data-slot="shell-header"]')
      const main = document.querySelector<HTMLElement>('[data-slot="page-main"]')
      if (section === null || header === null || main === null) throw new Error('LAYOUT: no page')
      const band = document.querySelector<HTMLElement>('[data-slot="page-bar"]')
      return {
        gap: section.getBoundingClientRect().top - (band ?? header).getBoundingClientRect().bottom,
        gutter: parseFloat(getComputedStyle(main).paddingLeft),
      }
    }, slot('section'))
  }

  test('1800: a band-less page and a page with a band both start one gutter under the last rule', async () => {
    const bare = await firstRow()
    const banded = await firstRow({ pills: 2 })
    expect(bare.gap).toBeCloseTo(bare.gutter, 0)
    expect(banded.gap).toBeCloseTo(banded.gutter, 0)
  })
})

layout('a crumb parent is an in-app link', () => {
  for (const viewport of [DESKTOP_1800, PHONE]) {
    test(`${viewport.name}: a click keeps the document and the page's other search params`, async () => {
      const spec = {
        ...specOf({ title: 'Run 7', parent: { label: 'Runs', href: '/fleet?q=open' } }),
        entry: '/fleet?q=open&sel=7',
      }
      const page = await openFixture(spec, viewport)
      const parent = 'a[data-slot="page-breadcrumb-parent"]'
      await page.raw.waitForSelector(parent)
      await page.raw.evaluate(() => {
        ;(window as unknown as { __kept: boolean }).__kept = true
      })
      await page.raw.click(parent)
      await page.raw.waitForFunction(
        () => document.querySelector('[data-testid="location"]')?.textContent === '/fleet?q=open',
      )
      const kept = await page.raw.evaluate(
        () => (window as unknown as { __kept?: boolean }).__kept === true,
      )
      expect(kept, 'the click did not reload the document').toBe(true)
    })

    test(`${viewport.name}: after a click focus is in main`, async () => {
      const spec = {
        ...specOf({ title: 'Run 7', parent: { label: 'Runs', href: '/fleet?q=open' } }),
        entry: '/fleet?q=open&sel=7',
      }
      const page = await openFixture(spec, viewport)
      const parent = 'a[data-slot="page-breadcrumb-parent"]'
      await page.raw.waitForSelector(parent)
      expect(
        await page.raw.evaluate(
          (sel) => document.querySelector(sel)?.hasAttribute('aria-current'),
          parent,
        ),
      ).toBe(false)
      await page.raw.click(parent)
      await page.raw.waitForFunction(
        () => document.querySelector('[data-testid="location"]')?.textContent === '/fleet?q=open',
      )
      await page.raw.waitForFunction(
        () => document.activeElement?.closest('[data-slot="shell-main"]') !== null,
      )
    })
  }
})
