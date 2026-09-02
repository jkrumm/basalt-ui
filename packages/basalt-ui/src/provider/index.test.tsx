/**
 * `composeInjectedCss` — the CSS-cascade ORDER of the four override blocks `BasaltBridge` injects.
 * `buildPaletteCss`/`buildFontsCss`/`buildRadiusCss`/`buildDensityCss` all emit a bare `:root { ... }`
 * block, so they tie on selector specificity; only document order decides which declaration a
 * browser actually paints when two blocks declare the same `--vx-*`/`--basalt-font-*` var. Reordering
 * the array `composeInjectedCss` concatenates silently breaks the density/radius/fonts knobs with
 * every OTHER existing test still green (each builder's own test only checks its OWN isolated
 * output) — this file is the one place that ordering itself is under test (Fix 5 / B5).
 *
 * The `BasaltBridge density wiring` block below covers the layer `composeInjectedCss` alone can't:
 * that `BasaltBridge` (not just the pure `composeInjectedCss` helper) actually reads
 * `theme.other.basaltDensity` off the RUNNING theme and feeds it through `buildDensityCss` into the
 * injected `<style>`, end to end from `createBasaltTheme(undefined, { density })`. A DOM harness now
 * exists (`tests/setup/dom.ts`, preloaded via the root `bunfig.toml`) — this suite still uses
 * `react-dom/server`'s `renderToStaticMarkup` deliberately, since the injected `<style>` is plain
 * text content on server-rendered markup, not something that needs a live DOM to assert on.
 * Converting this to mount through the DOM harness would only be worth it if a future assertion here
 * needed live DOM behavior (event handling, layout, effects) rather than the static markup string.
 */
import { render } from '@testing-library/react'
import { describe, expect, spyOn, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { BasaltProvider, composeInjectedCss } from './index'
import { useConnectivity } from './use-connectivity'
import { createBasaltTheme } from '../theme'
import { buildDensityCss, buildFontsCss, buildPaletteCss, buildRadiusCss } from '../tokens'
import { deriveRadius, deriveSpacing } from '../tokens/palette'

describe('composeInjectedCss orders overrides so density/radius/fonts win the cascade over the base palette', () => {
  test('density block is textually LAST in the composed string — same :root selector, so document order decides', () => {
    const base = buildPaletteCss()
    const densityCss = buildDensityCss(deriveSpacing(3))
    const composed = composeInjectedCss(base, '', '', densityCss)
    expect(composed.indexOf(densityCss)).toBeGreaterThan(composed.indexOf(base))
  })

  test('a real declaration resolves to the LAST occurrence in composed order — the actual mechanism a browser cascade uses, not just index order', () => {
    // base emits --vx-space-row-inset-x: 10px (level 0); density (level 3) overrides it to 13px.
    const base = buildPaletteCss()
    const densityCss = buildDensityCss(deriveSpacing(3))
    const composed = composeInjectedCss(base, '', '', densityCss)
    const matches = [...composed.matchAll(/--vx-space-row-inset-x: (\d+)px;/g)].map((m) => m[1])
    expect(matches).toEqual(['10', '13'])
  })

  test('radius overrides resolve to their retuned value at the end of the composed string too', () => {
    const base = buildPaletteCss()
    const radiusCss = buildRadiusCss(deriveRadius(3))
    const composed = composeInjectedCss(base, '', radiusCss, '')
    const matches = [...composed.matchAll(/--vx-radius-card: (\d+)px;/g)].map((m) => m[1])
    expect(matches.at(-1)).toBe(String(deriveRadius(3).card))
    expect(matches.at(-1)).not.toBe(String(deriveRadius(0).card))
  })

  test('fonts overrides land at the end of the composed string too (base emits no --basalt-font-* at all)', () => {
    const base = buildPaletteCss()
    const fontsCss = buildFontsCss({ sans: 'CustomFont, sans-serif' })
    const composed = composeInjectedCss(base, fontsCss, '', '')
    expect(base).not.toContain('--basalt-font-sans')
    expect(composed.trim().endsWith(fontsCss.trim())).toBe(true)
  })

  test('regression proof: reversing the order (the exact defect this file guards against) flips which value wins', () => {
    const base = buildPaletteCss()
    const densityCss = buildDensityCss(deriveSpacing(3))
    // The OLD/broken shape this order could silently regress to — density concatenated BEFORE base.
    const brokenComposed = [densityCss, base].filter(Boolean).join('\n')
    const matches = [...brokenComposed.matchAll(/--vx-space-row-inset-x: (\d+)px;/g)].map(
      (m) => m[1],
    )
    // Base now wins over density (LAST occurrence is the un-retuned 10, not 13) — the exact silent
    // breakage `composeInjectedCss`'s fixed order exists to prevent.
    expect(matches.at(-1)).toBe('10')
  })
})

describe('BasaltBridge reads theme.other.basaltDensity and injects it end to end', () => {
  test('a non-default density option lands its buildDensityCss output in the rendered <style>', () => {
    const html = renderToStaticMarkup(
      <BasaltProvider theme={createBasaltTheme(undefined, { density: -2 })}>
        <div>content</div>
      </BasaltProvider>,
    )
    // Fails if `BasaltBridge` stops reading `theme.other.basaltDensity` (e.g. reads a different key,
    // or never passes it to `buildDensityCss`) — the exact retuned block would then be absent.
    expect(html).toContain(buildDensityCss(deriveSpacing(-2)))
  })

  test('the default (level-0) theme injects no density override block at all', () => {
    const html = renderToStaticMarkup(
      <BasaltProvider theme={createBasaltTheme()}>
        <div>content</div>
      </BasaltProvider>,
    )
    // Fails if `BasaltBridge` injects a density block even when `theme.other.basaltDensity` is unset
    // (`createBasaltTheme()`'s default path never sets it — `density-option.test.ts`). The BASE
    // palette CSS already emits `--vx-space-row-inset-x` once (`frameworkDerived`'s own
    // `DEFAULT_SPACE_VALUES` decls) — a stray SECOND occurrence is the signature of an unwanted
    // density override block getting appended on top of it.
    expect(html).not.toContain(buildDensityCss(deriveSpacing(-2)))
    expect(html.split('--vx-space-row-inset-x').length - 1).toBe(1)
  })
})

function ConnectivityStatusProbe() {
  const { status } = useConnectivity()
  return <span data-testid="status">{status}</span>
}

describe('BasaltProvider connectivity prop reaches ConnectivityProvider end to end (A11)', () => {
  test('`connectivity.override` resolves the aggregated status read back through useConnectivity()', () => {
    const { getByTestId } = render(
      <BasaltProvider connectivity={{ override: { browserOnline: false } }}>
        <ConnectivityStatusProbe />
      </BasaltProvider>,
    )
    // Before this fix the only way to reach `override` was mounting a SECOND, shadowing
    // `ConnectivityProvider` — this proves the prop threaded through `BasaltProvider` itself works.
    expect(getByTestId('status').textContent).toBe('offline')
  })
})

describe('BasaltProvider duplicate-mount guard (F14)', () => {
  test('mounting a single BasaltProvider does not warn', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    const { unmount } = render(
      <BasaltProvider>
        <div>content</div>
      </BasaltProvider>,
    )
    expect(warn).not.toHaveBeenCalled()
    unmount()
    warn.mockRestore()
  })

  test('mounting a second BasaltProvider while the first is still mounted warns', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    const first = render(
      <BasaltProvider>
        <div>a</div>
      </BasaltProvider>,
    )
    const second = render(
      <BasaltProvider>
        <div>b</div>
      </BasaltProvider>,
    )
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('more than one instance')
    first.unmount()
    second.unmount()
    warn.mockRestore()
  })

  test('in a production build, mounting a second BasaltProvider does NOT warn — isDev() folds to false', () => {
    const originalEnv = process.env['NODE_ENV']
    process.env['NODE_ENV'] = 'production'
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const first = render(
        <BasaltProvider>
          <div>a</div>
        </BasaltProvider>,
      )
      const second = render(
        <BasaltProvider>
          <div>b</div>
        </BasaltProvider>,
      )
      expect(warn).not.toHaveBeenCalled()
      first.unmount()
      second.unmount()
    } finally {
      warn.mockRestore()
      if (originalEnv === undefined) delete process.env['NODE_ENV']
      else process.env['NODE_ENV'] = originalEnv
    }
  })
})

describe('BasaltProvider cssVariablesResolver precedence — the rest spread can never reach it (F24, runtime)', () => {
  // `theme` and `defaultColorScheme` are legitimate, explicitly-typed `BasaltProviderProps` fields
  // — a consumer is meant to override them (`theme` is merged via `useLabTheme`; `defaultColorScheme`
  // defaults to 'dark' but is a real prop), so neither is something `...rest` could smuggle in the
  // first place. `cssVariablesResolver` is the one field `Omit`ted from the accepted type ENTIRELY —
  // there is no prop path to it at all, typed or not — pinned at compile time by
  // `index.type-guard.test.ts`. This is the runtime half: even a caller that bypasses the type check
  // with a cast to smuggle `cssVariablesResolver` through the rest object can never make it reach
  // `MantineProvider`, because `{...rest}` is spread BEFORE basalt's own `cssVariablesResolver` prop
  // in JSX, and the later, explicit prop always wins the object merge.
  test('a cssVariablesResolver smuggled through rest past the type check is never invoked', () => {
    let maliciousResolverCalled = false
    const maliciousResolver = () => {
      maliciousResolverCalled = true
      return { variables: {}, light: {}, dark: {} }
    }
    const propsWithResolver = {
      children: <div>content</div>,
      cssVariablesResolver: maliciousResolver,
    } as unknown as Parameters<typeof BasaltProvider>[0]
    render(<BasaltProvider {...propsWithResolver} />)
    expect(maliciousResolverCalled).toBe(false)
  })
})
