/**
 * `BasaltProvider`, v3 skeleton (docs/v3/spikes/provider.md): scheme, locale, lang and nothing else.
 *
 * It is the one value every consumer pays on first paint, so the budget is a cap (<= 5.0 KB gz,
 * docs/v3/concepts/quality-contract.md section 6). What stays out of this module is the point:
 * no `cn` tables, no message catalog (defaults live with their area), no Intl caches (`createFormat`
 * is lazy), no `persisted` and no Base UI Toast (the scheme key is a raw string, hosts are explicit
 * children). `provider.budget.test.ts` and `provider.closure.test.ts` gate that.
 *
 * Leaves render with no provider (English, `auto` scheme), so the context default is a real value.
 */
import { createContext, useContext, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { LinkContext } from './link'
import type { LinkComponent } from './ports'

export type Scheme = 'light' | 'dark' | 'auto'

export type ProviderContextValue = {
  readonly scheme: Scheme
  readonly locale: string
  readonly lang: string
}

/** The raw-string key the pre-paint script reads (tokens-visual State lane); never the `{v,value}` envelope. */
export const SCHEME_KEY = 'basalt:scheme'

const DEFAULTS: ProviderContextValue = { scheme: 'auto', locale: 'en', lang: 'en' }

const ProviderContext = createContext<ProviderContextValue>(DEFAULTS)

/** The provider values, or English / `auto` outside a provider. Internal: leaves read it, apps do not. */
export function useProviderContext(): ProviderContextValue {
  return useContext(ProviderContext)
}

/** What `bindInvalidation(...)` returns: `start()` subscribes and returns the stop. */
export type LiveBinding = { start(): () => void }

export type BasaltProviderProps = {
  /** Stamped on `<html data-theme>` and stored raw. Omitted: the boot script owns the first paint and nothing is written. */
  scheme?: Scheme
  /** BCP 47 tag the formatters read. Identical on server and client. */
  locale?: string
  /** `<html lang>`, written in an effect. Defaults to `locale`. */
  lang?: string
  /**
   * The link every link prop renders through: `routerDefaults().link` for an app on TanStack Router,
   * so a `string | NavTarget` target navigates without a document load. Omitted: a plain `<a>`.
   */
  link?: LinkComponent
  /**
   * A push binding (`bindInvalidation(queryClient, channel, o)`) started once on the client when the
   * provider mounts and stopped on unmount; a server render starts nothing. Pass a stable value
   * (module level): a new one stops the old and starts it.
   */
  live?: LiveBinding
  children?: ReactNode
}

/** `auto` is the attribute absent (the always-emitted OS media fallback applies). Storage may throw. */
function applyScheme(scheme: Scheme): void {
  const root = document.documentElement
  if (scheme === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', scheme)
  try {
    localStorage.setItem(SCHEME_KEY, scheme)
  } catch {
    // Private mode or a blocked store: the attribute alone still themes the page.
  }
}

/**
 * The app's root provider: scheme, locale, `<html lang>`, the installed link and an optional push
 * binding, nothing else. The entry imports it from `basalt-ui/router` beside `routerDefaults`, whose
 * `link` it takes.
 *
 * No `basalt-ui/ui/*` primitive needs it or a router: `primitive.contract.test.tsx` renders each with
 * none and inside one with no `link`. What each prop changes for an island: `docs/static-site.md`.
 *
 * @useWhen an app mounts its tree once at the entry, so the color scheme, the locale, the link every link prop renders through and the push binding are set in one place
 * @neverWhen a leaf renders on its own (it needs no provider: English, `auto` scheme, a plain anchor)
 *
 * @example
 * <BasaltProvider link={routerDefaults().link} locale="en">
 *   <RouterProvider router={router} />
 * </BasaltProvider>
 */
export function BasaltProvider({
  scheme,
  locale = DEFAULTS.locale,
  lang = locale,
  link,
  live,
  children,
}: BasaltProviderProps): ReactNode {
  const value = useMemo(
    () => ({ scheme: scheme ?? DEFAULTS.scheme, locale, lang }),
    [scheme, locale, lang],
  )

  useEffect(() => {
    if (scheme !== undefined) applyScheme(scheme)
  }, [scheme])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  useEffect(() => live?.start(), [live])

  const tree = <ProviderContext value={value}>{children}</ProviderContext>
  return link === undefined ? tree : <LinkContext value={link}>{tree}</LinkContext>
}
