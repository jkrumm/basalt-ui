/**
 * S11 (docs/v3/concepts/charts-cards-kanban.md section 9): the `ui/card` info glyph is a native
 * `popover`. The browser owns the behaviour, so this file pins what the markup must not break: the
 * trigger opens it by pointer, Enter and Space; Escape closes it; a click outside closes it (light
 * dismiss); focus comes back to the trigger; and the bubble stays inside the viewport, on the card
 * at either edge of a 390x844 phone, inside a stretched-link card.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  PHONE,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
} from './harness'
import type { LayoutPage, Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const spec: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  colorScheme: 'light',
  cardInfo: true,
}

const VIEWPORTS: Viewport[] = [DESKTOP_1440, PHONE]

const trigger = (id: string): string => `[data-testid="${id}"] [data-slot="card-info"]`
const bubble = (id: string): string => `[data-testid="${id}"] [popover]`

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(spec, viewport, '/', 'reduce', 'fine')
  await page.settle()
  return page
}

/** Whether the bubble under `id` matches `:popover-open`. */
const isOpen = (page: LayoutPage, id: string): Promise<boolean> =>
  page.raw.evaluate(
    (selector) => document.querySelector(selector)?.matches(':popover-open') ?? false,
    bubble(id),
  )

/** Whether the document's focused element is the trigger under `id`. */
const triggerFocused = (page: LayoutPage, id: string): Promise<boolean> =>
  page.raw.evaluate(
    (selector) => document.activeElement === document.querySelector(selector),
    trigger(id),
  )

layout('card info popover (S11)', () => {
  for (const viewport of VIEWPORTS) {
    describe(viewport.name, () => {
      test('the trigger opens it by pointer, and again closes it', async () => {
        const page = await open(viewport)
        expect(await isOpen(page, 'card-info-left')).toBe(false)
        await page.raw.click(trigger('card-info-left'))
        expect(await isOpen(page, 'card-info-left')).toBe(true)
        await page.raw.click(trigger('card-info-left'))
        expect(await isOpen(page, 'card-info-left')).toBe(false)
      })

      for (const key of ['Enter', 'Space']) {
        test(`${key} on the focused trigger opens it`, async () => {
          const page = await open(viewport)
          await page.raw.focus(trigger('card-info-left'))
          await page.raw.keyboard.press(key)
          expect(await isOpen(page, 'card-info-left')).toBe(true)
        })
      }

      test('Escape closes it and focus is on the trigger', async () => {
        const page = await open(viewport)
        await page.raw.focus(trigger('card-info-left'))
        await page.raw.keyboard.press('Enter')
        expect(await isOpen(page, 'card-info-left')).toBe(true)
        await page.raw.keyboard.press('Escape')
        expect(await isOpen(page, 'card-info-left')).toBe(false)
        expect(await triggerFocused(page, 'card-info-left')).toBe(true)
      })

      test('Escape returns focus to the trigger from inside the bubble', async () => {
        const page = await open(viewport)
        await page.raw.click(trigger('card-info-left'))
        await page.raw.focus(bubble('card-info-left'))
        expect(await triggerFocused(page, 'card-info-left')).toBe(false)
        await page.raw.keyboard.press('Escape')
        expect(await isOpen(page, 'card-info-left')).toBe(false)
        expect(await triggerFocused(page, 'card-info-left')).toBe(true)
      })

      test('a click outside closes it (light dismiss)', async () => {
        const page = await open(viewport)
        await page.raw.click(trigger('card-info-left'))
        expect(await isOpen(page, 'card-info-left')).toBe(true)
        await page.raw.click('[data-testid="card-info-text"]')
        expect(await isOpen(page, 'card-info-left')).toBe(false)
      })

      test('opening a second glyph closes the first', async () => {
        const page = await open(viewport)
        await page.raw.click(trigger('card-info-left'))
        await page.raw.click(trigger('card-info-right'))
        expect(await isOpen(page, 'card-info-left')).toBe(false)
        expect(await isOpen(page, 'card-info-right')).toBe(true)
      })

      test('a stretched-link card: the glyph opens the bubble and nothing navigates', async () => {
        const page = await open(viewport)
        await page.raw.click(trigger('card-info-link'))
        expect(await isOpen(page, 'card-info-link')).toBe(true)
        expect(await page.raw.evaluate(() => window.location.hash)).toBe('')
      })

      for (const id of ['card-info-left', 'card-info-right', 'card-info-link']) {
        test(`the bubble of ${id} stays inside the viewport`, async () => {
          const page = await open(viewport)
          await page.raw.click(trigger(id))
          const box = await page.raw.evaluate((selector) => {
            const rect = document.querySelector(selector)!.getBoundingClientRect()
            return {
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom,
              vw: window.innerWidth,
              vh: window.innerHeight,
            }
          }, bubble(id))
          expect(box.right - box.left).toBeGreaterThan(0)
          // An 8 px gutter, not just "not clipped": flush against the edge reads as broken.
          expect(box.left).toBeGreaterThanOrEqual(8)
          expect(box.top).toBeGreaterThanOrEqual(0)
          expect(box.right).toBeLessThanOrEqual(box.vw - 8)
          expect(box.bottom).toBeLessThanOrEqual(box.vh)
        })
      }
    })
  }
})
