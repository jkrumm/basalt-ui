/**
 * Theme lab — DEV-only live tuning of the `--vx-*` palette.
 *
 * Charts (and the Mantine chrome bridged to the same vars) read their colors from `--vx-*` CSS
 * custom properties (see the token layer). This module writes overrides for those vars as inline
 * styles on `<html>`, which beats the stylesheet's per-scheme rules, so everything restyles
 * instantly with NO React re-render. Overrides persist to localStorage and re-apply on load, so a
 * tuning session survives a refresh.
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
import { BP } from '../tokens'

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
      { var: '--vx-surface-elevated', label: 'Elevated' },
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

/** Current resolved value of a var (reflects any active override or the stylesheet default). */
export function readVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
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
                styles={{ label: { fontWeight: 600, fontSize: 10 } }}
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
                    styles={{ label: { fontSize: 11 } }}
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
