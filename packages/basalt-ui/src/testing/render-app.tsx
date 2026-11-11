/**
 * `renderApp(ui, options?)`: the seed of the v3 test wrapper (docs/v3/concepts/migration-release.md
 * section 8, port order step 3). It replaces the hand-rolled `MantineProvider` wrapper the swap-only
 * 2.x tests carried.
 *
 * What it does: wraps `ui` in `BasaltProvider`, stamps the `scheme` option on `<html data-theme>`
 * synchronously (the provider writes it in an effect, which a test would otherwise have to await),
 * pins the process time zone to UTC so a date assertion never reads the machine, and tracks every
 * mounted tree so `cleanupApp()` can unmount them and restore what the test changed. RTL's own
 * auto-cleanup no-ops under `bun test`, so cleanup is explicit: call `cleanupApp` from `afterEach`.
 * Where a global `afterEach` exists (jest and vitest globals) it is registered once on first use.
 *
 * What it does not do: `settled()`, the router and query-client options and the SSR harness belong to
 * the testing harness Issue (`v3-qa-i3`), which grows this function.
 */
import { cleanup, render } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'

import { SCHEME_KEY } from '../core/scheme'
import { BasaltProvider } from '../core/provider'

export type RenderAppOptions = {
  /** Applied to `<html data-theme>` before the first assertion; `auto` removes the attribute. Default: untouched. */
  scheme?: 'light' | 'dark' | 'auto'
  /** BCP 47 tag read by the formatters. Default `en`. */
  locale?: string
}

export type RenderAppResult = RenderResult

const root = () => document.documentElement

let registered = false
let savedZone: string | undefined | null = null // null: nothing saved yet
const mounted = new Set<() => void>()

function pinUtc(): void {
  if (savedZone === null) savedZone = process.env.TZ
  process.env.TZ = 'UTC'
}

function applyScheme(scheme: NonNullable<RenderAppOptions['scheme']>): void {
  if (scheme === 'auto') root().removeAttribute('data-theme')
  else root().setAttribute('data-theme', scheme)
}

/** Unmounts every tree `renderApp` mounted and restores `data-theme`, `lang`, the scheme key and `TZ`. */
export function cleanupApp(): void {
  for (const unmount of mounted) unmount()
  mounted.clear()
  cleanup()
  root().removeAttribute('data-theme')
  root().removeAttribute('lang')
  try {
    localStorage.removeItem(SCHEME_KEY)
  } catch {
    // A blocked store has nothing to clear.
  }
  if (savedZone !== null) {
    if (savedZone === undefined) delete process.env.TZ
    else process.env.TZ = savedZone
    savedZone = null
  }
}

function registerCleanup(): void {
  if (registered) return
  registered = true
  const hook = (globalThis as { afterEach?: unknown }).afterEach
  if (typeof hook === 'function') (hook as (fn: () => void) => void)(cleanupApp)
}

export function renderApp(ui: ReactElement, options: RenderAppOptions = {}): RenderAppResult {
  registerCleanup()
  pinUtc()
  if (options.scheme !== undefined) applyScheme(options.scheme)
  const result = render(
    <BasaltProvider {...(options.locale === undefined ? {} : { locale: options.locale })}>
      {ui}
    </BasaltProvider>,
  )
  mounted.add(result.unmount)
  return result
}
