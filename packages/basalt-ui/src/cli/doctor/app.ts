/**
 * Check 12: app wiring. Textual, no TS program: the router defaults a profile `app` must set, the
 * `notify` and `ToastHost` pair, `<html lang>`, the scheme boot script, selectors from the Mantine
 * era, and Playwright when the manifest declares `shot`.
 */
import { need, readJson, readText, rootFiles, rootsOf, verdictOf } from './types'
import type { Check, Ctx } from './types'

const SOURCE = /\.[cm]?[jt]sx?$/
const HTML_HOSTS = /\.(?:html|[jt]sx)$/
const ROUTE_DEFAULTS = [
  'defaultErrorComponent',
  'defaultNotFoundComponent',
  'defaultPendingComponent',
]

type Source = { file: string; text: string }

const load = (ctx: Ctx, files: readonly string[]): Source[] =>
  files.map((file) => ({ file, text: readText(ctx.root, file) ?? '' }))

const parentOf = (root: string): string =>
  root.includes('/') ? root.slice(0, root.lastIndexOf('/')) : '.'
const VITE_EXTENSIONS = ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs']

/** Vite configs at the install root and beside each declared root. */
function viteConfigs(ctx: Ctx, roots: readonly string[]): Source[] {
  const dirs = new Set(['.', ...roots.map(parentOf)])
  const candidates = [...dirs].flatMap((dir) =>
    VITE_EXTENSIONS.map((ext) =>
      dir === '.' ? `vite.config.${ext}` : `${dir}/vite.config.${ext}`,
    ),
  )
  return load(ctx, candidates).filter((s) => s.text !== '')
}

/** `<html>` hosts: an `index.html` at the root or beside a declared root, and any JSX with an `<html` tag. */
function htmlHosts(ctx: Ctx, roots: readonly string[], sources: readonly Source[]): Source[] {
  const dirs = new Set(['.', ...roots, ...roots.map(parentOf)])
  const indexes = [...dirs]
    .map((dir) => (dir === '.' ? 'index.html' : `${dir}/index.html`))
    .filter((f) => readText(ctx.root, f) !== null)
  return [
    ...load(ctx, indexes),
    ...sources.filter((s) => /<html[\s>]/.test(s.text) && HTML_HOSTS.test(s.file)),
  ]
}

const htmlTag = (text: string): string => /<html\b[^>]*>/s.exec(text)?.[0] ?? ''
const LITERAL_THEME = /\bdata-theme\s*=\s*(?:"[^"{}]+"|'[^'{}]+')/

const check12 = (name: string): Check => ({
  id: 12,
  name,
  run: (ctx) => {
    const manifest = need(ctx)
    const roots = rootsOf(manifest).map(([r]) => r)
    const sources = load(ctx, rootFiles(ctx, manifest, SOURCE))
    const findings: string[] = []

    if (manifest.profile === 'app') {
      const router = sources.filter((s) => /\bcreateRouter\s*\(/.test(s.text))
      if (router.length === 0) findings.push('app: no createRouter call under the declared roots')
      const routerText = router.map((s) => s.text).join('\n')
      for (const key of ROUTE_DEFAULTS) {
        if (router.length > 0 && !new RegExp(`\\b${key}\\b`).test(routerText)) {
          findings.push(`app: createRouter does not set ${key}`)
        }
      }
      if (
        !sources.some((s) =>
          /declare\s+module\s+['"]@tanstack\/react-router['"][\s\S]*?\binterface\s+Register\b/.test(
            s.text,
          ),
        )
      ) {
        findings.push('app: the router `Register` interface is not declared')
      }
      const configs = viteConfigs(ctx, roots)
      if (!configs.some((c) => /autoCodeSplitting\s*:\s*true/.test(c.text))) {
        findings.push('app: autoCodeSplitting is not enabled in the vite config')
      }
    }

    const notifies = sources.some((s) =>
      /import[^;]*\bnotify\b[^;]*from\s*['"]basalt-ui/s.test(s.text),
    )
    if (notifies && !sources.some((s) => /<ToastHost\b/.test(s.text))) {
      findings.push('notify is imported but no ToastHost is rendered')
    }

    const hosts = htmlHosts(ctx, roots, sources)
    if (hosts.length === 0 && manifest.profile === 'app')
      findings.push('app: no <html> element found (index.html or the root route)')
    // The vite plugin injects the scheme script unless it is switched off: `basalt()` from
    // `basalt-ui/vite` (`themeScript: false` omits it) or the 2.x `basaltAppPlugin`.
    const bootInjected = viteConfigs(ctx, roots).some(
      (c) =>
        (/\bbasalt\s*\(/.test(c.text) &&
          /basalt-ui\/vite/.test(c.text) &&
          !/themeScript\s*:\s*false/.test(c.text)) ||
        (/\bbasaltAppPlugin\b/.test(c.text) && !/bootScript\s*:\s*false/.test(c.text)),
    )
    for (const host of hosts) {
      const tag = htmlTag(host.text)
      if (!/\blang\s*=/.test(tag)) findings.push(`${host.file}: <html> has no lang`)
      const hardCoded = LITERAL_THEME.test(tag)
      const booted =
        /<script\b[^>]*>[^<]*(?:data-theme|basalt:scheme)/s.test(host.text) || bootInjected
      if (!hardCoded && !booted) {
        findings.push(
          `${host.file}: no boot script sets data-theme before paint (or hard-code data-theme on <html>)`,
        )
      }
    }

    for (const file of rootFiles(ctx, manifest, /\.(?:[cm]?[jt]sx?|css|html)$/)) {
      if (/\[data-mantine-color-scheme/.test(readText(ctx.root, file) ?? '')) {
        findings.push(`${file}: legacy [data-mantine-color-scheme] selector; key on [data-theme]`)
      }
    }

    if (manifest.viewports.length > 0) {
      const pkg = readJson(ctx.root, 'package.json') ?? {}
      const has = (name: string): boolean =>
        ['dependencies', 'devDependencies'].some(
          (field) => (pkg[field] as Record<string, string> | undefined)?.[name] !== undefined,
        )
      if (!has('playwright') && !has('@playwright/test')) {
        findings.push('the manifest declares `viewports` (shot) but Playwright is not a dependency')
      }
    }
    return verdictOf(findings, 'app wiring is complete')
  },
})

export const appChecks: Check[] = [check12('app-wiring')]
