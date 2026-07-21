/**
 * Theme lab — DEV-only live tuning of the `--vx-*` palette.
 *
 * Charts AND the Mantine chrome read their colors from `--vx-*` CSS custom properties (see the
 * token layer). This module writes overrides for those vars as inline styles on `<html>`, which
 * beats the stylesheet's per-scheme rules, so everything restyles instantly with NO React
 * re-render. Overrides persist to localStorage and re-apply on load, so a tuning session survives
 * a refresh.
 *
 * The chrome follows because `theme/index.ts` bridges Mantine's surface vars AND its primary-color
 * vars onto these same tokens — retuning `--vx-accentFill` restyles every Button/Switch/Checkbox
 * live. (It did NOT before: the accent was dual-sourced, so the lab moved the charts and left the
 * chrome alone.) Known limit: only the PRIMARY Mantine color is bridged. A `color="red"` filled
 * badge still reads Mantine's JS ramp and will not follow a lab override.
 *
 * It is a tuning sandbox, not a prod theme editor: inline overrides apply to whatever scheme is on
 * screen (they win over both light and dark rules). Use "Copy JSON" to hand off values for baking
 * into `palette.ts` permanently.
 *
 * Grounded in argo `apps/dashboard/src/lib/theme-lab.ts` + `components/theme-lab-panel.tsx`.
 * Argo's domain series groups (Health / Strength / Walking) are DROPPED — the framework ships
 * generic token groups (Semantic / Status / Neutral / Surface) as the default, and a consumer
 * passes its own series groups via `ThemeLabControls`'s `groups` prop.
 */
import {
  ActionIcon,
  Button,
  ColorInput,
  Divider,
  Group,
  ScrollArea,
  SimpleGrid,
  Slider,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { BP, FILL } from '../tokens/palette'
import { VX } from '../tokens'

export { DeriveControls } from './derive-controls'
export type { DeriveControlsProps } from './derive-controls'

/** The bridged Mantine families, in palette order — the source for the `Fills` group below. */
const FILL_FAMILIES = Object.keys(FILL)

export type ColorTunable = { var: string; label: string }
export type ColorGroup = { title: string; items: ColorTunable[] }
export type Overrides = Record<string, string>

/** Gradient strength knobs (percent values, theme-independent). */
export const AREA_TOP_VAR = '--vx-area-top'
export const AREA_BOTTOM_VAR = '--vx-area-bottom'

/**
 * Framework color groups — solid-hex `--vx-*` vars worth tuning by eye (ColorInput is hex-only,
 * so `rgba()`/`color-mix()` chrome vars like `--vx-axis` / `--vx-grid` are intentionally omitted).
 *
 * Generic by design: argo's domain series (Health / Strength / Walking) are NOT shipped — a
 * consumer passes its own series groups to {@link ThemeLabControls} via the `groups` prop.
 */
export const COLOR_GROUPS: ColorGroup[] = [
  {
    // The accent, split by ROLE (see `ACCENT` in tokens/palette.ts): `Accent` is the INK (links,
    // active-nav icon, chart lines, focus ring) and inverts across schemes; `Fill` is the SURFACE
    // of every filled control and is the same hex in both. Retuning `Fill` live-restyles every
    // Button/Switch/Checkbox/Tab, because Mantine's `--mantine-color-<primary>-filled` is bridged
    // onto it (theme/index.ts). `On accent` is the label ON that fill — the theme cannot recompute
    // contrast in CSS, so if you tune `Fill` light, drop `On accent` to a dark ink yourself.
    title: 'Accent',
    items: [
      { var: '--vx-accent', label: 'Accent (ink)' },
      { var: '--vx-accentHover', label: 'Accent hover' },
      { var: '--vx-accentFill', label: 'Fill' },
      { var: '--vx-accentFillHover', label: 'Fill hover' },
      { var: '--vx-onAccent', label: 'On accent' },
    ],
  },
  {
    // Every filled surface in the Mantine chrome, single-sourced (theme/index.ts bridges
    // `--mantine-color-{family}-filled` onto these). They all sit in ONE luminance band so a white
    // label always works — retune within it, or you break the label. Hover is derived from the
    // fill, so it follows automatically and is not listed. `blue` lives under Accent → Fill.
    title: 'Fills',
    items: FILL_FAMILIES.map((name) => ({
      var: `--vx-fill-${name}`,
      label: name.charAt(0).toUpperCase() + name.slice(1),
    })),
  },
  {
    title: 'Ink',
    items: [
      { var: '--vx-ink', label: 'Ink' },
      { var: '--vx-ink2', label: 'Ink 2' },
      { var: '--vx-muted', label: 'Muted' },
      { var: '--vx-faint', label: 'Faint' },
    ],
  },
  {
    title: 'Semantic',
    items: [
      { var: '--vx-goodSolid', label: 'Good' },
      { var: '--vx-warnSolid', label: 'Warn' },
      { var: '--vx-badSolid', label: 'Bad' },
    ],
  },
  {
    title: 'Status',
    items: [
      { var: '--vx-status-excellent', label: 'Excellent' },
      { var: '--vx-status-good', label: 'Good' },
      { var: '--vx-status-warn', label: 'Warn' },
      { var: '--vx-status-bad', label: 'Bad' },
      { var: '--vx-status-neutral', label: 'Neutral' },
    ],
  },
  {
    title: 'Neutral',
    items: [
      { var: '--vx-line', label: 'Line' },
      { var: '--vx-line2', label: 'Line 2' },
      { var: '--vx-neutral', label: 'Neutral' },
      { var: '--vx-dotStroke', label: 'Dot stroke' },
    ],
  },
  {
    title: 'Surface',
    items: [
      { var: '--vx-surface-bg', label: 'Background' },
      { var: '--vx-surface-panel', label: 'Panel' },
      { var: '--vx-surface-panelHover', label: 'Panel hover' },
      { var: '--vx-surface-elevated', label: 'Elevated' },
      { var: '--vx-surface-subtle', label: 'Subtle' },
      { var: '--vx-surface-overlay', label: 'Overlay' },
      { var: '--vx-surface-field', label: 'Field' },
      { var: '--vx-surface-border', label: 'Border' },
    ],
  },
]

const COLOR_VARS = COLOR_GROUPS.flatMap((g) => g.items.map((i) => i.var))
const MANAGED_VARS = [...COLOR_VARS, AREA_TOP_VAR, AREA_BOTTOM_VAR]

const KEY = 'basalt-theme-lab'

export function loadOverrides(): Overrides {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Overrides) : {}
  } catch {
    return {}
  }
}

export function saveOverrides(o: Overrides): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(o))
  } catch {
    // private mode / quota — tuning just won't persist
  }
}

/** Clears every managed var, then re-applies the given overrides. The single mutation point. */
export function applyOverrides(o: Overrides): void {
  const el = document.documentElement
  for (const v of MANAGED_VARS) el.style.removeProperty(v)
  for (const [k, val] of Object.entries(o)) {
    if (val) el.style.setProperty(k, val)
  }
}

/**
 * Current value of a color var as a hex `ColorInput` can display (reflects any active override or
 * the stylesheet default).
 *
 * Reading the custom property directly is not enough: an UNREGISTERED custom property computes to
 * its literal source text, so a `color-mix()`-derived token (every surface — see `SURFACE` in
 * tokens/palette.ts) comes back as the string `"color-mix(in srgb, #3f3f46 50%, #27272a)"`, which
 * ColorInput cannot parse — it renders an empty swatch. Painting the var onto a probe element and
 * reading a real COLOR property instead forces the browser to resolve it to an rgb triple.
 */
export function readVar(name: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  if (raw.startsWith('#')) return raw
  if (!raw) return ''

  const probe = document.createElement('span')
  probe.style.display = 'none'
  probe.style.color = `var(${name})`
  document.body.appendChild(probe)
  const computed = getComputedStyle(probe).color
  probe.remove()

  const channels = computed.match(/[\d.]+/g)
  if (!channels || channels.length < 3) return raw
  const hex = channels
    .slice(0, 3)
    .map((c) => Math.round(Number(c)).toString(16).padStart(2, '0'))
    .join('')
  return `#${hex}`
}

/** Quick-pick Blueprint swatches (mid stop of each family) for the color inputs. */
const SWATCHES: string[] = [
  BP.blue[2],
  BP.cerulean[2],
  BP.turquoise[2],
  BP.forest[2],
  BP.green[2],
  BP.lime[2],
  BP.gold[2],
  BP.orange[2],
  BP.vermilion[2],
  BP.red[2],
  BP.rose[2],
  BP.violet[2],
  BP.indigo[2],
  BP.gray[2],
]

const pct = (v: string): number => Number.parseInt(v, 10) || 0

export type ThemeLabControlsProps = {
  /** Color groups to render as tunable swatches. Defaults to the framework {@link COLOR_GROUPS}. */
  groups?: ColorGroup[]
  /**
   * Called with the overrides JSON after a successful clipboard write. Wire a toast here
   * (the framework ships no notification dep). No-ops when omitted.
   */
  onCopy?: (json: string) => void
  /** Icon for the "Copy JSON" action (passed as a node — the framework ships no icon dep). */
  copyIcon?: ReactNode
  /** Icon for the "Reset" actions (passed as a node — the framework ships no icon dep). */
  resetIcon?: ReactNode
}

/**
 * Theme lab controls — the body shown inside a dev dock's theme popover. Retunes the `--vx-*`
 * colors + gradient strength live by overriding them on `<html>`. Persisted overrides should be
 * re-applied on page load by the host (call `applyOverrides(loadOverrides())` at boot), so this
 * component owns only the editing UI, not the initial apply.
 *
 * DEV-only tool. Icons + copy feedback are injected by the consumer (no icon / notification dep).
 */
export function ThemeLabControls({
  groups = COLOR_GROUPS,
  onCopy,
  copyIcon,
  resetIcon,
}: ThemeLabControlsProps) {
  const [overrides, setOverrides] = useState<Overrides>(() => loadOverrides())

  const setVar = (name: string, value: string) => {
    setOverrides((prev) => {
      const next = { ...prev, [name]: value }
      applyOverrides(next)
      saveOverrides(next)
      return next
    })
  }

  const resetAll = () => {
    setOverrides({})
    applyOverrides({})
    saveOverrides({})
  }

  const copyJson = () => {
    const json = JSON.stringify(overrides, null, 2)
    // Fire onCopy only on a successful write; swallow rejection (clipboard denied/unavailable in
    // some contexts) so it never surfaces as an unhandled promise rejection.
    navigator.clipboard.writeText(json).then(
      () => onCopy?.(json),
      () => {},
    )
  }

  const valueOf = (name: string): string => overrides[name] ?? readVar(name)

  return (
    <Stack gap="xs" w={300}>
      <Group justify="space-between">
        <Text fw={600} size="sm">
          Theme Lab
        </Text>
        <Group gap={4}>
          <Tooltip label="Copy overrides as JSON">
            <ActionIcon variant="subtle" size="sm" onClick={copyJson} aria-label="Copy JSON">
              {copyIcon}
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Reset all">
            <ActionIcon variant="subtle" size="sm" onClick={resetAll} aria-label="Reset all">
              {resetIcon}
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <ScrollArea.Autosize mah="68vh" type="hover" offsetScrollbars>
        <Stack gap="sm" pr="xs">
          <Stack gap={4}>
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
              Area gradient
            </Text>
            <Text size="xs" c="dimmed">
              Top {pct(valueOf(AREA_TOP_VAR))}%
            </Text>
            <Slider
              size="sm"
              min={0}
              max={50}
              value={pct(valueOf(AREA_TOP_VAR))}
              onChange={(v) => setVar(AREA_TOP_VAR, `${v}%`)}
            />
            <Text size="xs" c="dimmed">
              Bottom {pct(valueOf(AREA_BOTTOM_VAR))}%
            </Text>
            <Slider
              size="sm"
              min={0}
              max={20}
              value={pct(valueOf(AREA_BOTTOM_VAR))}
              onChange={(v) => setVar(AREA_BOTTOM_VAR, `${v}%`)}
            />
          </Stack>

          {groups.map((g) => (
            <Stack key={g.title} gap={6}>
              <Divider
                label={g.title.toUpperCase()}
                labelPosition="left"
                styles={{ label: { fontWeight: 600, fontSize: VX.text.micro } }}
              />
              <SimpleGrid cols={2} spacing={6} verticalSpacing={6}>
                {g.items.map((item) => (
                  <ColorInput
                    key={item.var}
                    size="xs"
                    format="hex"
                    label={item.label}
                    value={valueOf(item.var)}
                    onChange={(v) => setVar(item.var, v)}
                    swatches={SWATCHES}
                    swatchesPerRow={7}
                    styles={{ label: { fontSize: VX.text.micro } }}
                  />
                ))}
              </SimpleGrid>
            </Stack>
          ))}

          <Button size="xs" variant="light" leftSection={resetIcon} onClick={resetAll}>
            Reset to palette defaults
          </Button>
        </Stack>
      </ScrollArea.Autosize>
    </Stack>
  )
}
