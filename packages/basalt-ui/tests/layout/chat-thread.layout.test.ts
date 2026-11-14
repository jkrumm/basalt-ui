/**
 * The chat-thread recipe (docs/recipes/chat-thread.md; docs/v3/concepts/ai-mdx.md rows 1 and 13, P12)
 * in real Chrome, mounted as the playground file exports it. One 90 s mock stream drives the spike's
 * timeline: the thread sticks to the bottom, a user scroll-up is not yanked back, returning to the
 * bottom re-pins, a late image and a 390 px keyboard resize keep the last line visible. Short
 * streams cover the composer laws (Enter, Shift+Enter, IME, optimistic restore), the one polite
 * live region, `data-state` / `aria-busy`, and axe in both schemes at both viewports.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { buildChatThreadDocument } from './chat-thread-build'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  PHONE,
  closeLayoutSuite,
  initLayoutSuite,
  openDocument,
} from './harness'
import type { LayoutPage, Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const SCROLLER = '[aria-label="Conversation"]'
const BOX = 'textarea[aria-label="Message"]'
const LIVE = 'output:not([data-slot="code-block"] *)'
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

let html = ''
let dispose = (): void => undefined
beforeAll(async () => {
  if (!ready) return
  const built = await buildChatThreadDocument()
  html = built.html
  dispose = built.dispose
})
afterAll(() => dispose())

const axeSource = await Bun.file(
  new URL('../../../../node_modules/axe-core/axe.min.js', import.meta.url).pathname,
).text()

async function open(viewport: Viewport, mock: object = {}): Promise<LayoutPage> {
  const page = await openDocument(html, viewport)
  await page.raw.waitForSelector(SCROLLER)
  await page.raw.evaluate(
    (m) => Object.assign((window as never as { chatMock: object }).chatMock, m),
    mock,
  )
  return page
}

const gap = (page: LayoutPage): Promise<number> =>
  page.raw.evaluate((sel) => {
    const el = document.querySelector(sel)!
    return el.scrollHeight - el.scrollTop - el.clientHeight
  }, SCROLLER)

const scrollTop = (page: LayoutPage): Promise<number> =>
  page.raw.evaluate((sel) => document.querySelector(sel)!.scrollTop, SCROLLER)

async function send(page: LayoutPage, text: string): Promise<void> {
  await page.raw.fill(BOX, text)
  await page.raw.keyboard.press('Enter')
}

const status = (page: LayoutPage): Promise<string> =>
  page.raw.evaluate((sel) => document.querySelector(sel)?.textContent ?? '', LIVE)

const waitSettled = (page: LayoutPage): Promise<unknown> =>
  page.raw.waitForFunction(
    (sel) =>
      document.querySelector(sel)?.textContent !== '' &&
      document.querySelector('[data-state="streaming"]') === null,
    LIVE,
    { timeout: 20_000 },
  )

type AxeViolation = {
  id: string
  impact: string
  nodes: { target: string[]; html: string }[]
}

async function axeSerious(page: LayoutPage): Promise<string[]> {
  await page.raw.addScriptTag({ content: axeSource })
  const violations = await page.raw.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: { run: (c: Document, o: object) => Promise<{ violations: unknown[] }> }
      }
    ).axe
    const result = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
    })
    return result.violations
  })
  return (violations as AxeViolation[])
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map(
      (v) =>
        `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')} ${JSON.stringify(v.nodes.map((n) => n.html.slice(0, 160)))}`,
    )
}

layout('chat-thread: the scroller over a 90 s stream (P12)', () => {
  test('sticks, releases on scroll-up, re-pins, follows a late image and a keyboard resize', async () => {
    const page = await open(PHONE, { tickMs: 100, ticks: 900 })
    await send(page, 'Stream a long answer.')
    await page.raw.mouse.move(PHONE.width / 2, PHONE.height / 3)
    const start = Date.now()
    const at = (s: number): Promise<void> => sleep(Math.max(0, start + s * 1000 - Date.now()))
    const pinnedGaps: number[] = []
    const sample = async (): Promise<void> => void pinnedGaps.push(await gap(page))

    // Pinned from the first line: every one-second sample is within 1 px of the bottom.
    for (let s = 2; s <= 9; s++) {
      await at(s)
      await sample()
    }

    // t=10: a user scroll-up releases the pin and nothing scrolls the thread back.
    await at(10)
    await page.raw.mouse.wheel(0, -700)
    await sleep(300)
    const released = await scrollTop(page)
    await at(13)
    expect(
      Math.abs((await scrollTop(page)) - released),
      'scrollTop while released',
    ).toBeLessThanOrEqual(2)
    expect(await gap(page), 'gap while released').toBeGreaterThan(8)

    // t=14: back to 6 px above the bottom re-pins; a second later the thread is at the bottom.
    await at(14)
    await page.raw.mouse.wheel(0, (await gap(page)) - 6)
    await at(15.2)
    expect(await gap(page), 'gap after the return').toBeLessThanOrEqual(1)
    for (let s = 16; s <= 29; s += 1) {
      await at(s)
      await sample()
    }

    // t=30: a late image above the stream grows from 0 to 220 px (reflow React did not cause).
    await at(30)
    await page.raw.evaluate((sel) => {
      const list = document.querySelector(`${sel} ol`)!
      const img = document.createElement('img')
      img.alt = ''
      img.id = 'late'
      img.style.cssText = 'display:block;height:0;width:100%'
      list.insertBefore(img, list.children[1] ?? null)
      setTimeout(() => (img.style.height = '220px'), 400)
    }, SCROLLER)
    await at(31.6)
    expect(await gap(page), 'gap 1 s after the image reflow').toBeLessThanOrEqual(1)
    for (let s = 33; s <= 49; s += 1) {
      await at(s)
      await sample()
    }

    // t=50: the soft keyboard opens (390x484), t=60 it closes; the last line stays visible both ways.
    await at(50)
    await page.raw.setViewportSize({ width: PHONE.width, height: 484 })
    await at(51.2)
    expect(await gap(page), 'gap with the keyboard open').toBeLessThanOrEqual(1)
    await at(60)
    await page.raw.setViewportSize({ width: PHONE.width, height: PHONE.height })
    await at(61.6)
    expect(await gap(page), 'gap after the keyboard closes').toBeLessThanOrEqual(1)
    for (let s = 63; s <= 88; s += 1) {
      await at(s)
      await sample()
    }

    expect(Math.max(...pinnedGaps), `pinned samples ${pinnedGaps.join(',')}`).toBeLessThanOrEqual(1)

    // The stream ends: it settles, the block drops aria-busy, the live region speaks once.
    await page.raw.waitForFunction(
      () => document.querySelector('[data-state="streaming"]') === null,
      undefined,
      {
        timeout: 20_000,
      },
    )
    expect(await gap(page), 'gap once settled').toBeLessThanOrEqual(1)
    expect((await status(page)).length).toBeGreaterThan(500)
  }, 150_000)
})

layout('chat-thread: composer, live region and axe', () => {
  test('Enter sends, Shift+Enter is a newline, an IME Enter does nothing', async () => {
    const page = await open(PHONE, { tickMs: 20, ticks: 20 })
    await page.raw.fill(BOX, 'line one')
    await page.raw.keyboard.press('Shift+Enter')
    await page.raw.keyboard.type('line two')
    expect(await page.raw.inputValue(BOX)).toBe('line one\nline two')
    expect(await page.count('[data-state="streaming"]')).toBe(0)

    await page.raw.evaluate((sel) => {
      document.querySelector(sel)!.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          isComposing: true,
          bubbles: true,
          cancelable: true,
        }),
      )
    }, BOX)
    await sleep(150)
    expect(await page.raw.inputValue(BOX), 'an IME Enter leaves the draft').toBe(
      'line one\nline two',
    )
    expect(await page.count('li[data-state]'), 'no message was sent').toBe(5)

    await page.raw.keyboard.press('Enter')
    await page.raw.waitForSelector('li[data-state="streaming"]')
    expect(await page.raw.inputValue(BOX), 'the draft clears on send').toBe('')
    expect(await page.raw.getAttribute('li[data-state="streaming"]', 'aria-busy')).toBe('true')
    await waitSettled(page)
    expect(await page.count('li[aria-busy="true"]')).toBe(0)
  })

  test('a failed send gives the text back', async () => {
    const page = await open(PHONE, { fail: true })
    await send(page, 'will fail')
    await page.raw.waitForFunction(
      (sel) => (document.querySelector(sel) as HTMLTextAreaElement).value === 'will fail',
      BOX,
      { timeout: 5000 },
    )
  })

  for (const viewport of [PHONE, DESKTOP_1440]) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`axe: 0 serious, one polite region, settled and streaming (${viewport.name}, ${scheme})`, async () => {
        const page = await open(viewport, { tickMs: 50, ticks: 60 })
        await page.raw.evaluate(
          (s) => document.documentElement.setAttribute('data-theme', s),
          scheme,
        )
        await sleep(500) // a colour transition in flight would be measured mid-way
        // The thread's own region. A CodeBlock keeps a copy confirmation of its own, empty until a click.
        const live = (): Promise<number> =>
          page.count(
            'output:not([data-slot="code-block"] *), [role="status"]:not([data-slot="code-block"] *), [role="alert"], [aria-live]:not([aria-live="off"]):not([data-slot="code-block"] *)',
          )
        expect(await live(), 'one live region before a send').toBe(1)
        expect(
          await page.raw.evaluate(() =>
            [...document.querySelectorAll('[data-slot="code-block"] output')].map(
              (e) => e.textContent,
            ),
          ),
          'code block regions are silent',
        ).toEqual([''])
        expect(await axeSerious(page), 'seeded thread').toEqual([])

        await send(page, 'Go.')
        await page.raw.waitForSelector('li[data-state="streaming"]')
        expect(await status(page), 'silent while streaming').toBe('')
        expect(await axeSerious(page), 'streaming').toEqual([])

        await waitSettled(page)
        expect(await live(), 'still exactly one live region').toBe(1)
        expect((await status(page)).length).toBeGreaterThan(20)
        expect(await axeSerious(page), 'settled').toEqual([])
        const overflow = await page.horizontalOverflow()
        expect(overflow.documentScrollWidth).toBeLessThanOrEqual(overflow.innerWidth)
      })
    }
  }
})
