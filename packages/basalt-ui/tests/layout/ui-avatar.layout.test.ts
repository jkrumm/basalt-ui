/**
 * `Avatar`, `AvatarStack`, `EntityTitle` and `EntityChip` in real Chrome at 1440, 768, 390 and 320:
 * the size ladder is 16, 20, 28 and 48 px in both shapes and with every fallback, a failing image
 * leaves the box exactly as the plain fallback draws it, a stack overlaps and counts the rest, a
 * narrow title truncates without moving its face or its tags, the chip is 28 px high and shows its
 * remove button on hover and on focus, and axe finds nothing serious in either color scheme.
 * Asserted here because happy-dom has no geometry and no network.
 *
 * Self-contained like `ui-status.layout.test.ts`: the fixture CSS is compiled with the Tailwind CLI and
 * the fixture bundled in memory, both inlined into one document.
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
  PHONE_SMALL,
  TABLET_768,
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
const VIEWPORTS: Viewport[] = [DESKTOP_1440, TABLET_768, PHONE, PHONE_SMALL]
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const LADDER = { xs: 16, sm: 20, md: 28, lg: 48 } as const

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'ui-avatar-'))
  const cssOut = join(scratch, 'ui-avatar.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'ui-avatar.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`ui-avatar: tailwind failed:\n${css.stderr.toString()}`)
  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'ui-avatar-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`ui-avatar: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>ui-avatar</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport, scheme?: 'dark'): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-slot="avatar"]')
  if (scheme === 'dark') {
    await page.raw.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  }
  // A failing image removes itself on the error event, a loaded one marks the box.
  await page.raw.waitForSelector('[data-testid="size-lg"] [data-image]')
  await page.raw.waitForFunction(
    () => document.querySelector('[data-testid="broken"] img') === null,
  )
  await page.settle()
  return page
}

layout('Avatar, AvatarStack, EntityTitle and EntityChip', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      test('each size is its ladder step in both shapes, with initials, an icon and an image', async () => {
        const page = await open(viewport)
        const boxes = await page.raw.evaluate(() =>
          ['xs', 'sm', 'md', 'lg'].map((size) => ({
            size,
            boxes: [
              ...document.querySelectorAll<HTMLElement>(
                `[data-testid="size-${size}"] [data-slot="avatar"]`,
              ),
            ].map((el) => {
              const r = el.getBoundingClientRect()
              return [r.width, r.height, getComputedStyle(el).borderTopLeftRadius]
            }),
          })),
        )
        for (const { size, boxes: row } of boxes) {
          const px = LADDER[size as keyof typeof LADDER]
          expect(row).toHaveLength(4)
          for (const [w, h] of row) expect([w, h], size).toEqual([px, px])
          expect(row[0]?.[2], 'person is round').not.toBe(row[1]?.[2])
        }
        const radius = (size: string, i: number): string =>
          String(boxes.find((b) => b.size === size)?.boxes[i]?.[2])
        expect(radius('xs', 1)).toBe('5px')
        expect(radius('lg', 1)).toBe('8px')
      })

      test('an image covers the fallback and marks the box', async () => {
        const page = await open(viewport)
        const state = await page.raw.evaluate(() => {
          const el = document.querySelector<HTMLElement>('[data-testid="size-md"] [data-image]')!
          const img = el.querySelector('img')!
          return {
            opacity: getComputedStyle(img).opacity,
            fills:
              img.getBoundingClientRect().width === el.getBoundingClientRect().width &&
              img.getBoundingClientRect().height === el.getBoundingClientRect().height,
          }
        })
        expect(state).toEqual({ opacity: '1', fills: true })
      })

      test('a failing image falls back with no layout shift', async () => {
        const page = await open(viewport)
        const pair = await page.raw.evaluate(() => {
          const of = (id: string) => {
            const el = document.querySelector<HTMLElement>(
              `[data-testid="${id}"] [data-slot="avatar"]`,
            )!
            const r = el.getBoundingClientRect()
            return {
              box: [r.width, r.height],
              text: el.textContent,
              img: el.querySelector('img') !== null,
            }
          }
          return { plain: of('plain'), broken: of('broken') }
        })
        expect(pair.broken).toEqual(pair.plain)
        expect(pair.broken.text).toBe('AL')
      })

      test('a stack overlaps its faces and counts the rest', async () => {
        const page = await open(viewport)
        const stack = await page.raw.evaluate(() => {
          const group = document.querySelector<HTMLElement>(
            '[data-testid="stack"] [data-slot="avatar-stack"]',
          )!
          const faces = [...group.querySelectorAll<HTMLElement>('[data-slot="avatar"]')].map((el) =>
            el.getBoundingClientRect(),
          )
          const more = group.querySelector<HTMLElement>('[aria-label$="more"]')!
          return {
            count: faces.length,
            overlap: faces.slice(1).every((r, i) => r.left < faces[i]!.right),
            more: more.textContent,
            moreSize: [more.getBoundingClientRect().width, more.getBoundingClientRect().height],
          }
        })
        expect(stack).toEqual({ count: 4, overlap: true, more: '+2', moreSize: [20, 20] })
      })

      test('a narrow title truncates its text and keeps the face and tags whole', async () => {
        const page = await open(viewport)
        const title = await page.raw.evaluate(() => {
          const host = document.querySelector<HTMLElement>('[data-testid="title-narrow"]')!
          const root = host.querySelector<HTMLElement>('[data-slot="entity-title"]')!
          const face = root.querySelector<HTMLElement>('[data-slot="avatar"]')!
          const name = root.querySelector<HTMLElement>('span.truncate')!
          const tag = root.lastElementChild!.getBoundingClientRect()
          const text = root.querySelector<HTMLElement>('span.flex-col')!.getBoundingClientRect()
          return {
            inside: root.getBoundingClientRect().right <= host.getBoundingClientRect().right + 0.5,
            face: [face.getBoundingClientRect().width, face.getBoundingClientRect().height],
            truncated: name.scrollWidth > name.clientWidth,
            tagWidth: tag.width > 20,
            clear: text.right <= tag.left + 0.5,
            textRight: text.right,
            tagLeft: tag.left,
          }
        })
        expect(title).toMatchObject({
          inside: true,
          face: [48, 48],
          truncated: true,
          tagWidth: true,
          clear: true,
        })
      })

      test('a level draws one heading with the title in it', async () => {
        const page = await open(viewport)
        const heading = await page.raw.evaluate(() => {
          const h = document.querySelector<HTMLElement>('[data-testid="title-heading"] h1')
          return { text: h?.textContent, size: h && getComputedStyle(h).fontSize }
        })
        expect(heading).toEqual({ text: 'Acme', size: '16px' })
      })

      test('the chip is 28 px high and reveals its remove button on hover and on focus', async () => {
        const page = await open(viewport)
        const read = () =>
          page.raw.evaluate(() => {
            const chip = document.querySelector<HTMLElement>(
              '[data-testid="chip"] [data-slot="entity-chip"]',
            )!
            const button = chip.querySelector('button')!
            return {
              height: chip.getBoundingClientRect().height,
              opacity: getComputedStyle(button).opacity,
            }
          })
        expect(await read()).toEqual({ height: 28, opacity: '0' })
        await page.raw.hover('[data-testid="chip"] [data-slot="entity-chip"]')
        await page.settle()
        expect((await read()).opacity).toBe('1')
        await page.raw.mouse.move(0, 0)
        await page.settle()
        expect((await read()).opacity).toBe('0')
        await page.raw.focus('[data-testid="chip"] button')
        await page.settle()
        expect((await read()).opacity).toBe('1')
      })

      test('nothing scrolls the page sideways', async () => {
        const page = await open(viewport)
        const { scrollWidth, innerWidth } = await page.raw.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }))
        expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
      })

      for (const scheme of [undefined, 'dark'] as const) {
        test(`axe finds nothing serious or critical${scheme ? ` in ${scheme}` : ''}`, async () => {
          const page = await open(viewport, scheme)
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
      }
    })
  }
})
