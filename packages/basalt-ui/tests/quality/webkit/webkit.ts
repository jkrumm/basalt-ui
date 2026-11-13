/**
 * The WebKit lane (quality-contract Q6, decision 11): Playwright's own WebKit build with an iPhone
 * and a desktop Safari descriptor, running a layout subset and axe over the exemplar's routes. It
 * catches engine bugs on a machine with no iPhone; VoiceOver, the dynamic toolbar and the keyboard
 * stay owner device checks (M1-M6), and so does WKWebView proper.
 *
 * Route findings are recorded, not gating (P14: "not gating until a device runner exists; findings
 * become a test or a fallback"). The controls are gating: an assertion that passes its seeded
 * offender, or fails the clean page, makes the lane red.
 */
import { devices, webkit } from 'playwright-core'
import type { Browser, Page } from 'playwright-core'
import { quality } from '../../../src/testing/quality'
import type { PageLike } from '../../../src/testing/quality'

export const DESCRIPTORS = ['iPhone 15', 'Desktop Safari'] as const
export type Descriptor = (typeof DESCRIPTORS)[number]

/** iOS Safari zooms the page when a focused field computes under 16px. */
export const INPUT_FLOOR_PX = 16

export type Check = {
  name: string
  run: (page: Page, descriptor: Descriptor) => Promise<void>
}

/** Fields under the 16px floor. The floor is an iOS behaviour, so desktop descriptors skip it. */
async function inputFloor(page: Page, descriptor: Descriptor): Promise<void> {
  if (descriptor !== 'iPhone 15') return
  const low = await page.evaluate((floor) => {
    const out: string[] = []
    for (const el of document.querySelectorAll<HTMLElement>('input, textarea, select')) {
      if (
        el instanceof HTMLInputElement &&
        /^(?:hidden|checkbox|radio|range|button|submit|reset|file|color)$/.test(el.type)
      )
        continue
      const box = el.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) continue
      const size = parseFloat(getComputedStyle(el).fontSize)
      if (size < floor) {
        const slot = el.getAttribute('data-slot')
        out.push(
          `${el.tagName.toLowerCase()}${slot ? `[data-slot=${slot}]` : ''} font-size ${size}px`,
        )
      }
    }
    return out
  }, INPUT_FLOOR_PX)
  if (low.length > 0) {
    throw new Error(
      `inputFloor: iOS zooms fields under ${INPUT_FLOOR_PX}px\n  ${low.slice(0, 8).join('\n  ')}`,
    )
  }
}

/** The layout subset plus axe: the same functions the Chromium matrix runs, on the other engine. */
export const CHECKS: readonly Check[] = [
  { name: 'axe', run: async (page) => void (await quality.axe(page as PageLike)) },
  { name: 'overflow', run: (page) => quality.overflow(page as PageLike) },
  { name: 'textSpacing', run: (page) => quality.textSpacing(page as PageLike) },
  { name: 'inputFloor', run: inputFloor },
]

/** Launches WebKit; fetches the browser once when the machine does not have it yet. */
export async function launchWebkit(): Promise<Browser> {
  try {
    return await webkit.launch()
  } catch (error) {
    if (!/Executable doesn't exist|playwright install/i.test(String(error))) throw error
    const install = Bun.spawnSync(['bunx', 'playwright-core', 'install', 'webkit'], {
      stdout: 'inherit',
      stderr: 'inherit',
    })
    if (install.exitCode !== 0)
      throw new Error('webkit lane: `playwright-core install webkit` failed', { cause: error })
    return webkit.launch()
  }
}

export type Finding = { route: string; descriptor: Descriptor; check: string; message: string }

/** One route on one descriptor: every check, failures collected (a failed check does not stop the next). */
export async function webkitCell(
  browser: Browser,
  descriptor: Descriptor,
  origin: string,
  route: string,
): Promise<Finding[]> {
  const context = await browser.newContext({ ...devices[descriptor], reducedMotion: 'reduce' })
  const findings: Finding[] = []
  try {
    const page = await context.newPage()
    await quality.setScheme(page as PageLike, 'light')
    await page.goto(origin + route, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-slot], main', { timeout: 15_000 })
    for (const check of CHECKS) {
      try {
        await check.run(page, descriptor)
      } catch (error) {
        findings.push({
          route,
          descriptor,
          check: check.name,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }
  } finally {
    await context.close()
  }
  return findings
}

/** Seeded offenders: each must fail its own check on the phone, and `clean` must pass them all. */
export const OFFENDERS = [
  { name: 'overflow', check: 'overflow', fails: /document scrollWidth 20\d\d/ },
  { name: 'axe-image-alt', check: 'axe', fails: /image-alt \(critical\)/ },
  { name: 'input-floor', check: 'inputFloor', fails: /font-size 12px/ },
] as const

export type ControlOutcome = { offender: string; ok: boolean; detail: string }

export async function runWebkitControls(
  browser: Browser,
  html: (name: string) => Promise<string>,
): Promise<ControlOutcome[]> {
  const descriptor: Descriptor = 'iPhone 15'
  const failures = async (name: string): Promise<Map<string, string>> => {
    const context = await browser.newContext({ ...devices[descriptor], reducedMotion: 'reduce' })
    try {
      const page = await context.newPage()
      await page.setContent(await html(name))
      const out = new Map<string, string>()
      for (const check of CHECKS) {
        try {
          await check.run(page, descriptor)
        } catch (error) {
          out.set(check.name, error instanceof Error ? error.message : String(error))
        }
      }
      return out
    } finally {
      await context.close()
    }
  }
  const outcomes: ControlOutcome[] = []
  const clean = await failures('clean')
  outcomes.push({
    offender: 'clean',
    ok: clean.size === 0,
    detail:
      [...clean].map(([check, message]) => `${check}: ${message.split('\n')[0]}`).join('; ') ||
      'passed every check',
  })
  for (const o of OFFENDERS) {
    const got = await failures(o.name)
    const message = got.get(o.check)
    const ok = message !== undefined && o.fails.test(message)
    outcomes.push({
      offender: o.name,
      ok,
      detail: ok
        ? 'failed as seeded'
        : `${o.check} did not fail ${String(o.fails)}: ${message?.split('\n')[0] ?? 'passed'}`,
    })
  }
  return outcomes
}
