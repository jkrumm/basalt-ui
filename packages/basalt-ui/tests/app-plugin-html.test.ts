/**
 * `basaltAppPlugin` against a REAL Vite build — the only place the plugin's actual `<head>` output
 * is observable.
 *
 * `src/vite.test.ts` asserts the tag DESCRIPTORS the plugin hands Vite. That is not the same claim
 * as where the bytes land: the descriptors were correct through 1.20.0 and the built document still
 * put `<meta charset>` at byte 1653, past the 1024-byte window the HTML spec gives the encoding
 * declaration (argo measured 1302 on its own shell; linewatch 575 on a smaller one — the overflow
 * scales with injected content, so it is latent for every consumer). Only a build shows that, so
 * this file runs one.
 *
 * Cost: ~1s for a two-file app through the installed Vite. Worth it for the one assertion that
 * could not be made any other way.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'vite'
import { basaltAppPlugin } from '../src/vite'
import type { BasaltAppOptions } from '../src/vite'

/**
 * A realistic app shell — argo's, reduced to its shape: the charset, a title, and the boot script
 * that resolves the persisted color scheme before React mounts. The plugin injects ~20 tags ahead
 * of whatever this file's `<head>` already holds, which is what produced the overflow.
 */
const SHELL = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Argo</title>
    <script>
      try {
        var scheme = localStorage.getItem('mantine-color-scheme-value') || 'dark'
        document.documentElement.dataset.mantineColorScheme = scheme
      } catch (error) {}
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`

/** Every option a consumer realistically sets — each one adds head bytes ahead of the charset. */
const OPTIONS: BasaltAppOptions = {
  name: 'Argo',
  shortName: 'Argo',
  description: 'Personal API + dashboard',
  seo: {
    url: 'https://argo.example.com',
    image: 'https://argo.example.com/og.png',
    twitterCard: 'summary_large_image',
  },
}

/** The HTML spec's window for the encoding declaration. Not exported from `./vite` — a spec
 * constant is not public API, and the plugin's job is to stay under it, not to publish it. */
const CHARSET_BYTE_BUDGET = 1024

let root = ''
let html = ''

beforeAll(async () => {
  // realpath: on macOS `tmpdir()` is a symlink (/var -> /private/var) and rolldown rejects an
  // emitted filename that resolves outside the configured root.
  root = realpathSync(mkdtempSync(join(tmpdir(), 'basalt-app-plugin-')))
  writeFileSync(join(root, 'index.html'), SHELL)
  mkdirSync(join(root, 'src'))
  writeFileSync(join(root, 'src/main.ts'), 'export const boot = () => {}\n')

  await build({
    root,
    logLevel: 'silent',
    configFile: false,
    plugins: [...basaltAppPlugin(OPTIONS)],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: { input: join(root, 'index.html') },
    },
  })
  html = await Bun.file(join(root, 'dist/index.html')).text()
}, 120_000)

afterAll(() => {
  if (root) rmSync(root, { recursive: true, force: true })
})

describe('basaltAppPlugin — built document', () => {
  test('the encoding declaration stays inside the spec window', () => {
    const offset = Buffer.from(html, 'utf8').indexOf('<meta charset')
    expect(offset).toBeGreaterThanOrEqual(0)
    // Measured before the hoist on this exact shell: 1653. The value is asserted, not just the
    // budget, so a regression that merely creeps back toward 1024 is still a failure.
    expect(offset).toBeLessThan(CHARSET_BYTE_BUDGET)
    expect(offset).toBeLessThan(100)
  })

  test('exactly one encoding declaration survives the hoist', () => {
    expect(html.match(/<meta charset/gi)).toHaveLength(1)
  })

  test('the anti-FOUC rule is scoped, so Mantine can still own color-scheme', () => {
    expect(html).toContain('html:not([data-mantine-color-scheme]){')
    expect(html).not.toContain('<style>html{')
  })
})
