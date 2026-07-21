/**
 * DeriveControls — DEV-tool live tuning of the six-knob derive config (`tokens/derive.ts`): accent
 * seed, neutral family, light/dark surface levels, vibrancy, and accent brightness — plus a
 * seventh, color-independent "Radius" level (`tokens/palette.ts`'s `deriveRadius`).
 *
 * This is the DEV-tool path — for a PRODUCTION theme, pass `{ derive }` / `{ radius }` to
 * `createBasaltTheme` instead (see its JSDoc in `../theme`); that is the one place a consumer sets
 * the palette identity for real, and everything else (Mantine color ramps, on-color contrast, the
 * CSS variables resolver, `BasaltProvider`'s injected stylesheet, AND the Mantine `defaultProps`
 * numbers baked into the theme object) follows automatically. This component is for live-tweaking a
 * config by eye during development, not for shipping one — its `<style>` override can only move the
 * `--vx-radius-*` CSS vars, so a component's own hardcoded `defaultProps.radius` (e.g. Tooltip's 8)
 * will NOT visibly follow the radius slider here; `createBasaltTheme({ radius })` is what covers
 * both.
 *
 * Overrides apply through a `<style>` tag appended to the END of `<body>`, using the exact same
 * per-scheme selectors `buildPaletteCss` emits (`html[data-mantine-color-scheme='light'|'dark']`)
 * — equal CSS specificity, later in document order, so it wins the cascade tiebreak over
 * `BasaltProvider`'s own injected palette `<style>` (also rendered in `<body>`) without
 * `!important`. Ported from the argo/playground derive proof-of-concept, which validated this
 * mechanism (a head-appended tag loses the tiebreak — it sits earlier in document order).
 *
 * Persisted to its own localStorage key/version, Standard-Schema-guarded so a corrupt envelope can
 * never throw during render (falls back to the default config instead).
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
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { createPersistedState, readPersistedValue } from '../state'
import { buildPaletteCss, buildRadiusCss } from '../tokens'
import { DEFAULT_DERIVE_CONFIG, resolveDeriveConfig } from '../tokens/derive'
import type { DeriveConfig } from '../tokens/derive'
import { buildPaletteData, deriveRadius } from '../tokens/palette'

const STYLE_TAG_ID = 'basalt-derive-controls-style'
const STORAGE_KEY = 'theme-lab-derive'
// v2: added the `radius` level (deriveRadius) alongside the six color knobs — bumped so a v1
// envelope (no `radius` key) fails validation and falls back to the default state instead of
// silently reading `radius: undefined` into the slider.
const STORAGE_VERSION = 2

const NEUTRAL_OPTIONS = [
  { label: 'Zinc', value: 'zinc' },
  { label: 'Neutral', value: 'neutral' },
  { label: 'Stone', value: 'stone' },
  { label: 'Slate', value: 'slate' },
]
const NEUTRAL_VALUES = new Set(NEUTRAL_OPTIONS.map((o) => o.value))
const LEVEL_MARKS = [-5, 0, 5].map((v) => ({ value: v, label: String(v) }))
const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

const LEVEL_SLIDERS = [
  ['lightLevel', 'Light level'],
  ['darkLevel', 'Dark level'],
  ['vibrancy', 'Vibrancy'],
  ['accentBrightness', 'Brightness'],
  ['radius', 'Radius'],
] as const

/** Exported for `derive-controls.test.ts` — the v1→v2 migration test needs the shape + default. */
export type PersistedDeriveState = DeriveConfig & { applied: boolean; radius: number }

export const DEFAULT_STATE: PersistedDeriveState = {
  ...DEFAULT_DERIVE_CONFIG,
  applied: false,
  radius: 0,
}

const isLevel = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= -5 && v <= 5

/**
 * Validate + normalize a persisted envelope, or return null if it is unusable. Exported for
 * `derive-controls.test.ts` — the pure, headless seam to test the v1→v2 migration through: no DOM
 * render harness is configured in this package (see `../provider/build-fonts-css.test.ts`), so
 * `createPersistedState`'s full localStorage round-trip isn't reachable from a unit test, but this
 * is exactly the validator `parseStorage` (`../state`) falls back to `initial` from on a rejection
 * (this module passes no `migrate`, so a v1 envelope — pre-radius — hits this same rejection path).
 */
export function parsePersistedDeriveState(value: unknown): PersistedDeriveState | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  const valid =
    typeof v['accent'] === 'string' &&
    HEX_RE.test(v['accent']) &&
    typeof v['neutral'] === 'string' &&
    NEUTRAL_VALUES.has(v['neutral']) &&
    isLevel(v['lightLevel']) &&
    isLevel(v['darkLevel']) &&
    isLevel(v['vibrancy']) &&
    isLevel(v['accentBrightness']) &&
    isLevel(v['radius']) &&
    typeof v['applied'] === 'boolean'
  if (!valid) return null
  return {
    accent: v['accent'] as string,
    neutral: v['neutral'] as DeriveConfig['neutral'],
    lightLevel: v['lightLevel'] as number,
    darkLevel: v['darkLevel'] as number,
    vibrancy: v['vibrancy'] as number,
    accentBrightness: v['accentBrightness'] as number,
    radius: v['radius'] as number,
    applied: v['applied'] as boolean,
  }
}

const useDeriveControlsState = createPersistedState<PersistedDeriveState>({
  key: STORAGE_KEY,
  version: STORAGE_VERSION,
  initial: DEFAULT_STATE,
  schema: {
    '~standard': {
      version: 1,
      vendor: 'basalt-derive-controls',
      validate: (value) => {
        const parsed = parsePersistedDeriveState(value)
        return parsed !== null
          ? { value: parsed }
          : { issues: [{ message: 'invalid persisted derive-controls state' }] }
      },
    },
  },
})

/** The bundle {@link applyDeriveOverride} needs to build both halves of the override CSS. */
type DeriveOverride = { config: DeriveConfig; radiusLevel: number }

/** Inject (or remove) the override `<style>` tag for a resolved config + radius level. `null`
 * removes it. */
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
  styleEl.textContent = `${paletteCss}\n${radiusCss}`
}

// Chunk-load re-apply: re-inject a persisted `applied` override as soon as this module evaluates,
// before React mounts, so a full page reload doesn't flash the stock palette before the effect
// below runs. Inputs are fully validated by `parsePersistedDeriveState`, so this cannot throw.
if (typeof document !== 'undefined') {
  const persisted = parsePersistedDeriveState(readPersistedValue(STORAGE_KEY, STORAGE_VERSION))
  if (persisted !== null && persisted.applied) {
    applyDeriveOverride({
      config: resolveDeriveConfig(persisted),
      radiusLevel: persisted.radius,
    })
  }
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
    if (HEX_RE.test(value)) setState({ ...state, accent: value })
  }

  const config = useMemo<DeriveConfig>(
    () => ({
      accent: state.accent,
      neutral: state.neutral,
      lightLevel: state.lightLevel,
      darkLevel: state.darkLevel,
      vibrancy: state.vibrancy,
      accentBrightness: state.accentBrightness,
    }),
    [
      state.accent,
      state.neutral,
      state.lightLevel,
      state.darkLevel,
      state.vibrancy,
      state.accentBrightness,
    ],
  )

  // Owns exactly one DOM node (#basalt-derive-controls-style). No cleanup function on purpose:
  // unmounting this component (e.g. collapsing an accordion around it) must not tear the override
  // down while `applied` stays true — only this effect re-running with `applied === false` (toggle
  // off, or Reset) removes it.
  useEffect(() => {
    applyDeriveOverride(state.applied ? { config, radiusLevel: state.radius } : null)
  }, [state.applied, config, state.radius])

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
      {LEVEL_SLIDERS.map(([key, label]) => (
        <div key={key}>
          <Text size="xs" fw={500} mb={4}>
            {label} ({state[key]})
          </Text>
          <Slider
            size="xs"
            min={-5}
            max={5}
            step={1}
            aria-label={label}
            value={state[key]}
            onChange={(v) => setState({ ...state, [key]: v })}
            marks={LEVEL_MARKS}
          />
        </div>
      ))}
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
