/**
 * BasaltProvider — wraps `MantineProvider` with the Basalt theme, injects the `--vx-*` palette
 * stylesheet, and bridges Mantine's color scheme into the Vx chart theme context so chrome and
 * charts share one scheme-reactive identity.
 *
 * Grounded in argo: argo split this into `main.tsx` (the `MantineProvider` + `cssVariablesResolver`
 * wiring) and `charts-bridge.tsx` (the `VxBridge`: read the Mantine color scheme, provide the Vx
 * context, inject the palette `<style>`). Basalt folds the GENERIC half of both into one provider.
 * The DOMAIN half of argo's `main.tsx` — router, query client, app routes, auth gate, the concrete
 * series/sections — stays in the consumer and does NOT extract.
 *
 * The palette injection is pure CSS: the `<style>` emitted by `buildPaletteCss` keys off Mantine's
 * `[data-mantine-color-scheme]` attribute, so dark/light resolution needs no React re-render. The
 * Vx context still carries the resolved `colorScheme` for any non-color branching a chart may need.
 *
 * Mantine usage is allowed in this `./` root layer (unlike `src/charts/**` and `src/tokens/**`).
 */
import { MantineProvider, useComputedColorScheme, useMantineTheme } from '@mantine/core'
import type { MantineProviderProps } from '@mantine/core'
import { Component, useEffect, useMemo } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { VxThemeProvider } from '../charts/theme'
import { ConnectivityProvider } from '../connectivity'
import type { ConnectivityProviderProps } from '../connectivity'
import { cssVariablesResolver } from '../theme'
import { useLabTheme } from './lab-theme'
import { buildDensityCss, buildFontsCss, buildPaletteCss, buildRadiusCss } from '../tokens'
import type { BuildPaletteOpts } from '../tokens'
import { isDefaultDeriveConfig } from '../tokens/derive'
import { buildPaletteData } from '../tokens/palette'
import { isDev } from '../utils/is-dev'

/**
 * Where an error surfaced — drives consumer routing (a render error vs a global rejection differ).
 *
 * @example
 * <BasaltProvider
 *   onError={(e, ctx) => {
 *     if (ctx.kind === 'render') Sentry.captureException(e, { extra: { info: ctx.info } })
 *     if (ctx.kind === 'unhandledrejection') Sentry.captureException(e)
 *   }}
 * >
 */
export type BasaltErrorContext =
  | { kind: 'render'; info: ErrorInfo }
  | { kind: 'window'; event: ErrorEvent }
  | { kind: 'unhandledrejection'; reason: unknown }

export type BasaltProviderProps = {
  children: ReactNode
  /** Theme override merged onto the Basalt base. Omit to use the base theme as-is. */
  theme?: MantineProviderProps['theme']
  /**
   * Inject the `--vx-*` palette stylesheet once via an inline `<style>`. Default `true`. Set
   * `false` to skip it (SSR / head injection — emit `buildPaletteCss(paletteOptions)` yourself, all
   * three builders importable from `basalt-ui/tokens`).
   * A `{ fonts }` config passed to `createBasaltTheme` rides this SAME injection (its
   * `--basalt-font-*` declarations are appended to the same `<style>`), so `injectPalette={false}`
   * opts fonts out too — emit `buildFontsCss(theme.other.basaltFonts)` yourself alongside the
   * palette CSS in that case.
   * A `{ radius }` config rides the SAME injection too (its `--vx-radius-*` override declarations
   * are appended alongside), so `injectPalette={false}` opts radius out just the same — an SSR
   * consumer disabling injection must also emit `buildRadiusCss(theme.other.basaltRadius)`
   * themselves, or `var(--vx-radius-*)` consumers render at their defaults instead of the retuned
   * level.
   * A `{ density }` config rides the SAME injection too (its `--vx-space-*` override declarations
   * are appended alongside), so `injectPalette={false}` opts density out just the same — an SSR
   * consumer disabling injection must also emit `buildDensityCss(theme.other.basaltDensity)`
   * themselves, or `var(--vx-space-*)` consumers render at their defaults instead of the retuned
   * level.
   */
  injectPalette?: boolean
  /**
   * Passed through to `buildPaletteCss` so a consumer can append its own series/groups/derived
   * declarations on top of the framework primitives. Additive extension to the S0 stub shape.
   */
  paletteOptions?: BuildPaletteOpts
  /** Default color scheme. Defaults to dark. */
  defaultColorScheme?: MantineProviderProps['defaultColorScheme']
  /**
   * Report errors caught by the in-provider boundary AND global window/unhandledrejection listeners.
   * Unset → console.error in dev (process.env.NODE_ENV !== 'production'), no-op in prod.
   * NEVER a no-op prop — the BasaltErrorBoundary + listeners that feed it ship in this same freeze.
   *
   * @example
   * <BasaltProvider onError={(e, ctx) => Sentry.captureException(e, { tags: { kind: ctx.kind } })}>
   */
  onError?: (error: unknown, ctx: BasaltErrorContext) => void
  /**
   * CSP nonce for the raw palette `<style>` at provider/index.tsx (the one element `...rest`
   * cannot reach — it is basalt's own JSX, not a Mantine prop). For Mantine's own injected styles,
   * also pass `getStyleNonce={() => nonce}` via `...rest` — Mantine v9 has no top-level `nonce`
   * prop; its nonce mechanism is `getStyleNonce: () => string`, which flows through `...rest`.
   */
  nonce?: string
  /**
   * Options threaded through to the auto-mounted `ConnectivityProvider` (everything except
   * `children`) — `sseUrl`, `healthUrl`, `healthIntervalMs`, and `override` (previously
   * unreachable through `BasaltProvider`: the only way to reach it was a second, shadowing
   * `ConnectivityProvider`). Takes precedence over the deprecated flattened props below when both
   * are set.
   */
  connectivity?: Omit<ConnectivityProviderProps, 'children'>
  /**
   * @deprecated Use `connectivity={{ sseUrl }}` instead. Still honoured when `connectivity` is
   * unset or omits `sseUrl`; removed in 1.29.0.
   */
  sseUrl?: string
  /**
   * @deprecated Use `connectivity={{ healthUrl }}` instead. Still honoured when `connectivity` is
   * unset or omits `healthUrl`; removed in 1.29.0.
   */
  healthUrl?: string
  /**
   * @deprecated Use `connectivity={{ healthIntervalMs }}` instead. Still honoured when
   * `connectivity` is unset or omits `healthIntervalMs`; removed in 1.29.0.
   */
  healthIntervalMs?: number
} & Omit<MantineProviderProps, 'children' | 'theme' | 'defaultColorScheme' | 'cssVariablesResolver'>

// ── Default error handler ─────────────────────────────────────────────────────────────────────────

function defaultOnError(error: unknown, ctx: BasaltErrorContext): void {
  if (isDev()) {
    // eslint-disable-next-line no-console -- intentional dev-only diagnostic when no onError is supplied
    console.error('[BasaltProvider] unhandled error', ctx.kind, error)
  }
  // prod: no-op
}

// ── Error boundary ────────────────────────────────────────────────────────────────────────────────

type BoundaryProps = {
  children: ReactNode
  onError: (error: unknown, ctx: BasaltErrorContext) => void
  /** Optional UI to render when a render error is caught. If a function, called with the error. Defaults to null. */
  fallback?: ReactNode | ((error: unknown) => ReactNode)
}

type BoundaryState = { hasError: boolean; error: unknown }

/**
 * Error boundary that catches render-phase errors inside `BasaltProvider`. Wraps `BasaltBridge` +
 * children INSIDE `MantineProvider` so a thrown render error still has theme context for a fallback.
 * Also exported so consumers can mount nested boundaries with the same `onError` contract.
 *
 * @example
 * <BasaltErrorBoundary onError={(e, ctx) => Sentry.captureException(e)} fallback={<p>Something went wrong.</p>}>
 *   <MyFeature />
 * </BasaltErrorBoundary>
 */
export class BasaltErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  constructor(props: BoundaryProps) {
    super(props)
    this.state = { hasError: false, error: undefined }
  }

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    this.props.onError(error, { kind: 'render', info })
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      const { fallback } = this.props
      if (fallback === undefined) return null
      return typeof fallback === 'function' ? fallback(this.state.error) : fallback
    }
    return this.props.children
  }
}

/**
 * Compose the four independently-built override CSS blocks into ONE injected `<style>` body, in
 * cascade-winning order. Every builder (`buildPaletteCss`/`buildFontsCss`/`buildRadiusCss`/
 * `buildDensityCss`) emits its declarations under a bare `:root { ... }` block — EQUAL selector
 * specificity across all four — so nothing but DOCUMENT ORDER decides which value a browser paints
 * when two blocks declare the same custom property. `density` must come LAST (its `--vx-space-*`
 * overrides must out-cascade the base palette's own defaults), `radius` after `fonts`, `fonts` after
 * `base` — reorder this array and the density/radius/fonts knobs silently stop working, with every
 * OTHER existing test still green (each builder is tested for its OWN output in isolation, not for
 * where it lands in the concatenated string). Exported as a pure function (not inlined in
 * `BasaltBridge`'s `useMemo`) purely so `provider/index.test.ts` can assert the ORDER holds without
 * rendering a React tree.
 */
export function composeInjectedCss(
  base: string,
  fontsCss: string,
  radiusCss: string,
  densityCss: string,
): string {
  return [base, fontsCss, radiusCss, densityCss].filter(Boolean).join('\n')
}

// ── Inner bridge ──────────────────────────────────────────────────────────────────────────────────

/**
 * Inner bridge — must render INSIDE `MantineProvider` to read the active color scheme. Provides
 * the Vx chart theme context and injects the palette `<style>`. Mirrors argo's `VxBridge`.
 * Also registers global window error listeners for the `onError` contract.
 */
function BasaltBridge({
  children,
  injectPalette,
  paletteOptions,
  nonce,
  onError,
}: {
  children: ReactNode
  injectPalette: boolean
  paletteOptions: BuildPaletteOpts | undefined
  nonce: string | undefined
  onError: (error: unknown, ctx: BasaltErrorContext) => void
}) {
  // Resolve via Mantine's computed scheme so 'auto' follows the OS prefers-color-scheme
  // (fallback 'dark' before hydration, matching the provider's defaultColorScheme).
  const resolved = useComputedColorScheme('dark')

  // `createBasaltTheme`'s non-default `{ derive }` / `{ fonts }` / `{ radius }` / `{ density }`
  // paths stash the resolved values on `theme.other.basaltDerive` / `theme.other.basaltFonts` /
  // `theme.other.basaltRadius` / `theme.other.basaltDensity` — read them here (INSIDE
  // MantineProvider, so `useMantineTheme` sees the fully-merged runtime theme) to decide whether the
  // pre-baked static palette CSS still applies or a re-derived one is needed, and whether any
  // `--basalt-font-*` / `--vx-radius-*` / `--vx-space-*` override declarations must ride along.
  // Default/absent config -> zero extra derivation work.
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
    const fontsCss = buildFontsCss(fontsConfig)
    const radiusCss = buildRadiusCss(radiusConfig)
    const densityCss = buildDensityCss(densityConfig)
    return composeInjectedCss(base, fontsCss, radiusCss, densityCss)
  }, [injectPalette, deriveConfig, fontsConfig, radiusConfig, densityConfig, paletteOptions])

  useEffect(() => {
    // SSR guard — window is not available in server contexts
    if (typeof window === 'undefined') return

    const handleError = (e: ErrorEvent): void => {
      onError(e.error ?? e, { kind: 'window', event: e })
    }

    const handleUnhandledRejection = (e: PromiseRejectionEvent): void => {
      onError(e.reason, { kind: 'unhandledrejection', reason: e.reason })
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [onError])

  return (
    <VxThemeProvider colorScheme={resolved}>
      {injectPalette ? <style nonce={nonce}>{paletteCss}</style> : null}
      {children}
    </VxThemeProvider>
  )
}

// ── Duplicate-mount guard (F14) ───────────────────────────────────────────────────────────────────

/**
 * Module-level (deliberately NOT a per-instance ref, unlike `fence-block.tsx`'s warn-once gate) —
 * the whole point is detecting a SECOND, unrelated `BasaltProvider` mounted anywhere else in the
 * tree, which a per-instance gate could never see. Nested/duplicate providers double-mount
 * `MantineProvider`, the palette `<style>` and `ConnectivityProvider`'s signal listeners — real
 * misuse, not a false positive from React 18 StrictMode's double-invoke (that mounts/unmounts the
 * SAME instance in sequence, so the count returns to 0 before a second instance could ever exist).
 */
let mountedProviderCount = 0

function useDuplicateProviderGuard(): void {
  useEffect(() => {
    mountedProviderCount++
    if (mountedProviderCount > 1 && isDev()) {
      console.warn(
        '[basalt] BasaltProvider: more than one instance is mounted at once — nested/duplicate ' +
          'BasaltProviders double-mount MantineProvider, the palette <style> and ' +
          'ConnectivityProvider. Mount exactly one, at the app root.',
      )
    }
    return () => {
      mountedProviderCount--
    }
  }, [])
}

/**
 * Resolves the `connectivity` object against the three deprecated flattened props: `connectivity`
 * wins WHOLESALE when provided, not per-key — a partial `connectivity={{ sseUrl }}` no longer picks
 * up a stray `healthUrl` left on the old prop, which was surprising for a mid-migration consumer who
 * expected the new prop to fully replace the old ones once set. Warns once, dev builds only, when
 * both are actually supplied. Exported as a pure function (same rationale as `composeInjectedCss`
 * above) so `provider/index.test.ts` can assert the precedence without rendering a tree.
 */
export function resolveConnectivityProps(props: {
  connectivity: Omit<ConnectivityProviderProps, 'children'> | undefined
  sseUrl: string | undefined
  healthUrl: string | undefined
  healthIntervalMs: number | undefined
}): Omit<ConnectivityProviderProps, 'children'> {
  if (props.connectivity !== undefined) {
    const hasDeprecated =
      props.sseUrl !== undefined ||
      props.healthUrl !== undefined ||
      props.healthIntervalMs !== undefined
    if (hasDeprecated && isDev()) {
      console.warn(
        '[basalt] BasaltProvider: `connectivity` and one of `sseUrl`/`healthUrl`/`healthIntervalMs` ' +
          'were both supplied — `connectivity` wins wholesale and the deprecated props are ignored.',
      )
    }
    return props.connectivity
  }
  return {
    ...(props.sseUrl !== undefined ? { sseUrl: props.sseUrl } : {}),
    ...(props.healthUrl !== undefined ? { healthUrl: props.healthUrl } : {}),
    ...(props.healthIntervalMs !== undefined ? { healthIntervalMs: props.healthIntervalMs } : {}),
  }
}

// ── Public provider ───────────────────────────────────────────────────────────────────────────────

export function BasaltProvider({
  children,
  theme,
  injectPalette = true,
  paletteOptions,
  defaultColorScheme = 'dark',
  onError,
  nonce,
  connectivity,
  sseUrl,
  healthUrl,
  healthIntervalMs,
  ...rest
}: BasaltProviderProps) {
  useDuplicateProviderGuard()
  const errorHandler = onError ?? defaultOnError

  // `createBasaltTheme(theme)` — plus, when the theme lab's "Apply" switch is on, the delta of its
  // persisted config, so the dev tool moves the numeric `defaultProps` and `theme.spacing` a `<style>`
  // tag cannot reach. No lab override (every production app) → the consumer theme merged onto the
  // Basalt base and nothing else. See `./lab-theme.ts`.
  const resolvedTheme = useLabTheme(theme)

  const resolvedConnectivity = resolveConnectivityProps({
    connectivity,
    sseUrl,
    healthUrl,
    healthIntervalMs,
  })

  return (
    // `...rest` spreads FIRST so a consumer's `MantineProviderProps` can never shadow the three
    // values that follow it — `cssVariablesResolver` in particular is the resolver the package
    // exists to install (F24); `theme`/`defaultColorScheme` are excluded from `rest`'s type too,
    // this is belt-and-braces against a widened rest at the call site.
    <MantineProvider
      {...rest}
      theme={resolvedTheme}
      cssVariablesResolver={cssVariablesResolver}
      defaultColorScheme={defaultColorScheme}
    >
      <BasaltErrorBoundary onError={errorHandler}>
        <BasaltBridge
          injectPalette={injectPalette}
          paletteOptions={paletteOptions}
          nonce={nonce}
          onError={errorHandler}
        >
          <ConnectivityProvider {...resolvedConnectivity}>{children}</ConnectivityProvider>
        </BasaltBridge>
      </BasaltErrorBoundary>
    </MantineProvider>
  )
}
