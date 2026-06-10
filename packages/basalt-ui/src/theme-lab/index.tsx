/**
 * Theme lab — DEV-only live tuning of the chart palette.
 *
 * Charts read their colors from `--vx-*` CSS custom properties. This module writes overrides for
 * those vars as inline styles on `<html>`, which beats the stylesheet's per-scheme rules, so charts
 * restyle instantly with NO React re-render.
 *
 * Grounded in argo `apps/dashboard/src/lib/theme-lab.ts` + `components/theme-lab-panel.tsx`.
 * S0: `applyOverrides`/`COLOR_GROUPS`/`Overrides` are real and grounded; `ThemeLabControls` is a
 * placeholder Mantine component (the full ColorInput grid + sliders land in a later stage).
 */
import { Stack, Text } from '@mantine/core'

export type ColorTunable = { var: string; label: string }
export type ColorGroup = { title: string; items: ColorTunable[] }
export type Overrides = Record<string, string>

/** Gradient strength knobs (percent values, theme-independent). */
export const AREA_TOP_VAR = '--vx-area-top'
export const AREA_BOTTOM_VAR = '--vx-area-bottom'

/** Curated anchor colors worth tuning by eye. Solid `--vx-*` vars only (ColorInput-safe). */
export const COLOR_GROUPS: ColorGroup[] = [
  {
    title: 'Health',
    items: [
      { var: '--vx-hrv', label: 'HRV' },
      { var: '--vx-restingHr', label: 'Resting HR' },
      { var: '--vx-sleepDuration', label: 'Sleep' },
      { var: '--vx-steps', label: 'Steps' },
      { var: '--vx-vo2max', label: 'VO₂max' },
      { var: '--vx-calories', label: 'Calories' },
    ],
  },
  {
    title: 'Status',
    items: [
      { var: '--vx-status-excellent', label: 'Excellent' },
      { var: '--vx-status-good', label: 'Good' },
      { var: '--vx-status-warn', label: 'Warn' },
      { var: '--vx-status-bad', label: 'Bad' },
    ],
  },
]

const COLOR_VARS = COLOR_GROUPS.flatMap((g) => g.items.map((i) => i.var))
const MANAGED_VARS = [...COLOR_VARS, AREA_TOP_VAR, AREA_BOTTOM_VAR]

/** Clears every managed var, then re-applies the given overrides. The single mutation point. */
export function applyOverrides(overrides: Overrides): void {
  const el = document.documentElement
  for (const v of MANAGED_VARS) el.style.removeProperty(v)
  for (const [key, val] of Object.entries(overrides)) {
    if (val) el.style.setProperty(key, val)
  }
}

export type ThemeLabControlsProps = {
  /** Color groups to render as tunable swatches. Defaults to the built-in {@link COLOR_GROUPS}. */
  groups?: ColorGroup[]
}

/**
 * Theme lab controls — the body shown inside a dev dock's theme popover. S0 placeholder render;
 * the full ColorInput grid + gradient sliders land in a later stage.
 */
export function ThemeLabControls({ groups = COLOR_GROUPS }: ThemeLabControlsProps) {
  return (
    <Stack gap="xs">
      <Text fw={600} size="sm">
        Theme Lab
      </Text>
      {groups.map((group) => (
        <Text key={group.title} size="xs" c="dimmed" tt="uppercase">
          {group.title}
        </Text>
      ))}
    </Stack>
  )
}
