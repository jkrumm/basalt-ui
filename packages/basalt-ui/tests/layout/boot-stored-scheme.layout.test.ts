/**
 * `basaltAppPlugin`'s boot script, measured in real Chrome: the pre-boot paint follows the stored
 * scheme, and the whole boot rule still expires the moment `data-mantine-color-scheme` appears.
 *
 * The probe document carries ONLY the plugin's emitted head tags — no Mantine, no bundle — so the
 * computed `<html>` style is the boot rule's own output. It is parsed fresh (`document.write`) so
 * the inline script runs exactly as on a cold load, after `localStorage` is seeded.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import {
  CLOSE_BUDGET_MS,
  closeLayoutSuite,
  fixtureHtml,
  initLayoutSuite,
  openFixture,
  serveDocument,
} from './harness'
import { HTML_NO_VIEWPORT, getPlugin, resolveConfig, transformHtml } from '../support/vite-app'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

function bootHead(colorScheme: 'dark' | 'light' | 'auto'): string {
  const plugin = getPlugin({ name: 'Probe', colorScheme })
  resolveConfig(plugin, '/')
  return transformHtml(plugin, HTML_NO_VIEWPORT)
    .filter((tag) => tag.tag === 'style' || tag.tag === 'script')
    .map((tag) => `<${tag.tag}>${tag.children ?? ''}</${tag.tag}>`)
    .join('')
}

const SPEC = {
  sections: [{ label: 'Main', items: [{ key: 'home', label: 'Home', active: true }] }],
}

/**
 * The fixture shell is only the same-origin host (the harness needs it to boot); its content is
 * replaced wholesale by the Mantine-free probe before anything is measured.
 */
const hostPath = ready ? serveDocument(await fixtureHtml()) : ''

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

type Painted = { background: string; scheme: string; boot: string | null }

/** Seeds storage, cold-parses a Mantine-free document with the boot head, reads <html>'s paint. */
async function coldLoad(
  colorScheme: 'dark' | 'light' | 'auto',
  stored: string | null,
  osScheme: 'light' | 'dark',
  afterMantine = false,
): Promise<Painted> {
  const page = await openFixture(SPEC, undefined, hostPath)
  await page.raw.emulateMedia({ colorScheme: osScheme })
  const html = `<!doctype html><html><head>${bootHead(colorScheme)}</head><body></body></html>`
  return page.raw.evaluate(
    ({ html, stored, afterMantine }) => {
      if (stored === null) localStorage.removeItem('mantine-color-scheme-value')
      else localStorage.setItem('mantine-color-scheme-value', stored)
      document.documentElement.removeAttribute('data-mantine-color-scheme')
      document.documentElement.removeAttribute('data-basalt-boot')
      document.open()
      document.write(html)
      document.close()
      if (afterMantine) document.documentElement.setAttribute('data-mantine-color-scheme', 'dark')
      const style = getComputedStyle(document.documentElement)
      return {
        background: style.backgroundColor,
        scheme: style.colorScheme,
        boot: document.documentElement.getAttribute('data-basalt-boot'),
      }
    },
    { html, stored, afterMantine },
  )
}

const LIGHT_BG = 'rgb(242, 242, 245)'

layout('boot script — stored scheme drives the pre-boot paint', () => {
  test('stored light paints light even though the build-time scheme is dark', async () => {
    const painted = await coldLoad('dark', 'light', 'dark')
    expect(painted).toEqual({ background: LIGHT_BG, scheme: 'light', boot: 'light' })
  })

  test('stored dark paints dark even though the build-time scheme is light', async () => {
    const painted = await coldLoad('light', 'dark', 'light')
    expect(painted.boot).toBe('dark')
    expect(painted.scheme).toBe('dark')
    expect(painted.background).not.toBe(LIGHT_BG)
  })

  test('stored auto follows the emulated OS scheme', async () => {
    expect((await coldLoad('dark', 'auto', 'light')).scheme).toBe('light')
    expect((await coldLoad('light', 'auto', 'dark')).scheme).toBe('dark')
  })

  test('nothing stored: the configured colorScheme stands', async () => {
    const painted = await coldLoad('light', null, 'dark')
    expect(painted).toMatchObject({ background: LIGHT_BG, scheme: 'light', boot: null })
  })

  test('the boot rule expires once data-mantine-color-scheme is written', async () => {
    // No Mantine stylesheet in the probe, so with the boot rule gone <html> is back to UA defaults.
    const expired = { background: 'rgba(0, 0, 0, 0)', scheme: 'normal', boot: 'light' }
    expect(await coldLoad('dark', 'light', 'dark', true)).toEqual(expired)
    expect(await coldLoad('light', 'dark', 'light', true)).toEqual({ ...expired, boot: 'dark' })
  })

  test('stored auto + OS dark expires the same way', async () => {
    const painted = await coldLoad('light', 'auto', 'dark', true)
    expect(painted).toEqual({ background: 'rgba(0, 0, 0, 0)', scheme: 'normal', boot: 'dark' })
  })
})
