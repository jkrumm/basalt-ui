/**
 * The CBBI page's right-hand panel — the evidence surface this whole page exists to produce, now
 * built from the wave-2 aside primitives rather than around the holes they closed.
 *
 * G4 and G5 are shut: the composition rows are `SliderControl`s inside `PanelRow`s, the `Display`
 * fields are the same bound controls resolving their own `panel` form, and the reset lives in the
 * section header slot. What the panel proves NOW is two things the gap ledger could not:
 *
 * 1. **The row primitive holds at real width.** Nine composition rows carry a label, a hint, a
 *    verdict badge, a two-number mono readout, a `Switch` on the label line and a 0..2 track on its
 *    own — at ~260px, from one declaration each, with the tier supplied by the row rather than by
 *    nine `size` props. `readout`/`end` on `SliderControl` are the only package change it needed.
 * 2. **A panel can be an INSPECTOR of data, not just of settings.** `Diagnostics`, `Presets` and
 *    `Today` are computed from the live series at runtime (`cbbi-diagnostics.ts`,
 *    `cbbi-outlook.ts`) — no cycle dates, no stored verdicts, and "no precedent" wherever the
 *    episode gate is not met. That is the shape a consumer's filter panel actually wants: rows whose
 *    right-hand side is a measurement, and whose action is derived from it.
 *
 * 3. **A cartesian chart at panel width is still a different chart.** `Distribution` keeps rendering
 *    the SAME `Bars` the main column does, at the aside's content width, because G6 is wave 3 and
 *    the difference should stay visible rather than argued.
 */
import { ActionIcon, Anchor, Badge, Button, Group, Stack, Switch, Text } from '@mantine/core'
import { Section } from 'basalt-ui'
import { Bars, VX } from 'basalt-ui/charts'
import { PanelRow, SelectFilter, SliderControl, ToggleFilter } from 'basalt-ui/controls'
import { useMemo } from 'react'
import { CBBI_METRICS, ratio } from './cbbi-data'
import type { CbbiMetricKey, CbbiRow, HistogramBin } from './cbbi-data'
import { activePreset, CBBI_PRESETS, diagnoseAll, DIAGNOSTIC_WINDOW } from './cbbi-diagnostics'
import type { MetricHealth, MetricVerdict } from './cbbi-diagnostics'
import { todaySuggestions } from './cbbi-outlook'
import type { Suggestion } from './cbbi-outlook'
import {
  cbbiFilters,
  cbbiWeightField,
  resetCbbiWeights,
  useApplyCbbiPreset,
  useDisableCbbiMetric,
} from './cbbi-store'
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
 * The verdict palette — THEME colors, never a hex, and `yellow` deliberately shared by `stale` and
 * `noisy`: both are "read this metric with a caveat", and a third hue would claim a distinction the
 * badge text already makes.
 */
const VERDICT_COLOR: Record<MetricVerdict, string> = {
  ok: 'teal',
  broken: 'red',
  stale: 'yellow',
  noisy: 'yellow',
  insufficient: 'gray',
}

/** `Badge` is not a tiered control (it carries no `-ctl` vars), so it states its own size. */
function VerdictBadge({ verdict }: { verdict: MetricVerdict }) {
  return (
    <Badge size="xs" variant="light" color={VERDICT_COLOR[verdict]}>
      {verdict}
    </Badge>
  )
}

/**
 * The composition readout — today's reading, then the live weight.
 *
 * Module scope and a STRING return, both deliberate: the render prop is a FORMATTER, so it can
 * never be read as a component defined during render (`react/no-unstable-nested-components`). The
 * verdict badge that used to sit in here is an `end` sibling of the switch now, which is where a
 * second element belonged anyway.
 */
function compositionReadout(value: number | null, weight: number): string {
  return `${value === null ? '—' : ratio(value)} · ×${weight.toFixed(2)}`
}

/**
 * One metric's composition row.
 *
 * Its own component for the reason the hand-built row was: nine `use()` calls become nine
 * COMPONENTS with one hook each (inside `SliderControl`), so dragging one weight re-renders one row.
 *
 * The readout is an OVERRIDE rather than a `format`, because it states two numbers and the control
 * owns only one of them — today's reading, then the weight. It is the FUNCTION form, so the weight
 * half tracks the thumb per frame from the control's own drag draft.
 */
function CompositionRow({
  metricKey,
  label,
  hint,
  value,
  health,
  enabled,
  onToggle,
}: {
  metricKey: CbbiMetricKey
  label: string
  hint: string
  value: number | null
  health: MetricHealth
  enabled: boolean
  onToggle: (next: boolean) => void
}) {
  const flagged = health.verdict !== 'ok' && health.verdict !== 'insufficient'

  return (
    <SliderControl
      field={cbbiWeightField[metricKey]}
      label={label}
      hint={hint}
      disabled={!enabled}
      readout={(dragged) => compositionReadout(value, dragged)}
      end={
        <Group gap={6} wrap="nowrap">
          {flagged && <VerdictBadge verdict={health.verdict} />}
          {/* G14 (`docs/ASIDE-SPEC.md` §2): membership of ONE key in a `field.multi` has no bound
              control, so this row writes the field by hand. Wave 3 owes it a `MembershipToggle`. */}
          <Switch
            checked={enabled}
            onChange={(event) => onToggle(event.currentTarget.checked)}
            aria-label={`Include ${label}`}
          />
        </Group>
      }
    />
  )
}

/**
 * One suggestion.
 *
 * `PanelRow.label` is one clipped line by design (`panel-row.module.css`), so the SENTENCE goes in
 * the row's control line as `children` and the label keeps a two-or-three-word lead. That is the row
 * primitive being used as drawn, not worked around.
 */
function SuggestionRow({
  suggestion,
  onDisable,
}: {
  suggestion: Suggestion
  onDisable: (key: CbbiMetricKey) => void
}) {
  const metric = suggestion.metric

  return (
    <PanelRow
      label={suggestion.lead}
      readout={suggestion.support}
      {...(suggestion.action === 'disable' &&
        metric !== undefined && {
          end: (
            <Button
              variant="subtle"
              onClick={() => {
                onDisable(metric)
              }}
            >
              Disable
            </Button>
          ),
        })}
    >
      <Text size="xs" {...(suggestion.tone === 'neutral' && { c: 'dimmed' })}>
        {suggestion.text}
      </Text>
    </PanelRow>
  )
}

export function CbbiPanel({
  rows,
  latest,
  bins,
  weights,
}: {
  /** The FULL daily series — the diagnostics and the outlook read every row, never a bucket. */
  rows: CbbiRow[]
  latest: CbbiRow
  bins: HistogramBin[]
  weights: Record<CbbiMetricKey, number>
}) {
  const [enabled, setEnabled] = cbbiFilters.field.metrics.use()
  const enabledSet = useMemo(() => new Set<CbbiMetricKey>(enabled), [enabled])
  const health = useMemo(() => diagnoseAll(rows), [rows])
  const suggestions = useMemo(() => todaySuggestions(rows, health), [rows, health])
  const preset = activePreset(weights, enabledSet)
  const applyPreset = useApplyCbbiPreset()
  const disableMetric = useDisableCbbiMetric()

  const toggle = (key: CbbiMetricKey, next: boolean): void => {
    const kept = CBBI_METRICS.map((m) => m.key).filter((candidate) =>
      candidate === key ? next : enabledSet.has(candidate),
    )
    setEnabled(kept)
  }

  return (
    <Stack gap="sm">
      <Section
        title="Presets"
        subtitle="Five compositions from the offline study. They pick which metrics you trust — not
          a better forecast."
        count={CBBI_PRESETS.length}
        collapsible
        persistKey="cbbi-presets"
      >
        {CBBI_PRESETS.map((candidate) => (
          <PanelRow
            key={candidate.key}
            label={candidate.label}
            hint={candidate.hint}
            {...(preset === candidate.key && { readout: 'active' })}
            end={
              <Button
                variant="subtle"
                onClick={() => {
                  applyPreset(candidate.key)
                }}
              >
                Apply
              </Button>
            }
          />
        ))}
      </Section>

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
        {CBBI_METRICS.map((metric) => (
          <CompositionRow
            key={metric.key}
            metricKey={metric.key}
            label={metric.label}
            hint={metric.hint}
            value={latest.metrics[metric.key]}
            health={health[metric.key]}
            enabled={enabledSet.has(metric.key)}
            onToggle={(next) => toggle(metric.key, next)}
          />
        ))}
      </Section>

      <Section
        title="Diagnostics"
        subtitle={`Youden J against the peer consensus over the last ${DIAGNOSTIC_WINDOW} days —
          trust, not accuracy: every weighting separates tops from bottoms within 0.02
          (ANALYSIS.md §4).`}
        count={CBBI_METRICS.length}
        collapsible
        persistKey="cbbi-diagnostics"
      >
        {CBBI_METRICS.map((metric) => (
          <PanelRow
            key={metric.key}
            label={metric.label}
            hint={health[metric.key].reason}
            readout={`J ${health[metric.key].j.toFixed(2)}`}
            end={<VerdictBadge verdict={health[metric.key].verdict} />}
          />
        ))}
      </Section>

      <Section
        title="Today"
        subtitle="Conditional base rates from the live series. A line only appears with at least 8
          prior episodes behind it."
        count={suggestions.length}
        collapsible
        persistKey="cbbi-today"
      >
        {suggestions.length === 0 ? (
          <Text size="xs" c="dimmed">
            Nothing supported by the data today.
          </Text>
        ) : (
          suggestions.map((suggestion) => (
            <SuggestionRow key={suggestion.key} suggestion={suggestion} onDisable={disableMetric} />
          ))
        )}
      </Section>

      <Section title="Display" subtitle="The same four fields the page bar owns, at panel width.">
        <ToggleFilter field={cbbiFilters.field.zones} label="Zone bands" />
        <SelectFilter field={cbbiFilters.field.scale} label="Price scale" />
        <SelectFilter field={cbbiFilters.field.granularity} label="Bucket" />
        <SelectFilter field={cbbiFilters.field.layout} label="Layout" />
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
