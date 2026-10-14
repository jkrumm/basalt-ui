/**
 * Transitions lane (V2-SPEC § 5) — the `PageAside` fold view transition in the playground, in real
 * Chrome. (There is no route transition: the router commits through `useSyncExternalStore`, so
 * `<ViewTransition>` never activates; `docs/waves/evidence/w7/transitions.md`.)
 *
 * Three variants of one fold on `/cbbi`, told apart only by what the page is given:
 *
 *   default   `prefers-reduced-motion: no-preference`: the fold transition plays.
 *   reduced   `prefers-reduced-motion: reduce`: React still starts it; `styles.css` removes the animation.
 *   no-api    `Document.prototype.startViewTransition` deleted before load (the § 5 fallback).
 *
 * `document.startViewTransition` is wrapped by an init script that counts calls and, at `ready`, counts
 * the timed view-transition animations (and, for the mid frame, pauses them at 50%). Screenshots land in
 * `<outDir>/transitions/`.
 */
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Lane } from './types'

const VIEWPORT = { width: 1280, height: 800 } as const

type Variant = 'default' | 'reduced' | 'no-api'
type Scheme = 'light' | 'dark'

type Probe = {
  calls: number
  timedAnimations: number
  pauseMid: boolean
  midShown: boolean
  /** Runtime exceptions, unhandled rejections and rejected `ready` promises, from inside the page. */
  errors: string[]
}

declare global {
  interface Window {
    __vt?: Probe
  }
}

/** Runs before any page script. `window.__vt` is the whole observation surface. */
const INIT = ({ variant, scheme }: { variant: Variant; scheme: Scheme }) => {
  localStorage.setItem('mantine-color-scheme-value', scheme)
  const probe: Probe = {
    calls: 0,
    timedAnimations: 0,
    pauseMid: false,
    midShown: false,
    errors: [],
  }
  window.__vt = probe
  window.addEventListener('error', (e) => probe.errors.push(String(e.message)))
  window.addEventListener('unhandledrejection', (e) => probe.errors.push(String(e.reason)))
  if (variant === 'no-api') {
    delete (Document.prototype as { startViewTransition?: unknown }).startViewTransition
    return
  }
  const original = document.startViewTransition?.bind(document)
  if (!original) return
  document.startViewTransition = (...args: Parameters<Document['startViewTransition']>) => {
    probe.calls++
    const t = original(...args)
    t.ready.then(
      () => {
        // The UA also runs zero-duration bookkeeping animations on `::view-transition` and the root
        // group; only a timed one is something a user can see.
        const timed = document.getAnimations().filter((a) => {
          const effect = a.effect
          if (!(effect instanceof KeyframeEffect)) return false
          const { duration } = effect.getTiming()
          return (
            effect.pseudoElement?.startsWith('::view-transition') === true &&
            typeof duration === 'number' &&
            duration > 0
          )
        })
        probe.timedAnimations = Math.max(probe.timedAnimations, timed.length)
        if (probe.pauseMid) {
          for (const a of timed) {
            a.pause()
            const duration = a.effect?.getTiming().duration
            if (typeof duration === 'number') a.currentTime = duration * 0.5
          }
          probe.midShown = true
        }
      },
      (reason: unknown) => {
        probe.errors.push(`startViewTransition.ready rejected: ${String(reason)}`)
      },
    )
    return t
  }
}

export const transitions: Lane = async ({ outDir, baseUrl, openBrowser }) => {
  const dir = join(outDir, 'transitions')
  await mkdir(dir, { recursive: true })
  const browser = await openBrowser()
  const summary: Array<{ metric: string; value: number | string; unit?: string }> = [
    { metric: 'browser', value: `Chrome ${browser.version()}` },
  ]
  const detail: Record<string, unknown> = {}
  const timed: Record<string, number> = {}
  const problems: string[] = []

  for (const [variant, scheme] of [
    ['default', 'light'],
    ['default', 'dark'],
    ['reduced', 'light'],
    ['no-api', 'light'],
  ] as const) {
    console.log(`[evidence] transitions: ${variant} ${scheme}`)
    const name = `${variant}-${scheme}`

    /** A fresh context on `/cbbi`; pausing animations for a screenshot disturbs the next fold, so the
     * counted run and the screenshot run never share one. */
    const session = async () => {
      const context = await browser.newContext({
        viewport: VIEWPORT,
        deviceScaleFactor: 1,
        colorScheme: scheme,
        reducedMotion: variant === 'reduced' ? 'reduce' : 'no-preference',
      })
      await context.addInitScript(INIT, { variant, scheme })
      const page = await context.newPage()
      page.setDefaultTimeout(30_000)
      // Console errors include failed asset loads; runtime errors are counted from inside the page.
      const consoleErrors: string[] = []
      page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
      await page.goto(`${baseUrl}/cbbi`, { waitUntil: 'networkidle' })
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      // A fold button can be briefly rendered twice while the transition settles; act on the visible one.
      const fold = (label: string) => page.getByLabel(label).filter({ visible: true }).first()
      const probe = async (): Promise<Probe> => {
        const read = await page.evaluate(() => window.__vt)
        // The init script runs before any page script, so a missing probe is a harness fault.
        if (!read) throw new Error(`transitions: no __vt probe in ${name}`)
        return read
      }
      return { context, page, consoleErrors, fold, probe }
    }

    // Counted run: collapse, settle, expand, settle.
    const counted = await session()
    const api = await counted.page.evaluate(() => typeof document.startViewTransition)
    await counted.fold('Collapse panel').click()
    await counted.fold('Expand panel').waitFor({ state: 'visible' })
    await counted.page.waitForTimeout(800)
    const afterCollapse = await counted.probe()
    await counted.fold('Expand panel').click()
    await counted.fold('Collapse panel').waitFor({ state: 'visible' })
    await counted.page.waitForTimeout(800)
    const end = await counted.probe()
    summary.push(
      { metric: `${name}: typeof document.startViewTransition`, value: api },
      {
        metric: `${name}: startViewTransition calls (collapse, then expand)`,
        value: `${afterCollapse.calls}, ${end.calls - afterCollapse.calls}`,
      },
      {
        metric: `${name}: timed view-transition animations at ready`,
        value: end.timedAnimations,
      },
      { metric: `${name}: runtime errors`, value: end.errors.length },
      {
        metric: `${name}: console errors (incl. failed asset loads)`,
        value: counted.consoleErrors.length,
      },
    )
    timed[name] = end.timedAnimations
    if (end.errors.length > 0) problems.push(`${name}: ${end.errors.join('; ')}`)
    detail[name] = { api, afterCollapse, end, consoleErrors: counted.consoleErrors }
    await counted.context.close()

    // Screenshot run: every view-transition animation paused at 50% for the mid frame.
    const shot = await session()
    await shot.page.evaluate(() => {
      if (window.__vt) window.__vt.pauseMid = true
    })
    await shot.fold('Collapse panel').click()
    if (variant === 'no-api') {
      await shot.fold('Expand panel').waitFor({ state: 'visible' })
    } else {
      await shot.page.waitForFunction(() => window.__vt?.midShown === true, undefined, {
        timeout: 5000,
      })
    }
    await shot.page.screenshot({ path: join(dir, `aside-mid--${name}.png`), caret: 'hide' })
    await shot.page.evaluate(() => {
      if (window.__vt) window.__vt.pauseMid = false
      for (const a of document.getAnimations()) a.play()
    })
    await shot.page.waitForTimeout(600)
    await shot.page.screenshot({ path: join(dir, `aside-folded--${name}.png`), caret: 'hide' })
    await shot.context.close()
  }

  // The reduced-motion contract is asserted, not just recorded: a timed animation under `reduce` fails
  // the lane, and so does a default run with none (the assertion would then be vacuous).
  if ((timed['reduced-light'] ?? 0) > 0)
    problems.push(`reduced-light: ${timed['reduced-light']} timed animation(s) under reduce`)
  if ((timed['default-light'] ?? 0) === 0)
    problems.push('default-light: no timed animation, so the reduced-motion check proves nothing')
  if (problems.length > 0) throw new Error(`transitions lane: ${problems.join(' | ')}`)

  return { lane: 'transitions', summary, detail }
}
