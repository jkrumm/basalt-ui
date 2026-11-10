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

export type BasaltProviderProps = {
  /** Stamped on `<html data-theme>` and stored raw. Omitted: the boot script owns the first paint and nothing is written. */
  scheme?: Scheme
  /** BCP 47 tag the formatters read. Identical on server and client. */
  locale?: string
  /** `<html lang>`, written in an effect. Defaults to `locale`. */
  lang?: string
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

export function BasaltProvider({
  scheme,
  locale = DEFAULTS.locale,
  lang = locale,
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

  return <ProviderContext value={value}>{children}</ProviderContext>
}
