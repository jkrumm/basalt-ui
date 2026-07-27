/**
 * DeriveControls — DEV-tool live tuning of the six-knob derive config (`tokens/derive.ts`): accent
 * seed, neutral family, light/dark surface levels, vibrancy, and accent brightness — plus a
 * seventh, color-independent "Radius" level (`tokens/palette.ts`'s `deriveRadius`) and an eighth,
 * "Density" level (`tokens/palette.ts`'s `deriveSpacing`).
 *
 * This is the DEV-tool path — for a PRODUCTION theme, pass `{ derive }` / `{ radius }` / `{ density }`
 * to `createBasaltTheme` instead (see its JSDoc in `../theme`); that is the one place a consumer sets
 * the palette identity for real. This component is for live-tweaking a config by eye during
 * development, not for shipping one.
 *
 * It applies a config through BOTH halves of the theme, because a knob's reach spans both:
 *
 * 1. **CSS vars** — a `<style>` tag (see {@link applyDeriveOverride} below) for every `--vx-*` the
 *    palette / radius / density builders emit.
 * 2. **The theme OBJECT** — `BasaltProvider` reads this same persisted store and rebuilds a real
 *    theme via `createBasaltTheme(undefined, { derive, radius, density })`, so `theme.radius` /
 *    `theme.spacing` (the generic Mantine `xs`..`xl` scales — every `p="md"` / `gap="sm"` in the app)
 *    and the numeric `defaultProps` baked in by `buildTheme` (Badge / SegmentedControl / Progress /
 *    Tooltip / Popover / Modal / Notification `radius`, Progress's `size`, Timeline's `bulletSize`)
 *    follow the sliders too. See `../provider/lab-theme.ts` — it merges only the DELTA the config
 *    makes against the shipped base, so a consumer's own theme overrides survive. A `<style>` tag
 *    alone could never reach a number inside a JS object: the sliders used to move the CSS-var
 *    surfaces and leave the generic Mantine scales at level 0, which made the tool under-report its
 *    own knobs unevenly across surfaces (the CSS-module-heavy app sidebar moved most, plain Mantine
 *    layout not at all) — precisely the reading a retune is judged by.
 *
 * ONE gap remains, and it is NOT theme-lab-only — it fails the PRODUCTION path identically.
 * `tokens/index.ts`'s `VX` object (`VX.legendGap`/`VX.margin`/`VX.dotR` — chart legend gap, plot-area
 * margins, data-point marker radius) is computed ONCE at module load from the STATIC level-0
 * `SPACE_STEP` snapshot, not re-derived per `SpaceValues`, because visx SVG props read it as a plain
 * JS number at import time, before any `density` option exists to retune it against. So chart
 * geometry follows neither this slider nor `createBasaltTheme({ density })`. See `deriveSpacing`'s
 * JSDoc (`tokens/palette.ts`) for the full accounting of what tracks density and what doesn't, and why.
 *
 * The CSS half applies through a `<style>` tag appended to the END of `<body>`, using the exact same
 * per-scheme selectors `buildPaletteCss` emits (`html[data-mantine-color-scheme='light'|'dark']`)
 * — equal CSS specificity, later in document order, so it wins the cascade tiebreak over
 * `BasaltProvider`'s own injected palette `<style>` (also rendered in `<body>`) without
 * `!important`. Ported from the argo/playground derive proof-of-concept, which validated this
 * mechanism (a head-appended tag loses the tiebreak — it sits earlier in document order).
 *
 * Persisted to its own localStorage key/version, Standard-Schema-guarded so a corrupt envelope can
 * never throw during render (falls back to the default config instead) — see `./derive-state`, the
 * Mantine-free module that owns the store both halves above read.
 *
 * Now that the provider re-derives the palette from the same store, its injected `<style>` is a
 * superset of this one (it also carries a consumer's `paletteOptions` groups) — this tag is kept
 * because it is the only half that can apply BEFORE React mounts, which is what keeps a page reload
 * from flashing the stock palette. Both emit the same values, so the tiebreak is a no-op.
 */
import {
  Button,
  ColorInput,
  Group,
  SegmentedControl,
  Slider,
  Stack,
  Switch,
  Text,
} from '@mantine/core'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { buildDensityCss, buildPaletteCss, buildRadiusCss } from '../tokens'
import type { DeriveConfig } from '../tokens/derive'
import { buildPaletteData, deriveRadius, deriveSpacing } from '../tokens/palette'
import {
  DEFAULT_STATE,
  NEUTRAL_OPTIONS,
  isAccentHex,
  readAppliedDeriveOverride,
  toDeriveOverride,
  useDeriveControlsState,
} from './derive-state'
import type { DeriveOverride } from './derive-state'

// The persisted state itself lives in `./derive-state` (Mantine-free) — `BasaltProvider` reads the
// same store to rebuild the theme object. Re-exported here so this module stays the one public entry
// point for the panel and its state shape.
export { DEFAULT_STATE, parsePersistedDeriveState, type PersistedDeriveState } from './derive-state'

const STYLE_TAG_ID = 'basalt-derive-controls-style'

const LEVEL_MARKS = [-5, 0, 5].map((v) => ({ value: v, label: String(v) }))
// Density's own, narrower range — see `deriveSpacing`'s JSDoc (`tokens/palette.ts`) for why it's
// [-3, 3] while radius and the four color knobs stay [-5, 5].
const DENSITY_LEVEL_MARKS = [-3, 0, 3].map((v) => ({ value: v, label: String(v) }))

const LEVEL_SLIDERS = [
  ['lightLevel', 'Light level'],
  ['darkLevel', 'Dark level'],
  ['vibrancy', 'Vibrancy'],
  ['accentBrightness', 'Brightness'],
  ['radius', 'Radius'],
  ['density', 'Density'],
] as const

/** Inject (or remove) the override `<style>` tag for a resolved config + radius level + density
 * level. `null` removes it. */
function applyDeriveOverride(override: DeriveOverride | null): void {
  if (override === null) {
    document.getElementById(STYLE_TAG_ID)?.remove()
    return
  }
  let styleEl = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = STYLE_TAG_ID
    // End-of-<body>, not <head>: BasaltProvider renders the stock palette <style> INSIDE the app
    // tree (in <body>), so a head-appended tag would sit earlier in document order and lose the
    // equal-specificity cascade tiebreak — the override would silently never apply.
    document.body.appendChild(styleEl)
  }
  const paletteCss = buildPaletteCss(undefined, buildPaletteData(override.config))
  const radiusCss = buildRadiusCss(deriveRadius(override.radiusLevel))
  const densityCss = buildDensityCss(deriveSpacing(override.densityLevel))
  styleEl.textContent = `${paletteCss}\n${radiusCss}\n${densityCss}`
}

// Chunk-load re-apply: re-inject a persisted `applied` override as soon as this module evaluates,
// before React mounts, so a full page reload doesn't flash the stock palette before the effect
// below runs. Inputs are fully validated by `parsePersistedDeriveState`, so this cannot throw.
// (The theme-object half needs no such pre-pass — `BasaltProvider` reads the same store during its
// FIRST render, so the numeric `defaultProps`/`spacing` are already at the right level.)
if (typeof document !== 'undefined') {
  applyDeriveOverride(readAppliedDeriveOverride())
}

export type DeriveControlsProps = {
  /** Icon for the "Reset" action. Passed as a node — the framework ships no icon dep. */
  resetIcon?: ReactNode
}

/**
 * The derive-config panel — accent seed, neutral family, light/dark surface levels, vibrancy, and
 * accent brightness, with an "Apply" switch and a "Reset" action. See the module doc comment for
 * the dev-vs-production split.
 */
export function DeriveControls({ resetIcon }: DeriveControlsProps) {
  const [state, setState] = useDeriveControlsState()

  // `ColorInput` feeds every keystroke here — a partial hex like `#12` must never reach `state`
  // (and from there `deriveTokens`, which now throws on a malformed accent). Keep the raw
  // in-progress text in local state so typing is never blocked, and only fold it into the
  // persisted/derived config once it matches a full hex; an invalid in-progress value keeps the
  // last valid accent applied.
  const [accentDraft, setAccentDraft] = useState(state.accent)
  useEffect(() => {
    setAccentDraft(state.accent)
  }, [state.accent])

  const handleAccentChange = (value: string) => {
    setAccentDraft(value)
    if (isAccentHex(value)) setState({ ...state, accent: value })
  }

  // Owns exactly one DOM node (#basalt-derive-controls-style). No cleanup function on purpose:
  // unmounting this component (e.g. collapsing an accordion around it) must not tear the override
  // down while `applied` stays true — only this effect re-running with `applied === false` (toggle
  // off, or Reset) removes it. `state` is a referentially stable snapshot (see `../state`'s
  // `createPersistedState`), so this runs once per write, not once per render.
  useEffect(() => {
    applyDeriveOverride(toDeriveOverride(state))
  }, [state])

  const reset = () => setState(DEFAULT_STATE)

  return (
    <Stack gap="sm">
      <ColorInput
        size="xs"
        format="hex"
        label="Accent seed"
        value={accentDraft}
        onChange={handleAccentChange}
      />
      <div>
        <Text size="xs" fw={500} mb={4}>
          Neutral family
        </Text>
        <SegmentedControl
          size="xs"
          fullWidth
          aria-label="Neutral family"
          value={state.neutral}
          onChange={(neutral) =>
            setState({ ...state, neutral: neutral as DeriveConfig['neutral'] })
          }
          data={NEUTRAL_OPTIONS}
        />
      </div>
      {LEVEL_SLIDERS.map(([key, label]) => {
        // Density's slider range is narrower than the others (see `DENSITY_LEVEL_MARKS`'s doc) —
        // `isLevel`/the shared `-5..5` marks still apply to radius and the four color knobs.
        const isDensity = key === 'density'
        return (
          <div key={key}>
            <Text size="xs" fw={500} mb={4}>
              {label} ({state[key]})
            </Text>
            <Slider
              size="xs"
              min={isDensity ? -3 : -5}
              max={isDensity ? 3 : 5}
              step={1}
              aria-label={label}
              value={state[key]}
              onChange={(v) => setState({ ...state, [key]: v })}
              marks={isDensity ? DENSITY_LEVEL_MARKS : LEVEL_MARKS}
            />
          </div>
        )
      })}
      <Group justify="space-between" mt="xs">
        <Switch
          size="sm"
          label="Apply"
          checked={state.applied}
          onChange={(e) => setState({ ...state, applied: e.currentTarget.checked })}
        />
        <Button size="compact-xs" variant="default" leftSection={resetIcon} onClick={reset}>
          Reset
        </Button>
      </Group>
    </Stack>
  )
}
