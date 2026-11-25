/**
 * Every popup fits the window (Issue 3294): each popup the kit ships (popover, the header's appearance
 * popover and its submenu form, menu, submenu, context menu, select, searchable select, combobox,
 * autocomplete, date picker, model picker, tooltip, preview card, info hint) opens from a trigger
 * pinned to each window edge and corner at 1280x720, 390x844 and 320x568 on a fine pointer. The
 * popup box lies inside the viewport, scrolls neither sideways nor past the window, and the page
 * gains no horizontal scroll. `offender` is a seeded popup wider than any window: the check must
 * report it, so the test fails when the check goes blind.
 *
 * Self-contained like `ui-popups`: the fixture CSS is compiled with the Tailwind CLI and the
 * fixture bundled in memory.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  PHONE,
  PHONE_SMALL,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
  serveDocument,
} from './harness'
import type { LayoutPage, Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const FIXTURE_DIR = join(import.meta.dirname, 'fixture')
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const EMPTY_SPEC = { sections: [] } as FixtureSpec

const LAPTOP: Viewport = { name: 'laptop', width: 1280, height: 720 }
const VIEWPORTS: Viewport[] = [LAPTOP, PHONE, PHONE_SMALL]
const POSITIONS = [
  'top-left',
  'top',
  'top-right',
  'left',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
] as const

type Open = 'click' | 'focus' | 'hover' | 'type'
type Kind = { name: string; open: Open; sub?: string; minWidth?: number }
const KINDS: Kind[] = [
  { name: 'popover', open: 'click' },
  { name: 'appearance', open: 'click' },
  { name: 'appearance-w80', open: 'click' },
  // A submenu needs room beside its parent menu; a window narrower than both opens a sheet on a phone (its own Issue).
  { name: 'appearance-sub', open: 'click', sub: '[data-slot="menu-sub"]', minWidth: 768 },
  { name: 'menu', open: 'click' },
  { name: 'menu-sub', open: 'click', sub: '[data-slot="menu-sub"]' },
  { name: 'context-menu', open: 'click' },
  { name: 'select', open: 'click' },
  { name: 'select-search', open: 'click' },
  { name: 'combobox', open: 'click' },
  { name: 'autocomplete', open: 'type' },
  { name: 'date-picker', open: 'click' },
  { name: 'model-picker', open: 'click' },
  { name: 'tooltip', open: 'focus' },
  { name: 'preview-card', open: 'hover' },
  { name: 'info-hint', open: 'click' },
]

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'popup-fit-'))
  const cssOut = join(scratch, 'popup-fit.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'popup-fit.css'), '--output', cssOut],
    {
      cwd: REPO_ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )
  if (css.exitCode !== 0) throw new Error(`popup-fit: tailwind failed:\n${css.stderr.toString()}`)
  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'popup-fit-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`popup-fit: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>popup-fit</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

const TRIGGER = '[data-testid="pf-anchor"] :is(button, input, a)'

async function openPopup(page: LayoutPage, kind: Kind, pos: string): Promise<void> {
  await page.raw.evaluate(
    ([k, p]) => (window as unknown as { pfSet: (k: string, p: string) => void }).pfSet(k!, p!),
    [kind.name, pos],
  )
  await page.raw.waitForSelector(TRIGGER)
  await page.settle()
  if (kind.open === 'focus') await page.raw.focus(TRIGGER)
  else if (kind.open === 'hover') await page.raw.hover(TRIGGER)
  else await page.raw.click(TRIGGER)
  if (kind.open === 'type') await page.raw.keyboard.press('ArrowDown')
  await page.raw.waitForSelector('[data-side]', { timeout: 4000 })
  if (kind.sub !== undefined) {
    await page.raw.click(kind.sub)
    await page.raw.waitForFunction(
      () => document.querySelectorAll('[data-side]').length > 2,
      null,
      {
        timeout: 4000,
      },
    )
  }
  await page.settle()
}

/** What is wrong with every open popup: outside the window, a sideways scroll, a scroll past the window. */
async function offenders(page: LayoutPage): Promise<string[]> {
  return page.raw.evaluate(() => {
    const problems: string[] = []
    const vw = window.innerWidth
    const vh = window.innerHeight
    // The positioner and the popup inside it both carry `data-side`: the popup is the inner one.
    const popups = [...document.querySelectorAll<HTMLElement>('[data-side]')].filter(
      (el) => (el.parentElement?.closest('[data-side]') ?? null) !== null,
    )
    if (popups.length === 0) problems.push('no popup is open')
    for (const el of popups) {
      const r = el.getBoundingClientRect()
      const name = el.getAttribute('data-slot') ?? el.tagName.toLowerCase()
      const box = `[${Math.round(r.left)}, ${Math.round(r.top)}, ${Math.round(r.right)}, ${Math.round(r.bottom)}] in ${vw}x${vh}`
      if (r.left < -0.5 || r.right > vw + 0.5 || r.top < -0.5 || r.bottom > vh + 0.5)
        problems.push(`${name} leaves the window ${box}`)
      if (el.scrollWidth > el.clientWidth + 1)
        problems.push(`${name} scrolls sideways (${el.scrollWidth} > ${el.clientWidth})`)
    }
    const doc = document.documentElement
    if (doc.scrollWidth > vw) {
      const wide = [...document.body.querySelectorAll<HTMLElement>('*')]
        .filter((el) => el.getBoundingClientRect().right > vw + 0.5)
        .slice(0, 3)
        .map((el) => `${el.tagName.toLowerCase()}[${el.getAttribute('data-slot') ?? el.className}]`)
      problems.push(`the page scrolls sideways (${doc.scrollWidth} > ${vw}): ${wide.join(', ')}`)
    }
    return problems
  })
}

layout('every popup fits the window', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.width}x${viewport.height}`, () => {
      for (const kind of KINDS.filter((k) => viewport.width >= (k.minWidth ?? 0))) {
        test(`${kind.name} from every edge`, async () => {
          const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
          const failures: string[] = []
          for (const pos of POSITIONS) {
            try {
              await openPopup(page, kind, pos)
              for (const problem of await offenders(page)) failures.push(`${pos}: ${problem}`)
            } catch (error) {
              failures.push(`${pos}: ${String(error)}`)
            }
            await page.raw.keyboard.press('Escape')
          }
          expect(failures).toEqual([])
        }, 60_000)
      }

      test('the check reports a seeded offender', async () => {
        const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
        await openPopup(page, { name: 'offender', open: 'click' }, 'left')
        const found = await offenders(page)
        expect(found.join('; ')).toContain('scrolls sideways')
      })
    })
  }
})
