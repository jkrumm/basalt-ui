/**
 * c03 — one tool, last 24 hours. Question: are we inside the SLO, and by how much?
 *
 * One card. The hero is the success rate with a verdict mark and the signed margin against the target,
 * then the same margin as calls (failed calls still allowed). The body is the proof: running failed
 * calls against the running allowance (the target's share of the calls so far), the band between them
 * shaded and labelled with the headroom at the last hour. Pointing at an hour (or arrowing to it)
 * dims the hours after it and re-reads the hero for the window up to that hour; leaving restores the
 * 24-hour totals. One status hue speaks at a time: the failed line is ink until the SLO is missed.
 *
 * `?fixture=over` renders a missed SLO and `?fixture=zero` a run with no failure; no param is the
 * inside-the-SLO rest state. Anchors for `basalt-ui shot`: the wrapping `Box`.
 */
import { Box, Group, Stack, Text, VisuallyHidden } from '@mantine/core'
import { useRouterState } from '@tanstack/react-router'
import { areaY } from '@tanstack/charts/area'
import { lineY } from '@tanstack/charts/line'
import { decorative } from '@tanstack/charts/mark/decorative'
import { text } from '@tanstack/charts/text'
import { useSyncExternalStore } from 'react'
import { DeltaBadge, StatusVerdict } from 'basalt-ui'
import { CartesianChart, ChartCard, chartCursor } from 'basalt-ui/charts'
import type { ChartSeries, ChartTooltipRow, PlotContext } from 'basalt-ui/charts'
import { integer, percent, time } from 'basalt-ui/format'
import { alpha, VX } from 'basalt-ui/tokens'
import { cardStateProps } from '../../shot-state'
import type { ScenarioProps } from '../../shot-state'
import { SLO_TARGET_PCT, TOOL_NAME, isFixtureName, sloFixture, sloReading } from './slo-data'
import type { BurnRow, FixtureName } from './slo-data'

const LOCALE = 'en-US'
const int = (n: number): string => integer(n, { locale: LOCALE })
const pct = (n: number): string => percent(n, { digits: 3, input: 'percent', locale: LOCALE })
// cycle-expression-1: no percentage-point formatter (`delta()` and `percent()` print %), so the unit is hand-joined.
const pts = (n: number): string => `${Math.abs(n).toFixed(3)} pt`
const clock = (d: Date): string => time(d, { format: 'short', timeZone: 'UTC', locale: LOCALE })

const CURSOR_GROUP = 'c03-slo'
const CHART_HEIGHT = { base: 240, regular: 300 }
/** The state placeholder reserves the loaded chart's regular-width height. */
/** The hero block's height, reserved with the chart's so loading keeps the loaded footprint. */
const HERO_HEIGHT = 96
const CARD_BODY_HEIGHT = CHART_HEIGHT.regular
/** The hours after the cursor draw at this strength. */
const DIMMED = 0.3
const BAND_WASH = 0.14

const WINDOW_LABEL = 'last 24 hours'
const EMPTY_COPY = `No calls to ${TOOL_NAME} in the ${WINDOW_LABEL}. Check that the tool is wired to the call log.`
const ERROR_COPY = 'The call log did not answer. Retry, or reconnect it in Settings.'

const headroomRow = (d: BurnRow): ChartTooltipRow[] => {
  const left = d.allowed - d.failed
  return [{ label: left < 0 ? 'Over' : 'Left', value: int(Math.abs(left)) }]
}

/** The first hour the failures passed the allowance, if they did. */
const crossingOf = (rows: readonly BurnRow[]): BurnRow | undefined =>
  rows.find((r) => r.failed > r.allowed)

// cycle-expression-1: the scenario receives only `shotState`, so the over-budget and zero-failure fixtures are read from the router's `?fixture=` by hand.
function useFixtureName(): FixtureName {
  const search = useRouterState({ select: (s) => s.location.searchStr })
  const value = new URLSearchParams(search).get('fixture')
  return isFixtureName(value) ? value : 'rest'
}

/** The hour under the pointer or keyboard focus, from the shared cursor; null at rest. */
// cycle-expression-1: no hook returns the chart's hovered datum, so the cursor is read from `chartCursor` and matched to a row by time.
function useCursorRow(rows: readonly BurnRow[]): number | null {
  const cursor = chartCursor(CURSOR_GROUP)
  const state = useSyncExternalStore(cursor.subscribe, cursor.getState, () => null)
  const at = state?.value
  if (!(at instanceof Date)) return null
  const i = rows.findIndex((r) => r.at.getTime() === at.getTime())
  return i < 0 ? null : i
}

export function ExprC03Scenario({ shotState }: ScenarioProps) {
  const name = useFixtureName()
  const { calls, rows } = sloFixture(name, SLO_TARGET_PCT)
  const hovered = useCursorRow(rows)
  const focus = hovered === null ? undefined : rows[hovered]
  // The hero reads the window up to the hour under the cursor, else the whole 24 hours.
  const shown = focus === undefined ? calls : { total: focus.total, failed: focus.failed }
  const { ratePct, marginPts, allowed, left, inside } = sloReading(shown, SLO_TARGET_PCT)
  const wholeInside = sloReading(calls, SLO_TARGET_PCT).inside
  const crossing = crossingOf(rows)
  const last = rows.at(-1)

  // Ink until the SLO is missed: the verdict hue is the only status colour on the card.
  const failedColor = wholeInside ? VX.line : VX.status.bad
  const bandColor = wholeInside ? VX.status.good : VX.status.bad
  const verdictColor = inside ? VX.status.good : VX.status.bad
  const scope = focus === undefined ? WINDOW_LABEL : `to ${clock(focus.at)} UTC`

  const series: ChartSeries<BurnRow>[] = [
    {
      key: 'failed',
      label: 'Failed calls',
      color: failedColor,
      getValue: (d) => d.failed,
      formatValue: int,
    },
    {
      key: 'allowed',
      label: 'Allowed failures',
      color: VX.faint,
      dash: 'dashed',
      getValue: (d) => d.allowed,
      formatValue: int,
    },
  ]

  // cycle-expression-1: `Lines` has no band between two series, no dim-after-cursor and no direct label for a headroom, so the marks are composed by hand on `CartesianChart`.
  const marks = (plot: PlotContext<BurnRow, Date>) => {
    const failed = plot.rows('failed')
    const allowedRows = plot.rows('allowed')
    if (failed.length === 0 || allowedRows.length === 0) return []
    const cut = hovered ?? failed.length - 1
    const span = (r: typeof failed, from: number, to: number) => r.slice(from, to + 1)
    const draw = (
      key: string,
      color: string,
      dashed: boolean,
      r: typeof failed,
      opacity: number,
    ) =>
      r.length < 2
        ? []
        : [
            lineY(r, {
              id: `${key}-${opacity}`,
              x: 'x',
              y: 'y',
              stroke: color,
              strokeWidth: VX.lineWidth,
              strokeOpacity: opacity,
              ...(dashed && { strokeDasharray: VX.dashArray }),
            }),
          ]
    const band = (from: number, to: number, opacity: number) => [
      decorative(
        areaY(span(failed, from, to), {
          id: `band-${from}`,
          x: 'x',
          y1: (row) => row.datum.allowed,
          y2: 'y',
          fill: alpha(bandColor, BAND_WASH * opacity),
        }),
      ),
    ]
    const end = failed.length - 1
    const labelAt = focus === undefined ? last : focus
    const marksOut = [
      ...band(0, cut, 1),
      ...(cut < end ? band(cut, end, DIMMED) : []),
      ...draw('allowed', VX.faint, true, span(allowedRows, 0, cut), 1),
      ...draw('allowed', VX.faint, true, span(allowedRows, cut, end), DIMMED),
      ...draw('failed', failedColor, false, span(failed, 0, cut), 1),
      ...draw('failed', failedColor, false, span(failed, cut, end), DIMMED),
    ]
    if (labelAt === undefined) return marksOut
    const gap = labelAt.allowed - labelAt.failed
    return [
      ...marksOut,
      text([labelAt], {
        id: 'headroom-label',
        x: 'at',
        y: (d: BurnRow) => (d.allowed + d.failed) / 2,
        text: () => `${int(Math.abs(gap))} ${gap < 0 ? 'over' : 'left'}`,
        dx: -8,
        anchor: 'end',
        fill: verdictColor,
        fontSize: VX.text.xs,
        fontWeight: 600,
      }),
      ...(crossing === undefined
        ? []
        : [
            text([crossing], {
              id: 'crossing-label',
              x: 'at',
              y: (d: BurnRow) => d.allowed,
              text: () => `SLO missed at ${clock(crossing.at)}`,
              dy: -10,
              anchor: 'middle',
              fill: VX.status.bad,
              fontSize: VX.text.xs,
              fontWeight: 600,
            }),
          ]),
    ]
  }

  return (
    <Box data-shot="slo-24h" data-shot-states="empty loading error">
      <ChartCard
        title={`${TOOL_NAME} · SLO ${SLO_TARGET_PCT}%`}
        info={`Success rate is calls that did not fail over all calls in the ${WINDOW_LABEL}, cut (not rounded) to three decimals so a miss never reads as a pass. The dashed line is the failures the ${SLO_TARGET_PCT}% target allows for the calls so far; the solid line is the failures seen. Point at or arrow to an hour to read the window up to it.`}
        {...cardStateProps(shotState, ERROR_COPY, CARD_BODY_HEIGHT + HERO_HEIGHT, EMPTY_COPY)}
      >
        {shotState === undefined && (
          <Stack gap="sm">
            {/* cycle-expression-1: `ChartCard` facts print the hero at body size and cannot be scaled or spaced, so the hero is hand-set with Mantine text. */}
            <Group align="flex-end" gap="xl" wrap="wrap" role="group" aria-label="Reading">
              <Stack gap="xs">
                <Group align="baseline" gap="md" wrap="wrap">
                  <Text fz={VX.text.display} fw={500} lh={1}>
                    {ratePct === null ? '—' : pct(ratePct)}
                  </Text>
                  <StatusVerdict
                    color={verdictColor}
                    word={inside ? 'Inside SLO' : 'Outside SLO'}
                    phrase={`${inside ? 'Inside' : 'Outside'} the ${SLO_TARGET_PCT}% SLO`}
                  />
                  {marginPts !== null && (
                    <DeltaBadge
                      value={marginPts}
                      format={pts}
                      period={`${SLO_TARGET_PCT}% target`}
                    />
                  )}
                </Group>
                <Text fz={VX.text.xs} c="dimmed">
                  success rate, {scope}
                </Text>
              </Stack>
              <Stack gap="xs">
                <Group align="baseline" gap="sm" wrap="wrap">
                  <Text fz={VX.text.display} fw={500} lh={1}>
                    {int(Math.abs(left))}
                  </Text>
                  <Text fz={VX.text.sm}>
                    {left < 0
                      ? `failed calls over the ${int(allowed)} allowed`
                      : `failed calls left, ${int(allowed)} allowed`}
                  </Text>
                </Group>
                <Text fz={VX.text.xs} c="dimmed">
                  {int(shown.total)} calls, {int(shown.failed)} failed
                </Text>
              </Stack>
            </Group>
            <VisuallyHidden role="status" aria-live="polite">
              {`${scope}: ${int(shown.failed)} failed, ${int(allowed)} allowed, ${int(Math.abs(left))} ${left < 0 ? 'over' : 'left'}`}
            </VisuallyHidden>
            {/* cycle-expression-1: no axis title prop, so the y unit is a hand-set caption above the plot. */}
            <Text fz={VX.text.xs} c="dimmed">
              Failed calls, cumulative
            </Text>
            <Box data-shot-hover data-shot-tooltip>
              <CartesianChart<BurnRow, Date>
                data={rows}
                ariaLabel={`${TOOL_NAME} cumulative failed calls against the failures allowed by the ${SLO_TARGET_PCT}% SLO, ${WINDOW_LABEL}`}
                x={(d) => d.at}
                y={{ format: int }}
                series={series}
                marks={marks}
                legend={false}
                height={CHART_HEIGHT}
                cursorGroup={CURSOR_GROUP}
                tooltip={{ rows: headroomRow }}
              />
            </Box>
          </Stack>
        )}
      </ChartCard>
    </Box>
  )
}
