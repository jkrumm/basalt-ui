/**
 * Spike Q4 (docs/v3/concepts/quality-contract.md section 10, Q4). Throwaway harness, no tests.
 *
 * Renders Base UI Toast and Combobox behind the spike wrappers with German overrides, opens each
 * overlay, settles, and measures: is the override the accessible name, does the English default
 * (`Notifications`, `Dismiss`) still sit in the DOM, does axe (wcag2a, wcag2aa, wcag21aa, wcag22aa)
 * report serious or critical. A second page renders UNWRAPPED Base UI as a control: the detector
 * must find the English there, otherwise a clean result proves nothing.
 *
 * Prints ONE JSON object on stdout and always exits 0 (0 = the harness ran, not "hypothesis held").
 * Progress goes to stderr.
 */
import { resolve } from 'node:path'
import { AxeBuilder } from '@axe-core/playwright'
import { chromium } from 'playwright-core'
import type { Page } from 'playwright-core'

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
const LABEL = 'Benachrichtigungen'
const DISMISS = 'Schließen'
const log = (msg: string): void => void process.stderr.write(`${msg}\n`)

const built = await Bun.build({
  entrypoints: [resolve(import.meta.dir, 'client.tsx')],
  target: 'browser',
  define: { 'process.env.NODE_ENV': '"production"' },
})
if (!built.success) throw new Error(built.logs.join('\n'))
const script = await built.outputs[0]!.text()

const server = Bun.serve({
  port: 0,
  fetch: (req) =>
    new URL(req.url).pathname === '/app.js'
      ? new Response(script, { headers: { 'content-type': 'text/javascript' } })
      : new Response(
          '<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Q4</title><style>body{font:16px system-ui;color:#111;background:#fff}main{padding:24px;display:grid;gap:24px;justify-items:start}button,input{min-height:44px;min-width:44px}[role=region]{position:fixed;right:24px;bottom:24px;display:grid;gap:12px}</style></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>',
          { headers: { 'content-type': 'text/html' } },
        ),
})

/** Two frames after every running animation finished. */
const settle = (page: Page): Promise<void> =>
  page.evaluate(async () => {
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null)))
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  })

/** Every element anywhere in the document whose aria-label or own text is the English default. */
const englishLeaks = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const hits: string[] = []
    for (const el of document.querySelectorAll('*')) {
      const label = el.getAttribute('aria-label')
      const own = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent?.trim())
        .join('')
      for (const v of [label, own])
        if (v === 'Notifications' || v === 'Dismiss')
          hits.push(`${el.tagName.toLowerCase()}[${label ? 'aria-label' : 'text'}]=${v}`)
    }
    return hits
  })

async function axeSeriousCritical(page: Page): Promise<number> {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  for (const v of bad)
    log(`axe ${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
  return bad.length
}

async function measure(page: Page, mode: 'wrapped' | 'base') {
  await page.goto(`http://localhost:${server.port}/?mode=${mode}`)
  await page.getByRole('button', { name: 'Toast zeigen' }).click()
  await page.getByText('Gespeichert').first().waitFor()
  await settle(page)
  const toastNamed = await page.getByRole('region', { name: LABEL }).count()
  const toastLeaks = await englishLeaks(page)
  const axeToast = await axeSeriousCritical(page)

  await page.getByRole('combobox', { name: 'Obst wählen' }).click()
  await page.getByRole('option', { name: 'Apfel' }).waitFor()
  await settle(page)
  const dismissNamed = await page.getByRole('button', { name: DISMISS }).count()
  const dismissAttrs = await page.evaluate(() =>
    [...document.querySelectorAll('[aria-label]')]
      .filter((e) => e.getAttribute('aria-label') === 'Schließen')
      .map((e) => `${e.tagName.toLowerCase()}[aria-label]`),
  )
  const comboLeaks = await englishLeaks(page)
  const axeCombo = await axeSeriousCritical(page)
  return {
    toastNamed,
    dismissNamed,
    dismissAttrs,
    leaks: [...new Set([...toastLeaks, ...comboLeaks])],
    axe: axeToast + axeCombo,
    toastLeaks,
  }
}

const browser = await chromium.launch({ channel: 'chrome' })
try {
  const ctx = await browser.newContext({ locale: 'de-DE', viewport: { width: 1000, height: 700 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => log(`pageerror ${e.message}`))
  log('wrapped')
  const w = await measure(page, 'wrapped')
  log('control (unwrapped Base UI)')
  const c = await measure(page, 'base')

  const toastLabelOverridable = w.toastNamed === 1
  const comboboxDismissOverridable = w.dismissNamed >= 2
  const defaultEnglishLeaks = w.leaks.length
  const axeSeriousCritical = w.axe
  const held =
    toastLabelOverridable &&
    comboboxDismissOverridable &&
    defaultEnglishLeaks === 0 &&
    axeSeriousCritical === 0
  process.stdout.write(
    `${JSON.stringify({
      toastLabelOverridable,
      comboboxDismissOverridable,
      defaultEnglishLeaks,
      axeSeriousCritical,
      verdict: held ? 'pass' : 'refuted',
      detail: {
        toastPropName: 'label',
        toastDomAttribute: 'aria-label on div[role=region] (Toast.Viewport)',
        comboboxPropName: 'dismissLabel',
        comboboxDismissNodes: w.dismissNamed,
        comboboxDismissAttrs: w.dismissAttrs,
        leaks: w.leaks,
        controlUnwrappedLeaks: c.leaks,
        controlDetectorWorks:
          c.leaks.some((l) => l.includes('Notifications')) &&
          c.leaks.some((l) => l.includes('Dismiss')),
      },
    })}\n`,
  )
} finally {
  await browser.close()
  await server.stop(true)
}
