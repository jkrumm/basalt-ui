/**
 * Transitions lane (V2-SPEC § 5) — the `PageAside` fold view transition and the router's route
 * transition in the playground, in real Chrome. (A React `<ViewTransition>` around the route never
 * activates: the router commits through `useSyncExternalStore`, `docs/waves/evidence/w7/transitions.md`;
 * route transitions are `createBasaltRouter`'s `defaultViewTransition`, measured by the `route` section.)
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
 *
 * Route section: 12 sidebar-link navigations across the playground nav, each counted by wrapping
 * `document.startViewTransition` (target 12/12; W7 measured 0/12) with the `types` it was handed; one
 * search-only navigation (0 calls); and 8 clicks 40 ms apart, where a superseded transition rejects
 * `ready`/`finished` with `AbortError` — the probe attaches no handler to those promises, so any
 * `unhandledrejection` is basalt's guard failing, not the probe hiding it.
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

// ── Route transitions ─────────────────────────────────────────────────────────────────────────────

type RouteCall = { types: string[] | null; at: string }
type RouteProbe = {
  calls: RouteCall[]
  errors: string[]
  /** Attach a handler to `ready` (masks unhandled rejections) — only to prove that skips happen. */
  observe: boolean
  skipped: number
}

declare global {
  interface Window {
    __route?: RouteProbe
  }
}

const ROUTE_INIT = ({ observe }: { observe: boolean }) => {
  localStorage.setItem('mantine-color-scheme-value', 'light')
  const probe: RouteProbe = { calls: [], errors: [], observe, skipped: 0 }
  window.__route = probe
  window.addEventListener('error', (e) => probe.errors.push(`error: ${e.message}`))
  window.addEventListener('unhandledrejection', (e) =>
    probe.errors.push(`unhandledrejection: ${String(e.reason)}`),
  )
  const original = document.startViewTransition?.bind(document)
  if (!original) return
  document.startViewTransition = (...args: Parameters<Document['startViewTransition']>) => {
    const arg = args[0]
    probe.calls.push({
      types: typeof arg === 'object' && arg !== null ? [...(arg.types ?? [])] : null,
      at: location.pathname,
    })
    const t = original(...args)
    if (probe.observe) t.ready.then(undefined, () => probe.skipped++)
    return t
  }
}

async function routeSection(
  browser: import('playwright-core').Browser,
  baseUrl: string,
): Promise<{
  summary: Array<{ metric: string; value: number | string }>
  detail: unknown
  problems: string[]
}> {
  const problems: string[] = []
  const summary: Array<{ metric: string; value: number | string }> = []
  const session = async (observe: boolean) => {
    const context = await browser.newContext({ viewport: VIEWPORT, reducedMotion: 'no-preference' })
    await context.addInitScript(ROUTE_INIT, { observe })
    const page = await context.newPage()
    page.setDefaultTimeout(30_000)
    const consoleErrors: string[] = []
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    const probe = () =>
      page.evaluate(() => {
        if (!window.__route) throw new Error('transitions: no __route probe')
        return window.__route
      })
    /** Distinct pathnames of the sidebar's visible links, in DOM (nav) order. */
    const links = await page.evaluate(() => {
      const seen = new Set<string>()
      const out: string[] = []
      for (const a of document.querySelectorAll<HTMLAnchorElement>(
        '.mantine-AppShell-navbar a[href^="/"]',
      )) {
        if (a.offsetParent === null) continue
        const path = new URL(a.href).pathname
        if (seen.has(path)) continue
        seen.add(path)
        out.push(path)
      }
      return out
    })
    const click = (path: string) =>
      page
        .locator(`.mantine-AppShell-navbar a[href^="${path}"]`)
        .filter({ visible: true })
        .first()
        .click()
    return { context, page, consoleErrors, probe, links, click }
  }

  // 12 navigations, each to a different page than the one it leaves, settled before the next.
  const main = await session(false)
  if (main.links.length < 3) problems.push(`route: only ${main.links.length} sidebar links found`)
  const sequence: string[] = []
  let current = '/dashboard'
  for (let i = 0; sequence.length < 12; i++) {
    const next = main.links[i % main.links.length]
    if (next === undefined || next === current) continue
    sequence.push(next)
    current = next
  }
  const perNav: Array<{ to: string; calls: number; types: Array<string[] | null> }> = []
  for (const to of sequence) {
    const before = (await main.probe()).calls.length
    await main.click(to)
    await main.page.waitForURL((u) => u.pathname === to)
    await main.page.waitForTimeout(500)
    const calls = (await main.probe()).calls.slice(before)
    perNav.push({ to, calls: calls.length, types: calls.map((c) => c.types) })
  }
  const counted = perNav.filter((n) => n.calls >= 1).length
  const typeSet = [
    ...new Set(perNav.flatMap((n) => n.types.map((t) => (t ? t.join('+') : 'none')))),
  ]
  summary.push(
    {
      metric: 'route: navigations that started a view transition',
      value: `${counted}/${perNav.length}`,
    },
    { metric: 'route: types received', value: typeSet.join(', ') },
  )
  if (counted !== perNav.length)
    problems.push(`route: ${counted}/${perNav.length} navigations started a transition`)

  // One search-only navigation on /cbbi: the view tab changes, the pathname does not.
  await main.click('/cbbi')
  await main.page.waitForURL((u) => u.pathname === '/cbbi')
  await main.page.waitForTimeout(500)
  const beforeSearch = (await main.probe()).calls.length
  await main.page.getByText('History', { exact: true }).filter({ visible: true }).first().click()
  await main.page.waitForFunction(() => location.search.includes('view=history'))
  await main.page.waitForTimeout(500)
  const searchCalls = (await main.probe()).calls.length - beforeSearch
  summary.push({
    metric: 'route: view transitions on a search-only navigation',
    value: searchCalls,
  })
  if (searchCalls !== 0)
    problems.push(`route: search-only navigation started ${searchCalls} transition(s)`)

  const end = await main.probe()
  summary.push(
    { metric: 'route: runtime errors / unhandled rejections', value: end.errors.length },
    {
      metric: 'route: console errors (incl. failed asset loads)',
      value: main.consoleErrors.length,
    },
  )
  if (end.errors.length > 0) problems.push(`route: ${end.errors.join('; ')}`)
  await main.context.close()

  // Rapid clicks: every click supersedes the transition before it. Two runs over the same clicks —
  // one that watches `ready` (proves skips are happening), one that leaves it alone (judges the guard).
  const rapid: Record<string, unknown> = {}
  for (const observe of [true, false]) {
    const r = await session(observe)
    await r.page.evaluate(
      async (paths) => {
        for (const path of paths) {
          document
            .querySelector<HTMLAnchorElement>(`.mantine-AppShell-navbar a[href^="${path}"]`)
            ?.click()
          await new Promise((resolve) => setTimeout(resolve, 40))
        }
      },
      r.links.slice(0, 8),
    )
    await r.page.waitForTimeout(1500)
    const probe = await r.probe()
    const name = observe ? 'rapid, ready observed' : 'rapid, ready unobserved'
    summary.push(
      { metric: `route: ${name}: transitions started`, value: probe.calls.length },
      ...(observe
        ? [{ metric: `route: ${name}: skipped (ready rejected)`, value: probe.skipped }]
        : []),
      { metric: `route: ${name}: unhandled rejections / errors`, value: probe.errors.length },
      { metric: `route: ${name}: console errors`, value: r.consoleErrors.length },
    )
    rapid[name] = {
      calls: probe.calls.length,
      skipped: probe.skipped,
      errors: probe.errors,
      consoleErrors: r.consoleErrors,
    }
    if (!observe && probe.errors.length > 0)
      problems.push(`route (${name}): ${probe.errors.join('; ')}`)
    await r.context.close()
  }

  return {
    summary,
    detail: {
      sequence,
      perNav,
      searchCalls,
      errors: end.errors,
      consoleErrors: main.consoleErrors,
      rapid,
    },
    problems,
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

  const route = await routeSection(browser, baseUrl)
  summary.push(...route.summary)
  detail['route'] = route.detail
  problems.push(...route.problems)

  // The reduced-motion contract is asserted, not just recorded: a timed animation under `reduce` fails
  // the lane, and so does a default run with none (the assertion would then be vacuous).
  if ((timed['reduced-light'] ?? 0) > 0)
    problems.push(`reduced-light: ${timed['reduced-light']} timed animation(s) under reduce`)
  if ((timed['default-light'] ?? 0) === 0)
    problems.push('default-light: no timed animation, so the reduced-motion check proves nothing')
  if (problems.length > 0) throw new Error(`transitions lane: ${problems.join(' | ')}`)

  return { lane: 'transitions', summary, detail }
}
