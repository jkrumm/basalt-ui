/**
 * BasaltProvider — the one provider tree (V2-SPEC § 2): `MantineProvider` with the Basalt theme and
 * resolver, the `--vx-*` palette `<style>`, and then
 * `QueryClientProvider > ModalsProvider > RouterProvider` with `Notifications` and `Spotlight` as
 * siblings. The consumer writes the route tree, the nav and the registries.
 *
 * It also owns the root error boundary, the `window` error listeners and the telemetry seam
 * (V2-SPEC § 7), the command hotkeys and Spotlight actions, and — in dev only — the dev dock.
 *
 * The palette injection is pure CSS keyed off Mantine's `[data-mantine-color-scheme]` attribute, so
 * dark/light resolution needs no React re-render.
 */
import { MantineProvider, useMantineColorScheme, useMantineTheme } from '@mantine/core'
import type { MantineProviderProps } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import { Spotlight } from '@mantine/spotlight'
import type { SpotlightActionData } from '@mantine/spotlight'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import type { AnyRouter } from '@tanstack/react-router'
import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import fallbackClasses from './error-fallback.module.css'
import { cssVariablesResolver } from '../theme'
import { useLabTheme } from './lab-theme'
import { buildDensityCss, buildFontsCss, buildPaletteCss, buildRadiusCss } from '../tokens/core'
import type { BuildPaletteOpts } from '../tokens/core'
import { isDefaultDeriveConfig } from '../tokens/derive'
import { buildPaletteData } from '../tokens/palette'
import { useMediaQuery } from '../common/use-media-query'
import { registerModalsProvider } from '../commands/define-overlays'
import { registerColorSchemeSetter } from '../commands/shell-bridge'
import { useIsomorphicLayoutEffect } from '../common/isomorphic-layout-effect'
import { PageTitle } from '../shell/page-title'
import { SizeClassHintContext } from '../shell/use-size-class'
import type { SizeClass } from '../shell/use-size-class'
import { bindRouterTelemetry, createEmitter, errorName, now } from '../telemetry'
import type { Telemetry } from '../telemetry'
import type { BasaltDevDockTool } from '../dev-dock'
import type { BasaltRouter, BasaltRouterContext } from './create-router'
import { useRegistryHotkeys } from './hotkeys'
import { buildSpotlightActions } from './spotlight-actions'

export type BasaltProviderProps = {
  /** From `createBasaltRouter`; the provider mounts it and reads its `queryClient`. */
  router: BasaltRouter
  /** Theme override merged onto the Basalt base. Defaults to `createBasaltTheme()`. */
  theme?: MantineProviderProps['theme']
  /**
   * Typed events (V2-SPEC § 7) — navigations, route/query/mutation/render/window errors. Called
   * synchronously and wrapped in `try/catch`, so a throwing sink never breaks a render. Events carry
   * ids, hashes, counts and durations only; no sink, no events.
   */
  telemetry?: Telemetry
  /** The root error boundary's UI. Unset → a minimal page with a reload button; `null` renders nothing. */
  fallback?: ReactNode | ((error: unknown) => ReactNode)
  /**
   * Inject the `--vx-*` palette stylesheet once via an inline `<style>`. Default `true`. Set
   * `false` to skip it (SSR / head injection — emit `buildPaletteCss(paletteOptions)` yourself).
   * Fonts, radius and density configs ride the same injection, so `false` opts them out too.
   */
  injectPalette?: boolean
  /**
   * Passed through to `buildPaletteCss` so a consumer can append its own series/groups/derived
   * declarations on top of the framework primitives.
   */
  paletteOptions?: BuildPaletteOpts
  /** Default color scheme. Defaults to dark. */
  defaultColorScheme?: MantineProviderProps['defaultColorScheme']
  /**
   * CSP nonce for the raw palette `<style>` (the one element `...rest` cannot reach). For Mantine's
   * own injected styles also pass `getStyleNonce={() => nonce}` via `...rest`.
   */
  nonce?: string
  /**
   * The size class `useSizeClass()` reports on the server and during hydration, before `matchMedia`
   * can answer. Default `'compact'`. SSR only; an SSR desktop app SHOULD pass it.
   */
  sizeClassHint?: SizeClass
} & Omit<MantineProviderProps, 'children' | 'theme' | 'defaultColorScheme' | 'cssVariablesResolver'>

// ── Root error boundary ───────────────────────────────────────────────────────────────────────────

type RootBoundaryProps = {
  children: ReactNode
  emit: Telemetry
  fallback: BasaltProviderProps['fallback']
}

type BoundaryState = { hasError: boolean; error: unknown }

/**
 * The boundary's own default fallback — a `PageTitle` plus a plain reload affordance. Deliberately
 * minimal: a consumer wanting session ids or a "try to recover" reset passes its own `fallback`.
 */
function DefaultErrorFallback(): ReactNode {
  return (
    <div className={fallbackClasses.root}>
      <PageTitle
        title="Something went wrong"
        subtitle="The page hit an unexpected error and was unloaded to keep the app stable."
      />
      <button
        type="button"
        className={fallbackClasses.reload}
        onClick={() => window.location.reload()}
      >
        Reload page
      </button>
    </div>
  )
}

/** Catches render-phase errors inside `MantineProvider`, so a fallback still has theme context. */
export class RootBoundary extends Component<RootBoundaryProps, BoundaryState> {
  constructor(props: RootBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: undefined }
  }

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: unknown, _info: ErrorInfo): void {
    if (process.env.NODE_ENV !== 'production') console.error('[basalt] render error', error)
    this.props.emit({
      type: 'render.error',
      failed: true,
      start: now(),
      attributes: {
        'exception.type': errorName(error),
        'basalt.error.kind': 'render',
        'basalt.error.boundary': 'root',
      },
    })
  }

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children
    const { fallback } = this.props
    if (fallback === undefined) return <DefaultErrorFallback />
    if (fallback === null) return null
    return typeof fallback === 'function' ? fallback(this.state.error) : fallback
  }
}

/**
 * Compose the four independently-built override CSS blocks into ONE injected `<style>` body, in
 * cascade-winning order. Every builder emits its declarations under a bare `:root { ... }` block —
 * EQUAL selector specificity — so nothing but DOCUMENT ORDER decides which value a browser paints.
 * `density` must come LAST, `radius` after `fonts`, `fonts` after `base`; reorder this array and the
 * knobs silently stop working. Exported as a pure function so a test can assert the ORDER.
 */
export function composeInjectedCss(
  base: string,
  fontsCss: string,
  radiusCss: string,
  densityCss: string,
): string {
  return [base, fontsCss, radiusCss, densityCss].filter(Boolean).join('\n')
}

// ── Host attribute ────────────────────────────────────────────────────────────────────────────────

/** A module-level mount count across every `BasaltProvider`; each call returns the new count. */
function createMountCounter(): { mount: () => number; unmount: () => number } {
  let count = 0
  return { mount: () => ++count, unmount: () => --count }
}

const hostAttributeMounts = createMountCounter()

/**
 * `data-basalt-host` on `<html>` — the one place a `display-mode` query is read; CSS keys off it.
 *
 * The layout effect below lands the attribute before the browser paints the CLIENT render — true
 * only for a client-rendered app. An SSR'd document paints its server HTML (with no
 * `data-basalt-host` yet, since `display-mode` is a client-only read) before hydration ever reaches
 * this effect, so a PWA can still flash web chrome across that server-to-hydration gap; this only
 * closes the gap between hydration and the next client paint.
 */
export function useHostAttribute(): void {
  const isPwa = useMediaQuery('(display-mode: standalone)', false)

  useIsomorphicLayoutEffect(() => {
    document.documentElement.setAttribute('data-basalt-host', isPwa ? 'pwa' : 'web')
  }, [isPwa])

  // Ref-counted across every mounted `BasaltProvider`: a second provider (a nested route wrapping
  // its own, two trees on one page) unmounting must not rip the attribute out from under a first
  // one still mounted; only the LAST unmount removes it. Deliberately a SEPARATE effect from the one
  // above: sharing one keyed on `[isPwa]` would decrement this counter on every `isPwa` change.
  useIsomorphicLayoutEffect(() => {
    hostAttributeMounts.mount()
    return () => {
      if (hostAttributeMounts.unmount() === 0) {
        document.documentElement.removeAttribute('data-basalt-host')
      }
    }
  }, [])
}

// ── Inner bridge ──────────────────────────────────────────────────────────────────────────────────

/**
 * Inner bridge — must render INSIDE `MantineProvider` (it reads the theme and registers the
 * color-scheme handle). Injects the palette `<style>`; charts paint through those CSS variables.
 */
function BasaltBridge({
  children,
  injectPalette,
  paletteOptions,
  nonce,
}: {
  children: ReactNode
  injectPalette: boolean
  paletteOptions: BuildPaletteOpts | undefined
  nonce: string | undefined
}) {
  // `commands/shell-bridge.ts`'s `setColorScheme` handle — registered here (already inside
  // `MantineProvider`) so a consumer's `commands.tsx` calls it with ZERO `__root.tsx` wiring.
  const { setColorScheme: setMantineColorScheme } = useMantineColorScheme()
  useEffect(() => {
    registerColorSchemeSetter(setMantineColorScheme)
    return () => registerColorSchemeSetter(null)
  }, [setMantineColorScheme])

  // `createBasaltTheme`'s non-default `{ derive }` / `{ fonts }` / `{ radius }` / `{ density }`
  // paths stash the resolved values on `theme.other.basalt*` — read them here (INSIDE
  // MantineProvider, so `useMantineTheme` sees the fully-merged runtime theme) to decide whether the
  // pre-baked static palette CSS still applies or a re-derived one is needed.
  const theme = useMantineTheme()
  const deriveConfig = theme.other?.basaltDerive
  const fontsConfig = theme.other?.basaltFonts
  const radiusConfig = theme.other?.basaltRadius
  const densityConfig = theme.other?.basaltDensity
  const paletteCss = useMemo(() => {
    if (!injectPalette) return ''
    const base =
      deriveConfig === undefined || isDefaultDeriveConfig(deriveConfig)
        ? buildPaletteCss(paletteOptions)
        : // Memoized by `buildPaletteData` (keyed on the config value), so retuning is never a
          // per-render re-derivation once a given config has been built once.
          buildPaletteCss(paletteOptions, buildPaletteData(deriveConfig))
    return composeInjectedCss(
      base,
      buildFontsCss(fontsConfig),
      buildRadiusCss(radiusConfig),
      buildDensityCss(densityConfig),
    )
  }, [injectPalette, deriveConfig, fontsConfig, radiusConfig, densityConfig, paletteOptions])

  return (
    <>
      {injectPalette ? <style nonce={nonce}>{paletteCss}</style> : null}
      {children}
    </>
  )
}

// ── Duplicate-mount guard (F14) ───────────────────────────────────────────────────────────────────

/**
 * Module-level (deliberately NOT a per-instance ref, unlike `fence-block.tsx`'s warn-once gate) —
 * the whole point is detecting a SECOND, unrelated `BasaltProvider` mounted anywhere else in the
 * tree, which a per-instance gate could never see. Nested/duplicate providers double-mount
 * `MantineProvider`, the palette `<style>`, the router and the overlays — real
 * misuse, not a false positive from React 18 StrictMode's double-invoke (that mounts/unmounts the
 * SAME instance in sequence, so the count returns to 0 before a second instance could ever exist).
 */
const providerMounts = createMountCounter()

function useDuplicateProviderGuard(): void {
  useEffect(() => {
    if (providerMounts.mount() > 1 && process.env.NODE_ENV !== 'production') {
      console.warn(
        '[basalt] BasaltProvider: more than one instance is mounted at once — nested/duplicate ' +
          'BasaltProviders double-mount MantineProvider, the palette <style>, the router and the ' +
          'overlays. Mount exactly one, at the app root.',
      )
    }
    return () => void providerMounts.unmount()
  }, [])
}

// ── Telemetry sources ─────────────────────────────────────────────────────────────────────────────

/** `window` `error` / `unhandledrejection` → `window.error`. */
function useWindowErrors(emit: Telemetry): void {
  useEffect(() => {
    const report = (source: 'error' | 'unhandledrejection', error: unknown): void => {
      if (process.env.NODE_ENV !== 'production') console.error(`[basalt] ${source}`, error)
      emit({
        type: 'window.error',
        failed: true,
        start: now(),
        attributes: {
          'exception.type': errorName(error),
          'basalt.error.kind': source === 'error' ? 'window' : 'unhandledrejection',
          'basalt.error.source': source,
        },
      })
    }
    const onError = (e: ErrorEvent): void => report('error', e.error ?? e)
    const onRejection = (e: PromiseRejectionEvent): void => report('unhandledrejection', e.reason)
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [emit])
}

/** Router navigations and the QueryClient's caches → `route.*`, `query.error`, `mutation.error`. */
function useDataTelemetry(router: AnyRouter, client: QueryClient, emit: Telemetry): void {
  useEffect(() => {
    const unbind = bindRouterTelemetry(router, emit)

    // Keyed by the target href: a newer navigation overwrites, and a resolve for any other target
    // (a superseded or redirected navigation) is dropped rather than paired with the wrong start.
    let pending: { href: string; start: number; from: string } | undefined
    const offBefore = router.subscribe('onBeforeNavigate', (ev) => {
      pending = { href: ev.toLocation.href, start: now(), from: ev.fromLocation?.pathname ?? '' }
    })
    const offResolved = router.subscribe('onResolved', (ev) => {
      if (pending?.href !== ev.toLocation.href) return
      const { start, from } = pending
      pending = undefined
      emit({
        type: 'route.navigate',
        failed: false,
        start,
        duration: now() - start,
        attributes: {
          'basalt.route.id': router.state.matches.at(-1)?.routeId ?? 'unknown',
          'basalt.route.from': from,
          'url.path': ev.toLocation.pathname,
        },
      })
    })

    const offQuery = client.getQueryCache().subscribe((ev) => {
      if (ev.type !== 'updated' || ev.action.type !== 'error') return
      emit({
        type: 'query.error',
        failed: true,
        start: now(),
        attributes: {
          'basalt.query.hash': ev.query.queryHash,
          'basalt.query.failure_count': ev.query.state.fetchFailureCount,
          'exception.type': errorName(ev.action.error),
          'basalt.error.kind': 'query',
        },
      })
    })
    const offMutation = client.getMutationCache().subscribe((ev) => {
      if (ev.type !== 'updated' || ev.action.type !== 'error') return
      emit({
        type: 'mutation.error',
        failed: true,
        start: now(),
        attributes: {
          'basalt.mutation.key': JSON.stringify(ev.mutation.options.mutationKey ?? null),
          'exception.type': errorName(ev.action.error),
          'basalt.error.kind': 'mutation',
        },
      })
    })

    return () => {
      unbind()
      offBefore()
      offResolved()
      offQuery()
      offMutation()
    }
  }, [router, client, emit])
}

// ── Dev dock (dev-only, behind a literal NODE_ENV read at the lazy site) ──────────────────────────

const LazyDevDock = lazy(() => import('../dev-dock').then((m) => ({ default: m.BasaltDevDock })))

function readQueryClient(router: AnyRouter): QueryClient {
  const client = (router.options.context as Partial<BasaltRouterContext> | undefined)?.queryClient
  if (client === undefined) {
    throw new Error(
      '[basalt] BasaltProvider: the router has no context.queryClient — create it with ' +
        'createBasaltRouter({ routeTree }).',
    )
  }
  return client
}

// ── Public provider ───────────────────────────────────────────────────────────────────────────────

export function BasaltProvider({
  router,
  theme,
  telemetry,
  fallback,
  injectPalette = true,
  paletteOptions,
  defaultColorScheme = 'dark',
  nonce,
  sizeClassHint = 'compact',
  ...rest
}: BasaltProviderProps) {
  useDuplicateProviderGuard()
  useHostAttribute()

  // The sink is read through a ref, so an inline `telemetry` function does not re-subscribe.
  const sinkRef = useRef(telemetry)
  useEffect(() => {
    sinkRef.current = telemetry
  })
  const emit = useMemo(() => createEmitter((event) => sinkRef.current?.(event)), [])
  useWindowErrors(emit)
  useRegistryHotkeys()
  // `overlays.confirm` is an imperative call; this tells it a `ModalsProvider` is live.
  useEffect(() => registerModalsProvider(), [])

  const client = readQueryClient(router)
  useDataTelemetry(router, client, emit)

  const [devTool, setDevTool] = useState<BasaltDevDockTool | null>(null)
  // Rebuilt on mount and again at every open, so a command's `when()` is read when the palette
  // appears, not frozen at mount — and `detectMac` (inside the builder) never runs during render.
  const [actions, setActions] = useState<SpotlightActionData[]>([])
  const refreshActions = useCallback(
    () => setActions(buildSpotlightActions(router, setDevTool)),
    [router],
  )
  useEffect(refreshActions, [refreshActions])

  // `createBasaltTheme(theme)` — plus, when the theme lab's "Apply" switch is on, the delta of its
  // persisted config, so the dev tool moves the numeric `defaultProps` and `theme.spacing` a `<style>`
  // tag cannot reach. No lab override (every production app) → the consumer theme merged onto the
  // Basalt base and nothing else. See `./lab-theme.ts`.
  const resolvedTheme = useLabTheme(theme)

  return (
    // `...rest` spreads FIRST so a consumer's `MantineProviderProps` can never shadow the three
    // values that follow it — `cssVariablesResolver` in particular is the resolver the package
    // exists to install.
    <MantineProvider
      {...rest}
      theme={resolvedTheme}
      cssVariablesResolver={cssVariablesResolver}
      defaultColorScheme={defaultColorScheme}
    >
      <RootBoundary emit={emit} fallback={fallback}>
        <BasaltBridge injectPalette={injectPalette} paletteOptions={paletteOptions} nonce={nonce}>
          <SizeClassHintContext.Provider value={sizeClassHint}>
            <QueryClientProvider client={client}>
              {/* ModalsProvider WRAPS the router, so `useModals()` / `openContextModal` have real context. */}
              <ModalsProvider>
                <RouterProvider router={router} />
                {/* The literal read sits at the branch, so a production build drops the import. */}
                {process.env.NODE_ENV !== 'production' && (
                  <Suspense fallback={null}>
                    <LazyDevDock tool={devTool} onClose={() => setDevTool(null)} router={router} />
                  </Suspense>
                )}
              </ModalsProvider>
            </QueryClientProvider>
            <Notifications position="bottom-right" autoClose={4000} limit={5} />
            <Spotlight
              actions={actions}
              onSpotlightOpen={refreshActions}
              shortcut="mod + K"
              maxHeight={420}
            />
          </SizeClassHintContext.Provider>
        </BasaltBridge>
      </RootBoundary>
    </MantineProvider>
  )
}
