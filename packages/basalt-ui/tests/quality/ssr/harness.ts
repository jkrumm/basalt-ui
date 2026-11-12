/**
 * The internal SSR hydration harness (quality-contract section 5). Repo code, not an export:
 * `expectHydrates` waits for its first SSR consumer before it becomes public.
 *
 * One row = one fixture module exporting `Page({ locale, timeZone })`. The harness:
 *   1. `vite build --ssr` the fixture, so the surface is proven to bundle for a server;
 *   2. renders the bundle with `renderToString` in a separate `bun` process with no DOM and the row's
 *      `TZ`, failing on anything that process logs;
 *   3. writes that HTML into the jsdom document this process runs under and `hydrateRoot`s the same
 *      `Page`, failing on any recoverable error or `console.error`.
 * The signature takes a fixture rather than an element on purpose: a server bundle cannot be built
 * from an element, and building it is what step 1 proves.
 *
 * Step 3 needs jsdom globals, so callers run under `tests/quality/ssr/bunfig.toml`
 * (`hydrate.subpath.lane.test.ts` starts that run). A positive control proves the detector can fail:
 * `Math.random()` in a value must raise `Hydration failed`.
 */
import { act } from '@testing-library/react'
import { spyOn } from 'bun:test'
import { createElement } from 'react'
import type { ComponentType } from 'react'
import { hydrateRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { existsSync, readdirSync } from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { settled } from '../../../src/testing/settled'

const HERE = dirname(fileURLToPath(import.meta.url))
const PACKAGE = resolve(HERE, '../../..')
const CACHE = join(PACKAGE, 'node_modules/.cache/basalt-ssr')

export const FIXTURE_DIR = join(HERE, 'fixtures')

export type HydrateOptions = { locale: string; timeZone: string }

export type Fixture = {
  /** The row: `tokens`, `root` (the `.` subpath) or `full`. */
  name: string
  /** Absolute path of the module exporting `Page`. */
  entry: string
  /** The page renders the whole `<html>` element, so hydration targets `document`. */
  document?: boolean
}

export type HydrateReport = {
  html: string
  /** `document.documentElement.lang` after hydration: written in an effect, so absent from `html`. */
  lang: string
  /** `data-theme` on `<html>` after the pre-paint script ran, when the fixture carries one. */
  theme: string | null
}

export const fixturePath = (name: string): string => join(FIXTURE_DIR, `${name}.tsx`)

/** A row is `covered` only when its fixture file exists; the matrix never reports a missing one as passed. */
export function rowStatus(name: string): 'covered' | 'not covered' {
  return existsSync(fixturePath(name)) ? 'covered' : 'not covered'
}

const built = new Map<string, Promise<string>>()

/** `vite build --ssr` for one fixture; cached per entry within the process. */
export function buildServerBundle(entry: string): Promise<string> {
  const cached = built.get(entry)
  if (cached !== undefined) return cached
  const run = (async () => {
    const { build } = await import('vite')
    const outDir = join(CACHE, basename(entry, extname(entry)))
    await build({
      root: PACKAGE,
      configFile: false,
      logLevel: 'silent',
      build: { ssr: entry, outDir, emptyOutDir: true, minify: false, write: true },
    })
    const stem = basename(entry, extname(entry))
    const file = readdirSync(outDir).find((f) => f.startsWith(stem) && /\.m?js$/.test(f))
    if (file === undefined) throw new Error(`vite build --ssr wrote no ${stem} bundle in ${outDir}`)
    return join(outDir, file)
  })()
  built.set(entry, run)
  return run
}

/** Server HTML from a fresh no-DOM process. Throws with the process' stderr when it logs or fails. */
export async function renderOnServer(bundle: string, options: HydrateOptions): Promise<string> {
  const child = Bun.spawn(
    [process.execPath, 'run', join(HERE, 'render-server.ts'), bundle, JSON.stringify(options)],
    { cwd: PACKAGE, stdout: 'pipe', stderr: 'pipe', env: { ...process.env, TZ: options.timeZone } },
  )
  const [out, err, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  if (code !== 0) throw new Error(`server render exited ${code}: ${err.trim() || out.trim()}`)
  if (err.trim() !== '') throw new Error(`server render logged: ${err.trim()}`)
  return JSON.parse(out) as string
}

const oneLine = (args: unknown[]): string =>
  args
    .map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : String(a)))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600)

/**
 * Hydrates `fixture` against server-rendered HTML in the jsdom document. Resolves with what was
 * observable afterwards; rejects naming every recoverable error and `console.error` otherwise.
 */
export async function expectHydrates(
  fixture: Fixture,
  options: HydrateOptions,
): Promise<HydrateReport> {
  const bundle = await buildServerBundle(fixture.entry)
  const html = await renderOnServer(bundle, options)
  const { Page } = (await import(fixture.entry)) as { Page: ComponentType<HydrateOptions> }

  const problems: string[] = []
  const errorSpy = spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    problems.push(`console.error: ${oneLine(args)}`)
  })
  const savedZone = process.env.TZ
  process.env.TZ = options.timeZone
  let root: Root | undefined
  try {
    let target: Element | Document
    if (fixture.document === true) {
      document.open()
      document.write(`<!DOCTYPE html>${html}`)
      document.close()
      // jsdom's own script runner needs a `vm` context Bun does not provide, so the document's inline
      // scripts (the pre-paint theme script) run here instead, before React hydrates, as a browser would.
      for (const script of document.querySelectorAll('script'))
        new Function(script.textContent ?? '')()
      target = document
    } else {
      const host = document.createElement('div')
      host.innerHTML = html
      document.body.replaceChildren(host)
      target = host
    }
    await act(async () => {
      root = hydrateRoot(target, createElement(Page, options), {
        onRecoverableError: (error) => {
          problems.push(`recoverable: ${oneLine([error])}`)
        },
      })
    })
    await settled()
    if (problems.length > 0)
      throw new Error(`hydration of ${fixture.name}: ${problems.join(' | ')}`)
    return {
      html,
      lang: document.documentElement.lang,
      theme: document.documentElement.getAttribute('data-theme'),
    }
  } finally {
    errorSpy.mockRestore()
    const live = root
    if (live !== undefined) await act(async () => live.unmount())
    if (savedZone === undefined) delete process.env.TZ
    else process.env.TZ = savedZone
    document.documentElement.removeAttribute('lang')
    document.documentElement.removeAttribute('data-theme')
    document.body.replaceChildren()
  }
}
