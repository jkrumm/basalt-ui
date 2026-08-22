/**
 * `basaltAppPlugin`'s anti-FOUC rule, measured in real Chrome — the cascade half of the shell.
 *
 * WHY A BROWSER. This is a cascade-LAYER question, and nothing else in the repo can answer it.
 * Through 1.20.0 the plugin emitted `html{background-color:…;color-scheme:dark}` UNLAYERED, and an
 * unlayered declaration outranks every layered one regardless of specificity — including Mantine's
 * own `@layer mantine{:root{color-scheme:var(--mantine-color-scheme)}}`. A light-scheme consumer
 * therefore got dark scrollbars, dark `<select>` popups and dark date pickers permanently, with no
 * opt-out. Two consumers found it independently in the same round; one shipped an inline
 * `color-scheme` in its `index.html` as the only thing that beats an unlayered rule.
 *
 * happy-dom's `getComputedStyle` is a cascade resolver with no `@layer` support at all, so a unit
 * test asserting the emitted CSS string proves the STRING and not the OUTCOME. The `1.20.0` string
 * was perfectly reasonable to read. Only a real engine resolving a real document says who won.
 *
 * The probe documents are the fixture shell with one `<style>` inserted immediately after `<head>`
 * — head-prepend, the exact position Vite injects the plugin's tags into.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  closeLayoutSuite,
  fixtureHtml,
  initLayoutSuite,
  openFixture,
  serveDocument,
} from './harness'
import { basaltAppPlugin } from '../../src/vite'
import type { BasaltAppOptions } from '../../src/vite'

let ready = false

/** The `<style>` body `basaltAppPlugin` emits for a given `colorScheme`, read off the real plugin. */
function bootStyle(options: Partial<BasaltAppOptions>): string {
  const plugin = basaltAppPlugin({ name: 'Probe', ...options })[0] as unknown as {
    configResolved: (config: { base: string }) => void
    transformIndexHtml: {
      handler: (html: string) => { tags: { tag: string; children?: string }[] }
    }
  }
  plugin.configResolved({ base: '/' })
  const tags = plugin.transformIndexHtml.handler('<html><head></head><body></body></html>').tags
  const style = tags.find((tag) => tag.tag === 'style')
  if (!style?.children) throw new Error('basaltAppPlugin emitted no anti-FOUC <style>')
  return style.children
}

/** Registers the fixture shell with `css` injected at head-prepend, and returns its path. */
async function probe(css: string): Promise<string> {
  const shell = await fixtureHtml()
  return serveDocument(shell.replace('<head>', `<head>\n    <style>${css}</style>`))
}

/** The 1.20.0 rule verbatim — kept so the regression is measured, not remembered. */
const UNLAYERED_1_20_0 = 'html{background-color:#27272a;color-scheme:dark}'

let unlayeredPath = ''
let darkPath = ''
let lightPath = ''
let autoPath = ''
let optOutPath = ''

beforeAll(async () => {
  ready = await initLayoutSuite()
  if (!ready) return
  unlayeredPath = await probe(UNLAYERED_1_20_0)
  darkPath = await probe(bootStyle({}))
  lightPath = await probe(bootStyle({ colorScheme: 'light' }))
  autoPath = await probe(bootStyle({ colorScheme: 'auto' }))
  optOutPath = await probe(bootStyle({ colorScheme: false }))
})

afterAll(closeLayoutSuite)

const SPEC = {
  sections: [{ label: 'Main', items: [{ key: 'home', label: 'Home', active: true }] }],
}

/** Mounts the shell at `path` under `scheme` and reports what the UA actually resolved on <html>. */
async function resolvedScheme(path: string, scheme: 'light' | 'dark'): Promise<string> {
  const page = await openFixture({ ...SPEC, colorScheme: scheme }, undefined, path)
  return page.computed('html', 'color-scheme')
}

describe('anti-FOUC color-scheme', () => {
  test('THE REGRESSION: the 1.20.0 unlayered rule pins light mode to dark', async () => {
    if (!ready) return
    // This is the defect, reproduced. If this ever reports 'light', the cascade changed underneath
    // the fix and the scoping below is no longer what is doing the work.
    expect(await resolvedScheme(unlayeredPath, 'light')).toBe('dark')
  })

  test('the shipped rule lets Mantine win in BOTH schemes', async () => {
    if (!ready) return
    expect(await resolvedScheme(darkPath, 'light')).toBe('light')
    expect(await resolvedScheme(darkPath, 'dark')).toBe('dark')
  })

  test('colorScheme: light and auto also yield to the resolved scheme', async () => {
    if (!ready) return
    expect(await resolvedScheme(lightPath, 'dark')).toBe('dark')
    expect(await resolvedScheme(autoPath, 'light')).toBe('light')
  })

  test('colorScheme: false declares nothing and still paints the surface', async () => {
    if (!ready) return
    expect(await resolvedScheme(optOutPath, 'light')).toBe('light')
  })

  test('the FOUC it prevents is still prevented — the rule applies before Mantine mounts', async () => {
    if (!ready) return
    // Same document, but nothing mounted: `basaltMountFixture` has not run, so
    // `data-mantine-color-scheme` is absent and the boot rule is the only thing on <html>. That is
    // the pre-boot frame the rule exists for, and it must still paint.
    const page = await openFixture(SPEC, undefined, lightPath)
    const painted = await page.raw.evaluate(() => {
      document.documentElement.removeAttribute('data-mantine-color-scheme')
      const style = getComputedStyle(document.documentElement)
      return { scheme: style.colorScheme, background: style.backgroundColor }
    })
    expect(painted.scheme).toBe('light')
    expect(painted.background).toBe('rgb(242, 242, 245)')
  })
})
