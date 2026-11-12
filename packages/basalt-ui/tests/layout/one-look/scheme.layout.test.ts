/**
 * The scheme seam of a static page, in real Chrome: P8 (`auto`), P9 (the shutterflow and argo
 * cases), forced-colors and print. Contract: docs/v3/concepts/static-framework-free.md section 8
 * rows P8 and P9, and falsifier F-S3.
 *
 * The page is the tokens fixture (plain CSS over the entries, one boot script) with the script
 * swapped per case; the shipped `setScheme` is bundled into the page for the late-restore cases.
 *
 * Chrome only. Firefox and Safari are NOT run: F-S4 and row U (the `auto` spike in those engines,
 * `var()` in SVG attributes) stay unverified by this file.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { Page } from 'playwright-core'
import {
  CLOSE_BUDGET_MS,
  closeLayoutSuite,
  DESKTOP_1440,
  initLayoutSuite,
  openDocument,
} from '../harness'
import type { LayoutPage } from '../harness'
import { themeScript } from '../../../src/css/theme-script'
import { tokensPage } from './pages'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip
afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const bundle = ready
  ? await (async () => {
      const built = await Bun.build({
        entrypoints: [new URL('./scheme-entry.ts', import.meta.url).pathname],
        target: 'browser',
        format: 'iife',
      })
      if (!built.success) throw new Error('scheme-entry.ts did not bundle')
      return (await built.outputs[0]?.text()) ?? ''
    })()
  : ''
const SCHEME_BUNDLE = `<script>${bundle}</script>`

/**
 * Lets the document finish whatever a change started. typography.css's reduced-motion reset (the
 * harness runs `reduce`) leaves a 0.01ms transition on every property, so a read in the frame of a
 * flip returns the OLD paint: one frame to start the transitions, then wait them out.
 */
const frames = (page: Page): Promise<void> =>
  page.evaluate(async () => {
    // eslint-disable-next-line unicorn/consistent-function-scoping -- serialized into the page
    const frame = (): Promise<void> => new Promise((done) => requestAnimationFrame(() => done()))
    await frame()
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)))
    await frame()
  })

interface Painted {
  readonly theme: string | null
  readonly colorScheme: string
  readonly canvas: string
}

/**
 * What the document resolves right now. Two frames first: the reduced-motion reset leaves a 0.01ms
 * transition on everything, and a read in the same frame as a flip returns the old paint.
 */
async function painted(page: Page): Promise<Painted> {
  await frames(page)
  return page.evaluate(() => ({
    theme: document.documentElement.getAttribute('data-theme'),
    colorScheme: getComputedStyle(document.documentElement).colorScheme,
    canvas: getComputedStyle(document.querySelector('.canvas') as Element).backgroundColor,
  }))
}

/** The light and dark canvas as Chrome resolves them from an explicit attribute: the references. */
async function references(): Promise<{ light: string; dark: string }> {
  const page = await openDocument(tokensPage({ script: null }), DESKTOP_1440)
  const read = async (theme: string): Promise<string> => {
    await page.raw.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
    return (await painted(page.raw)).canvas
  }
  const light = await read('light')
  const dark = await read('dark')
  await page.raw.context().close()
  return { light, dark }
}

const ref = ready ? await references() : { light: '', dark: '' }

const open = (script: string | null, body = ''): Promise<LayoutPage> =>
  openDocument(tokensPage({ script, body }), DESKTOP_1440)

const lin = (v: number): number => {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const luminance = (rgb: string): number => {
  const [r = 0, g = 0, b = 0] = (rgb.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].toSorted((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

layout('the references are real', () => {
  test('light and dark canvas differ', () => {
    expect(ref.light).not.toBe('')
    expect(ref.dark).not.toBe('')
    expect(ref.light).not.toBe(ref.dark)
  })
})

layout('P8: auto follows the OS with no JS', () => {
  test('no attribute + OS dark paints dark; no attribute + OS light paints light', async () => {
    const page = await open(themeScript())
    await page.raw.emulateMedia({ colorScheme: 'dark' })
    const dark = await painted(page.raw)
    expect(dark.theme).toBeNull()
    expect(dark.canvas).toBe(ref.dark)
    await page.raw.emulateMedia({ colorScheme: 'light' })
    const light = await painted(page.raw)
    expect(light.theme).toBeNull()
    expect(light.canvas).toBe(ref.light)
  })

  test('an OS flip re-resolves live, with no reload and no script', async () => {
    const page = await open(themeScript())
    await page.raw.emulateMedia({ colorScheme: 'light' })
    expect((await painted(page.raw)).canvas).toBe(ref.light)
    await page.raw.emulateMedia({ colorScheme: 'dark' })
    expect((await painted(page.raw)).canvas).toBe(ref.dark)
    await page.raw.emulateMedia({ colorScheme: 'light' })
    expect((await painted(page.raw)).canvas).toBe(ref.light)
  })

  test('color-scheme resolves to light or dark, never normal', async () => {
    const page = await open(themeScript())
    const seen: string[] = []
    for (const os of ['light', 'dark'] as const) {
      await page.raw.emulateMedia({ colorScheme: os })
      const auto = await painted(page.raw)
      expect(auto.colorScheme).toBe(os)
      seen.push(auto.colorScheme)
    }
    for (const theme of ['light', 'dark'] as const) {
      await page.raw.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
      const explicit = await painted(page.raw)
      expect(explicit.colorScheme).toBe(theme)
      seen.push(explicit.colorScheme)
    }
    expect(seen.every((s) => s === 'light' || s === 'dark')).toBe(true)
  })

  test("themeScript default 'dark' with empty storage stamps dark whatever the OS says", async () => {
    for (const os of ['light', 'dark'] as const) {
      const page = await open(themeScript({ default: 'dark' }))
      await page.raw.emulateMedia({ colorScheme: os })
      await page.raw.reload()
      await page.raw.emulateMedia({ colorScheme: os })
      const result = await painted(page.raw)
      expect(result.theme).toBe('dark')
      expect(result.canvas).toBe(ref.dark)
      expect(result.colorScheme).toBe('dark')
    }
  })

  test("a stored scheme beats the 'dark' default", async () => {
    const page = await open(themeScript({ default: 'dark' }))
    await page.raw.evaluate(() => localStorage.setItem('basalt:scheme', 'light'))
    await page.raw.reload()
    const result = await painted(page.raw)
    expect(result.theme).toBe('light')
    expect(result.canvas).toBe(ref.light)
  })
})

layout('P9: the shutterflow and argo cases', () => {
  const COOKIE = 'sf-color-scheme'
  const script = themeScript({ cookie: COOKIE, default: 'auto' })

  test('empty localStorage + cookie sf-color-scheme=dark paints dark', async () => {
    const page = await open(script)
    expect(await page.raw.evaluate(() => localStorage.length)).toBe(0)
    await page.raw.context().addCookies([{ name: COOKIE, value: 'dark', url: page.raw.url() }])
    await page.raw.emulateMedia({ colorScheme: 'light' })
    await page.raw.reload()
    const result = await painted(page.raw)
    expect(result.theme).toBe('dark')
    expect(result.canvas).toBe(ref.dark)
  })

  test('the raw legacy key mantine-color-scheme-value=dark is read', async () => {
    const page = await open(script)
    await page.raw.evaluate(() => localStorage.setItem('mantine-color-scheme-value', 'dark'))
    await page.raw.emulateMedia({ colorScheme: 'light' })
    await page.raw.reload()
    const result = await painted(page.raw)
    expect(result.theme).toBe('dark')
    expect(result.canvas).toBe(ref.dark)
  })

  test('the declared key beats the legacy key, which beats the cookie', async () => {
    const page = await open(script)
    await page.raw.context().addCookies([{ name: COOKIE, value: 'dark', url: page.raw.url() }])
    await page.raw.evaluate(() => {
      localStorage.setItem('mantine-color-scheme-value', 'dark')
      localStorage.setItem('basalt:scheme', 'light')
    })
    await page.raw.reload()
    expect((await painted(page.raw)).theme).toBe('light')
    await page.raw.evaluate(() => localStorage.removeItem('basalt:scheme'))
    await page.raw.context().clearCookies()
    await page.raw.context().addCookies([{ name: COOKIE, value: 'light', url: page.raw.url() }])
    await page.raw.reload()
    expect((await painted(page.raw)).theme).toBe('dark')
  })

  test('a late setScheme() after a simulated bootUiPrefs() re-stamps', async () => {
    const page = await open(script, SCHEME_BUNDLE)
    await page.raw.emulateMedia({ colorScheme: 'light' })
    expect((await painted(page.raw)).theme).toBeNull()
    // bootUiPrefs(): the async restore lands after first paint, writing the device key. A same-tab
    // localStorage write fires no storage event, so nothing re-stamps until setScheme() is called.
    await page.raw.evaluate(async () => {
      await new Promise((done) => setTimeout(done, 25))
      localStorage.setItem('basalt:scheme', 'dark')
    })
    expect((await painted(page.raw)).theme).toBeNull()
    await page.raw.evaluate(
      (name) =>
        (
          window as unknown as {
            basaltScheme: { setScheme: (v?: string, o?: { cookie?: string }) => void }
          }
        ).basaltScheme.setScheme(undefined, { cookie: name }),
      COOKIE,
    )
    const result = await painted(page.raw)
    expect(result.theme).toBe('dark')
    expect(result.canvas).toBe(ref.dark)
  })

  test('a late restore overrides an attribute the boot script already stamped', async () => {
    const page = await open(script, SCHEME_BUNDLE)
    await page.raw.evaluate(() => localStorage.setItem('basalt:scheme', 'light'))
    await page.raw.reload()
    expect((await painted(page.raw)).theme).toBe('light')
    await page.raw.evaluate(() => {
      localStorage.setItem('basalt:scheme', 'dark')
      ;(window as unknown as { basaltScheme: { setScheme: () => void } }).basaltScheme.setScheme()
    })
    const result = await painted(page.raw)
    expect(result.theme).toBe('dark')
    expect(result.canvas).toBe(ref.dark)
  })

  test('setScheme(value) mirrors the cookie it was told to write', async () => {
    const page = await open(script, SCHEME_BUNDLE)
    await page.raw.evaluate(
      (name) =>
        (
          window as unknown as {
            basaltScheme: { setScheme: (v: string, o: { cookie: string }) => void }
          }
        ).basaltScheme.setScheme('dark', { cookie: name }),
      COOKIE,
    )
    expect(await page.raw.evaluate(() => document.cookie)).toContain(`${COOKIE}=dark`)
    expect((await painted(page.raw)).canvas).toBe(ref.dark)
  })

  test('storage that throws: no page error, the cookie still paints', async () => {
    const page = await open(script)
    const errors: Error[] = []
    page.raw.on('pageerror', (error) => errors.push(error))
    await page.raw.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('storage is blocked', 'SecurityError')
        },
      })
    })
    await page.raw.context().addCookies([{ name: COOKIE, value: 'dark', url: page.raw.url() }])
    await page.raw.reload()
    const result = await painted(page.raw)
    expect(errors).toEqual([])
    expect(result.theme).toBe('dark')
    expect(result.canvas).toBe(ref.dark)
  })

  test('storage that throws and no cookie: stays on auto, no page error', async () => {
    const page = await open(script)
    const errors: Error[] = []
    page.raw.on('pageerror', (error) => errors.push(error))
    await page.raw.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('storage is blocked', 'SecurityError')
        },
      })
    })
    await page.raw.emulateMedia({ colorScheme: 'dark' })
    await page.raw.reload()
    await page.raw.emulateMedia({ colorScheme: 'dark' })
    const result = await painted(page.raw)
    expect(errors).toEqual([])
    expect(result.theme).toBeNull()
    expect(result.canvas).toBe(ref.dark)
  })
})

layout('print emulation shows light values only', () => {
  test('an explicit dark attribute prints light', async () => {
    const page = await open(null)
    await page.raw.emulateMedia({ colorScheme: 'dark' })
    await page.raw.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
    expect((await painted(page.raw)).canvas).toBe(ref.dark)
    await page.raw.emulateMedia({ media: 'print', colorScheme: 'dark' })
    const printed = await painted(page.raw)
    expect(printed.canvas).toBe(ref.light)
    expect(printed.colorScheme).toBe('light')
  })

  test('no attribute + OS dark prints light', async () => {
    const page = await open(null)
    await page.raw.emulateMedia({ colorScheme: 'dark' })
    expect((await painted(page.raw)).canvas).toBe(ref.dark)
    await page.raw.emulateMedia({ media: 'print', colorScheme: 'dark' })
    const printed = await painted(page.raw)
    expect(printed.canvas).toBe(ref.light)
    expect(printed.colorScheme).toBe('light')
  })

  test('the ink token prints light too', async () => {
    const page = await open(null)
    await page.raw.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
    await frames(page.raw)
    const screenInk = await page.raw.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--vx-ink').trim(),
    )
    await page.raw.emulateMedia({ media: 'print' })
    await frames(page.raw)
    const printInk = await page.raw.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--vx-ink').trim(),
    )
    expect(printInk).not.toBe(screenInk)
    expect(printInk).toBe('#262629')
  })
})

layout('forced colors', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`${theme}: the card stays legible and the focus ring uses a system colour`, async () => {
      const page = await open(null, '<button id="f" type="button">Go</button>')
      await page.raw.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
      await page.raw.emulateMedia({ forcedColors: 'active' })
      await frames(page.raw)
      expect(await page.raw.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(
        true,
      )
      const { ink, back, brand } = await page.raw.evaluate(() => {
        const card = getComputedStyle(document.querySelector('.card') as Element)
        const probe = document.createElement('i')
        probe.style.color = 'var(--vx-brand)'
        document.body.append(probe)
        const resolved = getComputedStyle(probe).color
        probe.remove()
        return { ink: card.color, back: card.backgroundColor, brand: resolved }
      })
      expect(contrast(ink, back)).toBeGreaterThanOrEqual(4.5)
      await page.raw.keyboard.press('Tab')
      await frames(page.raw)
      const ring = await page.raw.evaluate(() => {
        const style = getComputedStyle(document.getElementById('f') as Element)
        return { width: style.outlineWidth, color: style.outlineColor }
      })
      expect(ring.width).not.toBe('0px')
      expect(ring.color).not.toBe(brand)
    })
  }
})
