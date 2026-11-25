/**
 * bench-control-groups: one size vocabulary and the three groups, in real Chrome at 1440 and 390.
 * Every control at `md` and at `sm` stands beside the others at one height, under a fine and a
 * coarse pointer, and a keyboard focus paints one ring on each. `ButtonGroup` and `InputGroup` fuse
 * edges (1 px overlap, squared inner corners), `ControlGroup` keeps 2 px; `fill` and a child that
 * opts out work horizontally and vertically, in light and dark; PageBar's group draws the frames its
 * private group drew; axe finds nothing serious or critical. Asserted here because happy-dom has no
 * geometry and no focus-visible.
 *
 * Self-contained like `ui-inputs.layout.test.ts`: the fixture CSS is compiled with the Tailwind CLI
 * and the fixture bundled in memory, both inlined into one document.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  PHONE,
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
const VIEWPORTS: Viewport[] = [DESKTOP_1440, PHONE]
const EMPTY_SPEC = { sections: [] } as FixtureSpec

/** The drawn box of each control: the element that carries its border or its fill. */
const BOXES = [
  '[data-slot="button"]',
  '[data-slot="copy-button"]',
  'input[data-slot="input"]',
  'input[data-slot="password-input"]',
  '[data-slot="native-select"] select',
  '[data-slot="select-trigger"]',
  '[data-slot="combobox-input"]',
  '[data-slot="number-field"]',
  '[data-slot="date-picker"]',
  '[data-slot="segmented"]',
  '[data-slot="input-addon"]',
].join(', ')

const near = (got: number, want: number, label: string): void => {
  expect(Math.abs(got - want), `${label}: ${got} against ${want}`).toBeLessThan(0.6)
}

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'ui-groups-'))
  const cssOut = join(scratch, 'ui-groups.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'ui-groups.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`ui-groups: tailwind failed:\n${css.stderr.toString()}`)
  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'ui-groups-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`ui-groups: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>ui-groups</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport, pointer: 'fine' | 'coarse'): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', pointer)
  await page.raw.waitForSelector('[data-testid="pagebar"] [data-slot="button-group"]')
  await page.settle()
  return page
}

type Box = { slot: string; height: number }

/** The drawn height of every control box inside a probe. */
const boxesOf = (page: LayoutPage, id: string): Promise<Box[]> =>
  page.raw.evaluate(
    ({ id, boxes }) =>
      [...document.querySelectorAll<HTMLElement>(`[data-testid="${id}"] :is(${boxes})`)].map(
        (el) => ({
          slot: el.dataset['slot'] ?? el.closest<HTMLElement>('[data-slot]')?.dataset['slot'] ?? '',
          height: el.getBoundingClientRect().height,
        }),
      ),
    { id, boxes: BOXES },
  )

type Rect = {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
}

/** The rects of a group's direct children, and the group's own. */
const childrenOf = (
  page: LayoutPage,
  id: string,
  slot: string,
): Promise<{ group: Rect; kids: (Rect & { radii: string[]; z: string })[] }> =>
  page.raw.evaluate(
    ({ id, slot }) => {
      const group = document.querySelector<HTMLElement>(
        `[data-testid="${id}"] [data-slot="${slot}"], [data-testid="${id}"] > ${slot}`,
      )!
      const rect = (el: Element): Rect => {
        const r = el.getBoundingClientRect()
        return {
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
        }
      }
      return {
        group: rect(group),
        kids: [...group.children].map((el) => {
          const box = el.matches('[data-slot="native-select"]') ? el.querySelector('select')! : el
          const s = getComputedStyle(box)
          return {
            ...rect(el),
            radii: [
              s.borderStartStartRadius,
              s.borderStartEndRadius,
              s.borderEndEndRadius,
              s.borderEndStartRadius,
            ],
            z: getComputedStyle(el).zIndex,
          }
        }),
      }
    },
    { id, slot },
  )

/** Moves focus by keyboard onto `selector`, so `:focus-visible` matches as it does for a user. */
async function keyboardFocus(page: LayoutPage, selector: string): Promise<void> {
  await page.raw.focus(selector)
  await page.raw.keyboard.press('Shift+Tab')
  await page.raw.keyboard.press('Tab')
}

layout('control vocabulary and groups', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      test('fine pointer: every control at a size has one height, md above sm', async () => {
        const page = await open(viewport, 'fine')
        const md = await boxesOf(page, 'row-md')
        const sm = await boxesOf(page, 'row-sm')
        const grouped = await boxesOf(page, 'group-sm')
        expect(md.length).toBeGreaterThanOrEqual(13)
        expect(sm.length).toBe(md.length)
        expect(grouped.length).toBe(md.length)
        const ctl = md[0]!.height
        expect(ctl).toBeGreaterThan(24)
        for (const box of md) near(box.height, ctl, `md ${box.slot}`)
        for (const box of sm) near(box.height, 24, `sm ${box.slot}`)
        for (const box of grouped) near(box.height, 24, `group sm ${box.slot}`)
      })

      test('coarse pointer: every control keeps the height it has on a fine one', async () => {
        const fine = await open(viewport, 'fine')
        const page = await open(viewport, 'coarse')
        for (const row of ['row-md', 'row-sm', 'group-sm']) {
          const want = await boxesOf(fine, row)
          const got = await boxesOf(page, row)
          expect(got.length, row).toBe(want.length)
          for (const [i, box] of got.entries())
            near(box.height, want[i]!.height, `${row} ${box.slot}`)
        }
      })

      test('Tab visits every control of a row in order and each paints the one brand ring', async () => {
        const page = await open(viewport, 'fine')
        await keyboardFocus(page, '[data-testid="row-md"] [data-slot="button"]')
        const rings: string[] = []
        for (let i = 0; i < 20; i++) {
          const ring = await page.raw.evaluate(() => {
            const active = document.activeElement as HTMLElement | null
            if (active === null || active.closest('[data-testid="row-md"]') === null) return null
            for (let el: HTMLElement | null = active; el !== null; el = el.parentElement) {
              // `transition-colors` eases outline-color in from currentColor: read the end state.
              for (const animation of el.getAnimations()) animation.finish()
              const s = getComputedStyle(el)
              if (s.outlineStyle === 'solid' && s.outlineWidth !== '0px') {
                const inset = el.dataset['slot'] === 'segmented-item'
                const slot = el.closest<HTMLElement>('[data-slot]')?.dataset['slot'] ?? el.tagName
                return `${slot}|${s.outlineWidth} ${s.outlineColor} ${inset ? 'inset' : s.outlineOffset}`
              }
            }
            return `none on ${active.outerHTML.slice(0, 80)}`
          })
          if (ring === null) break
          rings.push(ring)
          await page.raw.keyboard.press('Tab')
        }
        expect(rings.length).toBeGreaterThanOrEqual(13)
        const brand = await page.raw.evaluate(() => {
          const probe = document.createElement('i')
          probe.style.color = 'var(--basalt-brand)'
          document.body.append(probe)
          const color = getComputedStyle(probe).color
          probe.remove()
          return color
        })
        const want = new RegExp(`^2px ${brand.replace(/[()]/g, '\\$&')} (2px|inset)$`)
        for (const ring of rings) {
          const [slot, paint] = ring.split('|')
          expect(paint, slot).toMatch(want)
        }
      })

      for (const scheme of ['light', 'dark'] as const) {
        test(`${scheme}: ButtonGroup fuses horizontally and vertically`, async () => {
          const page = await open(viewport, 'fine')
          if (scheme === 'dark')
            await page.raw.evaluate(() => {
              document.documentElement.dataset['theme'] = 'dark'
            })
          const h = await childrenOf(page, 'bg-h', 'button-group')
          expect(h.kids).toHaveLength(3)
          near(h.kids[0]!.width, h.kids[0]!.height, 'an icon button stays square')
          for (let i = 1; i < 3; i++) {
            near(h.kids[i]!.left, h.kids[i - 1]!.right - 1, `h overlap ${i}`)
            near(h.kids[i]!.top, h.kids[0]!.top, `h top ${i}`)
          }
          expect(h.kids[0]!.radii[0]).not.toBe('0px')
          expect(h.kids[0]!.radii[1]).toBe('0px')
          expect(h.kids[1]!.radii).toEqual(['0px', '0px', '0px', '0px'])
          expect(h.kids[2]!.radii[0]).toBe('0px')
          expect(h.kids[2]!.radii[1]).not.toBe('0px')
          const v = await childrenOf(page, 'bg-v', 'button-group')
          for (let i = 1; i < 3; i++) {
            near(v.kids[i]!.top, v.kids[i - 1]!.bottom - 1, `v overlap ${i}`)
            near(v.kids[i]!.width, v.kids[0]!.width, `v width ${i}`)
          }
          const rule = await page.raw.evaluate(() => {
            const second = document.querySelector(
              '[data-testid="bg-v"] [data-slot="button-group"] > :nth-child(2)',
            )
            const before = second === null ? null : getComputedStyle(second, '::before')
            return before === null ? null : { height: before.height, color: before.backgroundColor }
          })
          expect(rule?.height, 'a stacked button draws a hairline over its fused edge').toBe('1px')
          expect(rule?.color).not.toBe('rgba(0, 0, 0, 0)')
        })

        test(`${scheme}: ControlGroup keeps 2 px, fills its box and keeps a grow-0 child`, async () => {
          const page = await open(viewport, 'fine')
          if (scheme === 'dark')
            await page.raw.evaluate(() => {
              document.documentElement.dataset['theme'] = 'dark'
            })
          const row = await childrenOf(page, 'cg', 'control-group')
          for (let i = 1; i < row.kids.length; i++)
            near(row.kids[i]!.left - row.kids[i - 1]!.right, 2, `gap ${i}`)
          const filled = await childrenOf(page, 'cg-fill', 'control-group')
          near(filled.group.width, 384, 'filled width')
          near(filled.kids[0]!.width, row.kids[0]!.width, 'grow-0 select keeps its width')
          expect(filled.kids[1]!.width).toBeGreaterThan(row.kids[1]!.width)
          const stacked = await childrenOf(page, 'cg-v', 'control-group')
          for (let i = 1; i < stacked.kids.length; i++) {
            near(stacked.kids[i]!.top - stacked.kids[i - 1]!.bottom, 2, `v gap ${i}`)
            near(stacked.kids[i]!.width, stacked.kids[0]!.width, `v width ${i}`)
          }
        })
      }

      test('ButtonGroup fill shares the box; a grow-0 button and an md button opt out', async () => {
        const page = await open(viewport, 'fine')
        const natural = await childrenOf(page, 'bg-h', 'button-group')
        const filled = await childrenOf(page, 'bg-fill', 'button-group')
        near(filled.group.width, 384, 'filled width')
        near(filled.kids[2]!.width, natural.kids[2]!.width, 'grow-0 keeps its width')
        expect(filled.kids[0]!.width).toBeGreaterThan(natural.kids[0]!.width)
        const optout = await childrenOf(page, 'bg-optout', 'button-group')
        near(optout.kids[0]!.height, 24, 'group size')
        near(optout.kids[1]!.height, natural.kids[1]!.height, 'own size wins')
      })

      test('InputGroup fuses an addon, a field and a select; the field takes the room', async () => {
        const page = await open(viewport, 'fine')
        const ig = await childrenOf(page, 'ig', 'input-group')
        near(ig.group.width, 384, 'group width')
        expect(ig.kids).toHaveLength(3)
        for (let i = 1; i < 3; i++)
          near(ig.kids[i]!.left, ig.kids[i - 1]!.right - 1, `overlap ${i}`)
        expect(ig.kids[1]!.radii).toEqual(['0px', '0px', '0px', '0px'])
        expect(ig.kids[2]!.radii[0]).toBe('0px')
        expect(ig.kids[1]!.width).toBeGreaterThan(ig.kids[0]!.width + ig.kids[2]!.width)
      })

      test('a focused button rises above its neighbours', async () => {
        const page = await open(viewport, 'fine')
        await keyboardFocus(page, '[data-testid="bg-h"] [data-slot="button"]:nth-child(2)')
        const z = (await childrenOf(page, 'bg-h', 'button-group')).kids.map((k) => k.z)
        expect(z[1]).toBe('3')
        expect(z[0]).not.toBe('3')
        expect(z[2]).not.toBe('3')
      })

      test("PageBar's group draws the frames its private group drew", async () => {
        const page = await open(viewport, 'fine')
        const before = await childrenOf(page, 'legacy', 'fieldset')
        const after = await childrenOf(page, 'pagebar', 'button-group')
        expect(after.kids).toHaveLength(3)
        near(after.group.height, before.group.height, 'group height')
        near(after.group.width, before.group.width, 'group width')
        after.kids.forEach((kid, i) => {
          const was = before.kids[i]!
          near(kid.left - after.group.left, was.left - before.group.left, `left ${i}`)
          near(kid.width, was.width, `width ${i}`)
          near(kid.height, was.height, `height ${i}`)
          expect(kid.radii).toEqual(was.radii)
        })
      })

      test('axe finds nothing serious or critical', async () => {
        const page = await open(viewport, 'fine')
        await page.raw.addScriptTag({ content: axeSource })
        const violations = await page.raw.evaluate(async () => {
          const axe = (
            window as unknown as {
              axe: {
                run: () => Promise<{
                  violations: { id: string; impact: string; nodes: { html: string }[] }[]
                }>
              }
            }
          ).axe
          const result = await axe.run()
          return result.violations
            .filter((v) => v.impact === 'serious' || v.impact === 'critical')
            .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.html).join(' | ')}`)
        })
        expect(violations).toEqual([])
      })
    })
  }
})
