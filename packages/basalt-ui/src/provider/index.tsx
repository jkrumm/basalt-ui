/**
 * BasaltProvider — the one provider tree (V2-SPEC § 2): `MantineProvider` with the Basalt theme and
 * resolver, the `--vx-*` palette `<style>`, and then
 * `QueryClientProvider > RouterProvider` with `Notifications` as a sibling. Spotlight, the modals
 * layer and the command hotkeys are slots: each mounts as a sibling only once the app's `defineNav` /
 * `defineCommands` / `defineOverlays` call registered it (`./slots`), so an app defining none ships none
 * of their runtimes. The consumer writes the route tree, the nav and the registries.
 *
 * It also owns the root error boundary, the `window` error listeners and the telemetry seam
 * (V2-SPEC § 7), the command hotkeys and Spotlight actions, and — in dev only — the dev dock.
 *
 * The palette injection is pure CSS keyed off Mantine's `[data-mantine-color-scheme]` attribute, so
 * dark/light resolution needs no React re-render.
 */
import { MantineProvider, useMantineColorScheme, useMantineTheme } from '@mantine/core'
import type { MantineProviderProps } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { RouterProvider, useRouter } from '@tanstack/react-router'
import type { AnyRouter } from '@tanstack/react-router'
import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import fallbackClasses from './error-fallback.module.css'
import sharedFallback from './fallback.module.css'
import { cssVariablesResolver } from '../theme'
import { useLabTheme } from './lab-theme'
import { buildDensityCss, buildFontsCss, buildPaletteCss, buildRadiusCss } from '../tokens/core'
import type { BuildPaletteOpts } from '../tokens/core'
import { isDefaultDeriveConfig } from '../tokens/derive'
import { buildPaletteData } from '../tokens/palette'
import { useMediaQuery } from '../common/use-media-query'
import { registerColorSchemeSetter } from '../commands/shell-bridge'
import { useIsomorphicLayoutEffect } from '../common/isomorphic-layout-effect'
import { defineFormat } from '../format/shared'
import type { FormatDefaults } from '../format/shared'
import { PageTitle } from '../shell/page-title'
import { SizeClassHintContext } from '../shell/use-size-class'
import type { SizeClass } from '../shell/use-size-class'
import {
  TelemetryContext,
  bindRouteError,
  createLiveEmitter,
  devConsoleSink,
  errorName,
  groupingId,
  now,
} from '../telemetry'
import type { Telemetry } from '../telemetry'
import type { BasaltDevDockTool } from '../dev-dock'
import type { BasaltRouter, BasaltRouterContext } from './create-router'
import type { FlatNavItem } from '../router-tanstack/nav-stash'
import { trackProvider, useSlots } from './slots'
import type { SlotProps } from './slots'

type BasaltProviderCommonProps = {
  /** Theme override merged onto the Basalt base. Defaults to `createBasaltTheme()`. */
  theme?: MantineProviderProps['theme']
  /**
   * Typed events (V2-SPEC § 7) — navigations, route/query/mutation/render/window errors. Called
   * synchronously and wrapped in `try/catch`, so a throwing sink never breaks a render. Events carry
   * ids, hashes, counts and durations only. No sink, no events in production; in development an unset sink logs query and mutation failures to the console.
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
  /**
   * Label for the `nav.<id>` Spotlight entries generated from `defineNav`, e.g.
   * `(item) => `Go to ${item.label}``. Default: the destination's own label. A `defineCommands`
   * entry with id `nav.<id>` replaces the generated one outright.
   */
  navCommandLabel?: (item: FlatNavItem) => string
  /**
   * Mount Basalt's `<Spotlight>` (Cmd+K) with the generated nav + command actions. Default `true`, and
   * it mounts only when the app calls `defineNav` or `defineCommands` (nav entries and commands are
   * what it lists). Set `false` when the app owns its own palette: neither the component nor its
   * action wiring mounts.
   */
  spotlight?: boolean
  /**
   * Default BCP-47 locale for every `basalt-ui/format` formatter that gets no per-call `locale`
   * (`integer(1112)` → `1,112` under `en-US`). Unset → the runtime's locale. This sets ONE
   * app-wide default per process (formatters are plain functions, not hooks); a per-call `locale`
   * is the per-request override. Removing the prop later does not unset it.
   */
  locale?: string
  /** Default IANA time zone for the date/time formatters. Unset → the runtime's zone. */
  timeZone?: string
} & Omit<MantineProviderProps, 'children' | 'theme' | 'defaultColorScheme' | 'cssVariablesResolver'>

/**
 * Two modes, never both: pass a `createBasaltRouter` `router` and the provider mounts it, or pass
 * `children` and render the provider INSIDE a router the app does not own (around the `<Outlet />`
 * of TanStack Start's root route component) — the router then comes from `useRouter()` and must carry
 * `context.queryClient`: spread `basaltRouterOptions()` into its `createRouter` (Start's `getRouter()`).
 */
export type BasaltProviderProps = BasaltProviderCommonProps &
  (
    | {
        /** From `createBasaltRouter`; the provider mounts it and reads its `queryClient`. */
        router: BasaltRouter
        children?: never
      }
    | {
        router?: never
        /** The subtree inside the app's own router; rendered where `<RouterProvider>` would be. */
        children: ReactNode
      }
  )

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
        className={sharedFallback.action}
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
    // `basaltRouterOptions`' `defaultOnCatch` reports to the handler bound here.
    const routeId = (): string => router.state.matches.at(-1)?.routeId ?? 'unknown'
    const onRouteError = (error: unknown): void =>
      emit({
        type: 'route.error',
        failed: true,
        start: now(),
        attributes: {
          'basalt.route.id': routeId(),
          'exception.type': errorName(error),
          'basalt.error.kind': 'route',
        },
      })
    const unbind = bindRouteError(router, onRouteError)

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
          'basalt.route.id': routeId(),
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
          'basalt.query.hash': groupingId(ev.query.queryHash),
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
          'basalt.mutation.key': groupingId(
            JSON.stringify(ev.mutation.options.mutationKey ?? null),
          ),
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
// The gate wraps `lazy()` itself so the dock chunks never ship; the consumer bundler must define
// `process.env.NODE_ENV` for the fold, as it already must for `lab-theme.ts`.

const loadDevDock = () => import('../dev-dock').then((m) => ({ default: m.BasaltDevDock }))
const LazyDevDock = process.env.NODE_ENV === 'production' ? null : lazy(loadDevDock)

function readQueryClient(router: AnyRouter): QueryClient {
  const client = (router.options.context as Partial<BasaltRouterContext> | undefined)?.queryClient
  if (client === undefined) {
    throw new Error(
      '[basalt] BasaltProvider: no context.queryClient — pass `router` from createBasaltRouter, ' +
        'or with `children` put a QueryClient in the router context.',
    )
  }
  return client
}

/**
 * The router this provider serves: the one it mounts (`router`), else — embedded mode — the one the
 * host already mounted above it. `warn: false`: mount mode sits ABOVE any router, so no context is
 * expected there. The context read is SSR-safe.
 */
function useEffectiveRouter(mounted: BasaltRouter | undefined): AnyRouter {
  const ambient: AnyRouter | undefined = useRouter<AnyRouter>({ warn: false })
  const router = mounted ?? ambient
  if (!router) {
    throw new Error(
      '[basalt] BasaltProvider: no router — pass `router` to mount one, or `children` inside one.',
    )
  }
  return router
}

// ── Public provider ───────────────────────────────────────────────────────────────────────────────

export function BasaltProvider({
  theme,
  telemetry,
  fallback,
  injectPalette = true,
  paletteOptions,
  defaultColorScheme = 'dark',
  nonce,
  sizeClassHint = 'compact',
  navCommandLabel,
  spotlight = true,
  locale,
  timeZone,
  router: mountedRouter,
  children,
  ...rest
}: BasaltProviderProps) {
  useDuplicateProviderGuard()
  useHostAttribute()
  // Applied during render so the first formatted child already sees it; only when a prop changed,
  // and only the props received (an unset one leaves an earlier value or a manual `defineFormat`).
  const appliedFormat = useRef<FormatDefaults>({})
  if (appliedFormat.current.locale !== locale || appliedFormat.current.timeZone !== timeZone) {
    appliedFormat.current = { locale, timeZone }
    defineFormat({ locale, timeZone })
  }

  // The sink is read through a ref, so an inline `telemetry` function does not re-subscribe.
  const sink = telemetry ?? (process.env.NODE_ENV === 'production' ? undefined : devConsoleSink)
  const sinkRef = useRef(sink)
  useEffect(() => {
    sinkRef.current = sink
  })
  const emit = useMemo(() => createLiveEmitter(() => sinkRef.current), [])
  useWindowErrors(emit)
  const slots = useSlots()
  // Tells the imperative overlay calls a provider is mounted to commit a slot they register late.
  useEffect(trackProvider, [])

  const router = useEffectiveRouter(mountedRouter)
  const client = readQueryClient(router)
  useDataTelemetry(router, client, emit)

  const [devTool, setDevTool] = useState<BasaltDevDockTool | null>(null)
  // `createBasaltTheme(theme)` — plus, when the theme lab's "Apply" switch is on, the delta of its
  // persisted config, so the dev tool moves the numeric `defaultProps` and `theme.spacing` a `<style>`
  // tag cannot reach. No lab override (every production app) → the consumer theme merged onto the
  // Basalt base and nothing else. See `./lab-theme.ts`.
  const resolvedTheme = useLabTheme(theme)
  const { modals: Modals, hotkeys: Hotkeys, spotlight: Spotlight } = slots
  const slotProps: SlotProps = { router, navCommandLabel, openDevTool: setDevTool }

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
          <TelemetryContext.Provider value={emit}>
            <SizeClassHintContext.Provider value={sizeClassHint}>
              <QueryClientProvider client={client}>
                {mountedRouter === undefined ? children : <RouterProvider router={mountedRouter} />}
                {/* A sibling, not a wrapper: a late `defineOverlays` mounts it without re-parenting the app. */}
                {Modals !== undefined && <Modals {...slotProps} />}
                {/* `LazyDevDock` is `null` in production (module-scope gate above), so nothing mounts. */}
                {LazyDevDock !== null && (
                  <Suspense fallback={null}>
                    <LazyDevDock tool={devTool} onClose={() => setDevTool(null)} router={router} />
                  </Suspense>
                )}
              </QueryClientProvider>
              <Notifications position="bottom-right" autoClose={4000} limit={5} />
              {Hotkeys !== undefined && <Hotkeys {...slotProps} />}
              {spotlight && Spotlight !== undefined && <Spotlight {...slotProps} />}
            </SizeClassHintContext.Provider>
          </TelemetryContext.Provider>
        </BasaltBridge>
      </RootBoundary>
    </MantineProvider>
  )
}
