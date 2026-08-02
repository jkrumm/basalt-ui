/**
 * `useBasaltSpacing` — the only path by which a non-default density level reaches `BasaltShell`'s
 * AppShell header/navbar/rail dimensions and `AppSidebar`/`SidebarAccount`'s `<Menu width>` (see the
 * hook's own doc). Nothing previously asserted it actually reads `theme.other.basaltDensity` off the
 * running Mantine theme — that wiring could silently break (e.g. a typo'd key, or a dropped fallback)
 * with every other density test still green, since those all exercise `deriveSpacing`/
 * `createBasaltTheme` directly, never this hook.
 *
 * A DOM harness now exists (`tests/setup/dom.ts`, preloaded via the root `bunfig.toml`; see
 * `tokens/build-fonts-css.test.ts`'s doc for that same note elsewhere) — this suite still uses
 * `react-dom/server`'s `renderToStaticMarkup` deliberately: it's enough to invoke a hook inside a
 * REAL `MantineProvider` tree without a DOM, so these assertions exercise the actual
 * `useMantineTheme()` read, not a re-implementation of it. Converting to the DOM harness would only
 * be worth it if a future assertion here needed the hook to react to a live DOM event (e.g. a
 * `ResizeObserver`-driven remeasure) rather than a single render-time read.
 */
import { MantineProvider } from '@mantine/core'
import type { MantineProviderProps } from '@mantine/core'
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { DEFAULT_SPACE_VALUES, deriveSpacing } from '../tokens/palette'
import { useBasaltSpacing } from './use-basalt-spacing'

function readBasaltSpacing(theme?: MantineProviderProps['theme']) {
  let captured: ReturnType<typeof useBasaltSpacing> | undefined
  function Probe() {
    captured = useBasaltSpacing()
    return null
  }
  renderToStaticMarkup(
    <MantineProvider theme={theme}>
      <Probe />
    </MantineProvider>,
  )
  return captured
}

describe('useBasaltSpacing', () => {
  test('falls back to DEFAULT_SPACE_VALUES when theme.other.basaltDensity is unset', () => {
    // Fails if the hook drops its `?? DEFAULT_SPACE_VALUES` fallback (e.g. returns `undefined` at
    // the shipped default density instead).
    expect(readBasaltSpacing()).toEqual(DEFAULT_SPACE_VALUES)
  })

  test('reads the resolved values off theme.other.basaltDensity when present', () => {
    const retuned = deriveSpacing(-2)
    // Fails if the hook stops reading `theme.other.basaltDensity` (e.g. always returns
    // `DEFAULT_SPACE_VALUES` regardless of the running theme).
    expect(readBasaltSpacing({ other: { basaltDensity: retuned } })).toEqual(retuned)
    expect(readBasaltSpacing({ other: { basaltDensity: retuned } })).not.toEqual(
      DEFAULT_SPACE_VALUES,
    )
  })
})
