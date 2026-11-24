/**
 * Check 12: app wiring. Textual, no TS program: the router defaults a profile `app` must set, the
 * `notify` and `ToastHost` pair, `<html lang>`, the scheme boot script, selectors from the 2.x
 * era, and a route file behind every nav link. A missing Playwright is not a finding: the design-loop
 * lines beside the results (`designLoopLines`) name it with the install command.
 */
import { spawnSync } from 'node:child_process'
import { dirname } from 'node:path'
import { SOURCES_PATH } from '../../vite/sources'
import { resolveAppDir } from '../index'
import { routePatterns, typechecksBeforeTree } from '../route-tree'
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

/** Astro configs at the install root, at each declared root and beside it. */
function astroConfigs(ctx: Ctx, roots: readonly string[]): Source[] {
  const dirs = new Set(['.', ...roots, ...roots.map(parentOf)])
  const candidates = [...dirs].flatMap((dir) =>
    VITE_EXTENSIONS.map((ext) =>
      dir === '.' ? `astro.config.${ext}` : `${dir}/astro.config.${ext}`,
    ),
  )
  return load(ctx, candidates).filter((s) => s.text !== '')
}

/** site: `basaltAstro()` from `basalt-ui/astro` sits in the Astro config, after `react()`. */
function siteFindings(ctx: Ctx, roots: readonly string[]): string[] {
  const configs = astroConfigs(ctx, roots)
  if (configs.length === 0)
    return ['site: no astro.config.* at the install root or a declared root']
  const fix = 'integrations: [react(), basaltAstro()] (basalt-ui init --profile site writes it)'
  return configs.flatMap((c) => {
    const at = c.text.search(/\bbasaltAstro\s*\(/)
    if (at === -1 || !/['"]basalt-ui\/astro['"]/.test(c.text)) {
      return [`site: ${c.file} does not add basaltAstro() from basalt-ui/astro; ${fix}`]
    }
    const react = c.text.search(/\breact\s*\(/)
    if (react === -1 || react > at) {
      return [`site: ${c.file} adds basaltAstro() before react() or without it; ${fix}`]
    }
    return trackedSources(ctx, [c])
  })
}

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

/** Whether a route pattern serves the path a nav item links to (`$month` in a link is a param too). */
function serves(pattern: readonly string[], target: readonly string[]): boolean {
  const splat = pattern.indexOf('$$')
  if (splat !== -1) return target.length >= splat && pattern.slice(0, splat).every(same(target))
  return pattern.length === target.length && pattern.every(same(target))
}

const same =
  (target: readonly string[]) =>
  (segment: string, i: number): boolean =>
    segment === '$' || segment === target[i] || target[i]?.startsWith('$') === true

/**
 * The `to` of every `linkOptions`/`navTarget` in a file that calls `defineNav`, for which no route
 * file serves the path. Quiet for an app with no `routes/` directory (code-routed).
 */
function navFindings(sources: readonly Source[]): string[] {
  const files = sources.map((s) => s.file)
  if (!files.some((f) => f.split('/').includes('routes'))) return []
  const patterns = routePatterns(files)
  const found = sources
    .filter((s) => /\bdefineNav\s*\(/.test(s.text))
    .flatMap((s) =>
      [...s.text.matchAll(/\bto:\s*(['"])(\/[^'"]*)\1/g)].map((m) => ({
        file: s.file,
        to: m[2] ?? '/',
      })),
    )
  return found.flatMap(({ file, to }) => {
    const target = to.split(/[?#]/)[0]?.split('/').filter(Boolean) ?? []
    return patterns.some((p) => serves(p, target))
      ? []
      : [`app: ${file} links to ${to} but no route file under routes/ serves it`]
  })
}

/** `build` and `typecheck` scripts of the install root and the app that run `tsc` before the route tree exists. */
function treeFirstFindings(ctx: Ctx): string[] {
  const app = resolveAppDir(ctx.root)
  const files = new Set([
    'package.json',
    ...('error' in app ? [] : [app.rel === '' ? 'package.json' : `${app.rel}/package.json`]),
  ])
  return [...files].flatMap((file) => {
    const scripts = (readJson(ctx.root, file)?.['scripts'] ?? {}) as Record<string, unknown>
    return ['build', 'typecheck'].flatMap((name) => {
      const script = scripts[name]
      if (typeof script !== 'string' || !typechecksBeforeTree(script)) return []
      return [
        `app: ${file} script "${name}" is \`${script}\`: tsc reads src/routeTree.gen.ts before the router plugin writes it, ` +
          'so it fails on a new route; run `vite build` first (`vite build && tsc -b`) or `tsr generate` before tsc',
      ]
    })
  })
}

/** `<vite dir>/.basalt/sources.css` for each Vite config that calls `basalt()`, when git tracks it. */
function trackedSources(ctx: Ctx, configs: readonly Source[]): string[] {
  const files = configs
    .filter((c) => /\bbasalt(?:Astro)?\s*\(/.test(c.text))
    .map((c) => {
      const dir = dirname(c.file)
      return dir === '.' ? SOURCES_PATH : `${dir}/${SOURCES_PATH}`
    })
  return [...new Set(files)].flatMap((file) => {
    const run = spawnSync('git', ['ls-files', '--error-unmatch', '--', file], {
      cwd: ctx.root,
      stdio: 'ignore',
    })
    return run.status === 0
      ? [
          `${file} is tracked by git: it is regenerated on every run, so ignore it and \`git rm --cached ${file}\``,
        ]
      : []
  })
}

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
      findings.push(...navFindings(sources))
      findings.push(...trackedSources(ctx, configs))
      if (configs.some((c) => /\btanstackRouter\s*\(/.test(c.text))) {
        findings.push(...treeFirstFindings(ctx))
      }
    }

    if (manifest.profile === 'site') findings.push(...siteFindings(ctx, roots))

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
        /<script\b[^>]*>[^<]*(?:data-theme|basalt:scheme)/s.test(host.text) ||
        // A Start root route has no index.html for the plugin to inject into: it runs the shipped script itself.
        /<ScriptOnce\b[^>]*>\s*\{\s*themeScript\s*\(/.test(host.text) ||
        bootInjected
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

    return verdictOf(findings, 'app wiring is complete')
  },
})

export const appChecks: Check[] = [check12('app-wiring')]
