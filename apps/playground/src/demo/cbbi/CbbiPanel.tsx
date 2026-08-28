/**
 * The CBBI page's right-hand panel — the evidence surface this whole page exists to produce.
 *
 * It is deliberately built from nothing but shipped primitives (`Section`, `Bars`, the
 * `FieldHandle`-bound controls, raw Mantine `Switch`/`Slider`), so what it does badly is a
 * FINDING about the framework rather than about this file. Three things are load-bearing to read
 * off it:
 *
 * 1. **Composition rows go label-ABOVE-control, not side by side.** At ~260px of usable width a
 *    row cannot hold a label, a switch, a 0..2 slider and a mono readout on one line — the slider
 *    collapses to a ~90px track where a 0.25 step is under 12px of travel. So each metric is two
 *    lines. A future aside needs a row primitive that states this, or every consumer re-derives it.
 * 2. **`Display` holds page-level controls OUTSIDE a home slot.** `docs/CONTROLS-SPEC.md` C1 has
 *    three homes and none of them is "a panel body". These are basalt controls
 *    (`ToggleFilter`/`SelectFilter`), not raw Mantine ones, so `basalt/control-outside-home` never
 *    fires — the guard cannot see the law being bent, which is itself the finding. A `Section`
 *    header slot was the compliant alternative and it does not fit: three pills in a 300px header
 *    row wrap, and a home never wraps (C7).
 * 3. **A cartesian chart at panel width is a different chart.** `Distribution` renders the SAME
 *    `Bars` the main column does, at ~260px, to make the difference visible rather than arguable.
 */
import { ActionIcon, Anchor, Group, Slider, Stack, Switch, Text, Tooltip } from '@mantine/core'
import { Section } from 'basalt-ui'
import { Bars, VX } from 'basalt-ui/charts'
import { SelectFilter, ToggleFilter } from 'basalt-ui/controls'
import { CBBI_METRICS, ratio } from './cbbi-data'
import type { CbbiMetricKey, CbbiRow, HistogramBin } from './cbbi-data'
import {
  CBBI_WEIGHT_MAX,
  CBBI_WEIGHT_MIN,
  CBBI_WEIGHT_STEP,
  cbbiFilters,
  cbbiWeightField,
  resetCbbiWeights,
} from './cbbi-store'
import type { CbbiWeightHandle } from './cbbi-store'
import { IconReset } from '../icons'

const CBBI_SOURCE = 'https://colintalkscrypto.com/cbbi/'

/** The distribution bars, at both widths — one declaration so the panel copy cannot drift. */
const BIN_BARS = [{ key: 'count', label: 'Days', color: VX.accent }]

export function CbbiDistributionBars({ bins, height }: { bins: HistogramBin[]; height: number }) {
  return (
    <Bars
      data={bins}
      height={height}
      chartId="cbbi-distribution"
      ariaLabel="Distribution of the official confidence index"
      getX={(d) => d.key}
      getValue={(d) => d.count}
      positiveBars={BIN_BARS}
      y={{ domain: 'auto', format: (v) => String(Math.round(v)) }}
      legend={false}
    />
  )
}

/**
 * One metric's composition row. Its own component so the nine `use()` calls are nine COMPONENTS
 * with one hook each, rather than one component with a loop of hooks — and so a weight drag
 * re-renders one row instead of the panel.
 */
function MetricRow({
  label,
  hint,
  value,
  enabled,
  onToggle,
  handle,
}: {
  label: string
  hint: string
  value: number | null
  enabled: boolean
  onToggle: (next: boolean) => void
  handle: CbbiWeightHandle
}) {
  const [weight, setWeight] = handle.use()

  return (
    <Stack gap={2}>
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Group gap={6} wrap="nowrap">
          <Switch
            checked={enabled}
            onChange={(event) => onToggle(event.currentTarget.checked)}
            aria-label={`Include ${label}`}
          />
          <Tooltip label={hint} multiline w={240} withArrow position="left">
            <Text size="xs" fw={550} lineClamp={1}>
              {label}
            </Text>
          </Tooltip>
        </Group>
        <Text size="xs" ff="monospace" {...(value === null && { c: 'dimmed' as const })}>
          {value === null ? '—' : ratio(value)}
        </Text>
      </Group>
      <Group gap="xs" wrap="nowrap">
        <Slider
          flex={1}
          value={weight}
          onChange={setWeight}
          min={handle.min ?? CBBI_WEIGHT_MIN}
          max={handle.max ?? CBBI_WEIGHT_MAX}
          step={CBBI_WEIGHT_STEP}
          label={null}
          disabled={!enabled}
          aria-label={`${label} weight`}
        />
        <Text size="xs" ff="monospace" c="dimmed" w={34} ta="right">
          {`×${weight.toFixed(2)}`}
        </Text>
      </Group>
    </Stack>
  )
}

export function CbbiPanel({ latest, bins }: { latest: CbbiRow; bins: HistogramBin[] }) {
  const [enabled, setEnabled] = cbbiFilters.field.metrics.use()
  const enabledSet = new Set<CbbiMetricKey>(enabled)

  const toggle = (key: CbbiMetricKey, next: boolean): void => {
    const kept = CBBI_METRICS.map((m) => m.key).filter((candidate) =>
      candidate === key ? next : enabledSet.has(candidate),
    )
    setEnabled(kept)
  }

  return (
    <Stack gap={14}>
      <Section
        title="Composition"
        subtitle="Which metrics the reweighted index averages, and how heavily."
        count={enabled.length}
        collapsible
        persistKey="cbbi-composition"
        actions={
          <ActionIcon variant="subtle" aria-label="Reset weights" onClick={resetCbbiWeights}>
            <IconReset />
          </ActionIcon>
        }
      >
        <Stack gap="xs">
          {CBBI_METRICS.map((metric) => (
            <MetricRow
              key={metric.key}
              label={metric.label}
              hint={metric.hint}
              value={latest.metrics[metric.key]}
              enabled={enabledSet.has(metric.key)}
              onToggle={(next) => toggle(metric.key, next)}
              handle={cbbiWeightField[metric.key]}
            />
          ))}
        </Stack>
      </Section>

      <Section title="Display" subtitle="The same three fields the page bar owns, at panel width.">
        <Stack gap="xs" align="flex-start">
          <ToggleFilter field={cbbiFilters.field.zones} label="Zone bands" />
          <SelectFilter field={cbbiFilters.field.scale} label="Price scale" />
          <SelectFilter field={cbbiFilters.field.granularity} label="Bucket" />
        </Stack>
      </Section>

      <Section
        title="Distribution"
        subtitle="Every day since 2011, by index reading."
        count={bins.length}
      >
        <CbbiDistributionBars bins={bins} height={140} />
      </Section>

      <Section title="About">
        <Stack gap={6}>
          <Text size="xs" c="dimmed">
            The CBBI folds nine on-chain and price-derived metrics into one 0–1 reading of how far
            into a Bitcoin bull cycle the market is.
          </Text>
          <Text size="xs" c="dimmed">
            The published index is the plain arithmetic mean of that day&apos;s available metrics;
            the panel above reweights the same inputs without changing them.
          </Text>
          <Text size="xs" c="dimmed">
            Above 0.9 has marked every cycle top so far, below 0.1 every bottom — with a sample size
            of three.
          </Text>
          <Anchor href={CBBI_SOURCE} target="_blank" rel="noreferrer" size="xs">
            colintalkscrypto.com/cbbi
          </Anchor>
        </Stack>
      </Section>
    </Stack>
  )
}
