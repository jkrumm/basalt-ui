import { dot } from '@tanstack/charts/dot'
import { lineY } from '@tanstack/charts/line'
import { decorative } from '@tanstack/charts/mark/decorative'
import { text } from '@tanstack/charts/text'
import { Box, Group, Stack, Text } from '@mantine/core'
import { useSyncExternalStore } from 'react'
import { CartesianChart, chartCurve } from 'basalt-ui/charts'
import type { ChartMarks, ChartSeries, ChartTooltipRow, PlotContext } from 'basalt-ui/charts'
import { VX } from 'basalt-ui/tokens'
import {
  CHART_HEIGHT,
  GHOST,
  X_FREE,
  X_MIN,
  X_TICKS,
  Y_MAX,
  Y_MIN,
  fmtExtra,
  fmtPerMillion,
  fmtPrice,
  fmtTick,
} from './fixture'
import type { Model, Size, View } from './fixture'
import { CURSOR_GROUP, useFocusedModel } from './focus'

const FRONTIER_KEY = 'frontier'
const BEATEN_KEY = 'beaten'

/** Colour carries one thing: on the frontier (the accent) or beaten (neutral). Family is in the name. */
const SERIES: readonly ChartSeries<Model>[] = [
  {
    key: FRONTIER_KEY,
    label: 'Frontier',
    color: VX.accent,
    getValue: (d) => (d.frontier ? d.quality : null),
    formatValue: (v) => `${v} quality`,
  },
  {
    key: BEATEN_KEY,
    label: 'Beaten',
    color: VX.muted,
    getValue: (d) => (d.frontier ? null : d.quality),
    formatValue: (v) => `${v} quality`,
  },
]

// cycle-expression-1: the x scale has no log type (`scale: 'log'` is y-only), so x is log10(price)
// and the tick text is written back to dollars here.
const formatX = (x: number): string => (x === X_FREE ? 'Free' : fmtTick(10 ** x))

/** Radii step off the dot token so a small dot keeps the 8 px marker floor. */
const RADIUS: Record<Size, number> = {
  Small: VX.dotR,
  Medium: VX.dotR * 1.3,
  Large: VX.dotR * 1.6,
}
const MIN_RADIUS = 4
/** Below `regular` the plot is a phone's: dots step down a quarter so a cluster does not hide itself. */
const radiusScale = (plot: PlotContext<Model, number>): number =>
  plot.containerClass === 'micro' || plot.containerClass === 'compact' ? 0.75 : 1
const radiusOf = (d: Model, scale: number): number =>
  Math.max(MIN_RADIUS, RADIUS[d.size ?? 'Medium'] * scale)

// cycle-expression-1: no spacing, opacity or dash tokens for chart marks; the label gap, height and the
// stroke and dash values derive from the type and line tokens, and the opacities are named constants.
const LABEL_FONT_PX = VX.text.micro
const LABEL_GAP_PX = Math.round(LABEL_FONT_PX / 3)
const LABEL_HEIGHT_PX = LABEL_FONT_PX + 2
const RING_PX = VX.line2Width
const LIT_RING_PX = VX.lineWidth
const HAIRLINE_PX = VX.line2Width / 2
const DOTTED = `${VX.line2Width / 2} ${VX.line2Width * 2}`
const HOLLOW_FILL = 0.14
const DIMMED = 0.3
const GHOST_FILL = 0.25

let measureContext: CanvasRenderingContext2D | null | undefined
// cycle-expression-1: no text-measuring seam in the kit; label width is read off a canvas in the
// page's own font. Labels draw only once the client is mounted, so no server pass guesses a width.
function textWidth(label: string): number {
  if (measureContext === undefined) {
    measureContext =
      typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  }
  if (measureContext === null) return label.length * LABEL_FONT_PX
  measureContext.font = `${LABEL_FONT_PX}px ${getComputedStyle(document.body).fontFamily}`
  return measureContext.measureText(label).width
}

type Box2 = { left: number; right: number; top: number; bottom: number }
type Request = { model: Model; label: string; gutter?: boolean }
type Placed = {
  model: Model
  label: string
  dx: number
  dy: number
  /** A guttered label's leader runs from its dot to this point, in data coordinates. */
  leader: { x: number; y: number } | null
}

const overlaps = (a: Box2, b: Box2): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

// cycle-expression-1: direct labels need pixel positions and a collision pass written by hand. Each
// label tries eight spots around its dot, shifted back inside the plot, and takes the first that
// touches no placed label and no dot. A request flagged `gutter` that finds none (the widest-gap
// hollow dots sit in a crowd) stacks into the empty lower-right corner with a leader to its dot; any
// other label with no free spot is dropped, never drawn over a dot.
function placeLabels(
  plot: PlotContext<Model, number>,
  requests: readonly Request[],
  dots: readonly Model[],
  xDomain: readonly [number, number],
): Placed[] {
  const [yLo, yHi] = plot.yDomain
  const scale = radiusScale(plot)
  const at = (m: Model): { px: number; py: number } | null => {
    const fraction = plot.xFraction(m.x)
    if (fraction === null) return null
    return {
      px: fraction * plot.plotWidth,
      py: (1 - (m.quality - yLo) / (yHi - yLo)) * plot.plotHeight,
    }
  }
  const toData = (px: number, py: number): { x: number; y: number } => ({
    x: xDomain[0] + (px / plot.plotWidth) * (xDomain[1] - xDomain[0]),
    y: yHi - (py / plot.plotHeight) * (yHi - yLo),
  })
  const obstacles: { model: Model; box: Box2 }[] = []
  for (const m of dots) {
    const p = at(m)
    if (p === null) continue
    const r = radiusOf(m, scale)
    obstacles.push({
      model: m,
      box: { left: p.px - r, right: p.px + r, top: p.py - r, bottom: p.py + r },
    })
  }
  const taken: Box2[] = []
  const placed: Placed[] = []
  const free = (box: Box2, own: Model): boolean =>
    box.top >= 0 &&
    box.bottom <= plot.plotHeight &&
    !taken.some((t) => overlaps(t, box)) &&
    !obstacles.some((o) => o.model !== own && overlaps(o.box, box))
  let gutterSlot = 0
  for (const { model, label, gutter } of requests) {
    const p = at(model)
    if (p === null) continue
    const width = textWidth(label)
    const reach = radiusOf(model, scale) + LABEL_GAP_PX
    const spots: [number, number][] = [
      [p.px - reach - width, p.py - reach - LABEL_HEIGHT_PX],
      [p.px + reach, p.py - reach - LABEL_HEIGHT_PX],
      [p.px - width / 2, p.py - reach - LABEL_HEIGHT_PX],
      [p.px + reach, p.py + reach],
      [p.px - reach - width, p.py + reach],
      [p.px - width / 2, p.py + reach],
      [p.px - reach - width, p.py - LABEL_HEIGHT_PX / 2],
      [p.px + reach, p.py - LABEL_HEIGHT_PX / 2],
    ]
    let done = false
    for (const [rawLeft, top] of spots) {
      const left = Math.min(Math.max(rawLeft, 0), Math.max(plot.plotWidth - width, 0))
      const box: Box2 = { left, right: left + width, top, bottom: top + LABEL_HEIGHT_PX }
      if (!free(box, model)) continue
      taken.push(box)
      placed.push({
        model,
        label,
        dx: left - p.px,
        dy: top + LABEL_HEIGHT_PX / 2 - p.py,
        leader: null,
      })
      done = true
      break
    }
    if (done || gutter !== true) continue
    for (let slot = gutterSlot; slot < gutterSlot + 6; slot += 1) {
      const top = plot.plotHeight - (slot + 1) * (LABEL_HEIGHT_PX + LABEL_GAP_PX) - LABEL_GAP_PX
      const left = Math.max(plot.plotWidth - width, 0)
      const box: Box2 = { left, right: left + width, top, bottom: top + LABEL_HEIGHT_PX }
      if (!free(box, model)) continue
      taken.push(box)
      gutterSlot = slot + 1
      placed.push({
        model,
        label,
        dx: left - p.px,
        dy: top + LABEL_HEIGHT_PX / 2 - p.py,
        leader: toData(Math.min(Math.max(p.px, box.left), box.right), box.top),
      })
      break
    }
  }
  return placed
}

const beaterOf = (view: View, m: Model | undefined): Model | undefined =>
  m?.beatenBy == null ? undefined : view.models.find((o) => o.name === m.beatenBy?.name)

/** The two widest gaps are annotated at rest: a hollow dot, a line to its beater, a short label. */
const ANNOTATED = 2

// cycle-expression-1: no scatter kind, so the dots, the staircase, the connectors, the axis break and
// the labels are composed from engine marks. One dot mark per state and size, because a mark takes one fill and one r.
function makeMarks(view: View, focused: Model | undefined, labelled: boolean) {
  const beater = beaterOf(view, focused)
  const annotated = view.beaten.slice(0, ANNOTATED)
  return function marks(plot: PlotContext<Model, number>): ChartMarks {
    const out: ChartMarks[number][] = []
    if (view.breakAt !== null) {
      out.push(
        decorative(
          lineY(
            [
              { x: view.breakAt, y: Y_MIN },
              { x: view.breakAt, y: Y_MAX },
            ],
            { id: 'axis-break', x: 'x', y: 'y', stroke: VX.axisStroke, strokeDasharray: DOTTED },
          ),
        ),
      )
    }
    out.push(
      decorative(
        lineY(view.steps, {
          id: 'frontier-steps',
          x: 'x',
          y: 'y',
          stroke: VX.ink2,
          strokeWidth: VX.line2Width,
          strokeDasharray: VX.dashArray,
          strokeOpacity: focused === undefined ? 1 : DIMMED,
          curve: chartCurve('stepAfter'),
        }),
      ),
    )
    const links = focused === undefined ? annotated : focused.beatenBy === null ? [] : [focused]
    for (const m of links) {
      const to = beaterOf(view, m)
      if (to === undefined) continue
      out.push(
        decorative(
          lineY(
            [
              { x: m.x, y: m.quality },
              { x: to.x, y: to.quality },
            ],
            {
              id: `link-${m.short}`,
              x: 'x',
              y: 'y',
              stroke: focused === undefined ? VX.muted : VX.ink,
              strokeWidth: focused === undefined ? HAIRLINE_PX : RING_PX,
              ...(focused === undefined && { strokeDasharray: DOTTED }),
            },
          ),
        ),
      )
    }
    const scale = radiusScale(plot)
    const shown: Model[] = []
    for (const s of plot.visible) {
      const rows = plot.rows(s.key).filter((r) => r.y !== null)
      const buckets = new Map<string, typeof rows>()
      for (const r of rows) {
        shown.push(r.datum)
        if (r.datum === focused || r.datum === beater) continue
        const key = String(r.datum.size ?? 'one')
        buckets.set(key, [...(buckets.get(key) ?? []), r])
      }
      const solid = s.key === FRONTIER_KEY
      const rest = focused === undefined ? 1 : DIMMED
      for (const [bucket, group] of buckets) {
        const first = group[0]
        if (first === undefined) continue
        out.push(
          dot(group, {
            id: `${s.key}-${bucket}`,
            x: 'x',
            y: 'y',
            r: radiusOf(first.datum, scale),
            fill: s.color,
            fillOpacity: (solid ? 1 : HOLLOW_FILL) * rest,
            stroke: s.color,
            strokeOpacity: rest,
            strokeWidth: RING_PX,
          }),
        )
      }
      for (const lit of [focused, beater]) {
        const row = rows.find((r) => r.datum === lit)
        if (row === undefined) continue
        out.push(
          dot([row], {
            id: `lit-${row.datum.short}`,
            x: 'x',
            y: 'y',
            r: radiusOf(row.datum, scale),
            fill: s.color,
            fillOpacity: solid ? 1 : HOLLOW_FILL,
            stroke: VX.ink,
            strokeWidth: LIT_RING_PX,
          }),
        )
      }
    }
    const requests: Request[] =
      focused === undefined
        ? [
            ...annotated.map((model) => ({
              model,
              gutter: true,
              label: `${model.short}: ${fmtExtra(model.beatenBy?.extra ?? 0)} vs ${model.beatenBy?.short ?? ''}`,
            })),
            ...view.frontier
              .toSorted((a, b) => b.quality - a.quality)
              .map((model) => ({ model, label: model.short })),
          ]
        : [
            { model: focused, label: focused.short },
            ...(beater === undefined ? [] : [{ model: beater, label: beater.short }]),
          ]
    const placed = labelled ? placeLabels(plot, requests, shown, [X_MIN, view.xMax]) : []
    for (const l of placed) {
      if (l.leader !== null) {
        out.push(
          decorative(
            lineY(
              [
                { x: l.model.x, y: l.model.quality },
                { x: l.leader.x, y: l.leader.y },
              ],
              {
                id: `leader-${l.model.short}`,
                x: 'x',
                y: 'y',
                stroke: VX.muted,
                strokeWidth: HAIRLINE_PX,
                strokeDasharray: DOTTED,
              },
            ),
          ),
        )
      }
      out.push(
        decorative(
          text([l], {
            id: `label-${l.model.short}`,
            x: () => l.model.x,
            y: () => l.model.quality,
            text: () => l.label,
            anchor: 'start',
            dx: l.dx,
            dy: l.dy,
            fill: VX.ink2,
            fontSize: LABEL_FONT_PX,
          }),
        ),
      )
    }
    return out
  }
}

const tooltipRows = (d: Model): readonly ChartTooltipRow[] => [
  { label: 'Price', value: fmtPerMillion(d.price) },
  ...(d.beatenBy === null
    ? [{ label: 'Verdict', value: 'No cheaper model scores as much' }]
    : [
        { label: 'Beaten by', value: d.beatenBy.name },
        {
          label: 'Gap',
          value: `${fmtPrice(d.beatenBy.extra)} cheaper, ${d.beatenBy.gain} points higher`,
        },
      ]),
]

/** Three lines of `sm` text at the body's 1.5 line height: the longest readout at 390 wide, reserved so nothing moves on focus. */
const READOUT_MIN_PX = Math.ceil(3 * VX.text.sm * 1.5)

const readoutOf = (m: Model): string =>
  m.beatenBy === null
    ? `${m.name}: ${m.quality} quality at ${fmtPerMillion(m.price)}. On the frontier: no cheaper model scores as much.`
    : `${m.name}: ${m.quality} quality at ${fmtPerMillion(m.price)}. Beaten by ${m.beatenBy.name}, ${fmtPrice(m.beatenBy.extra)} cheaper and ${m.beatenBy.gain} points higher.`

function KeyDot({ r, filled, color }: { r: number; filled: boolean; color: string }) {
  const box = Math.ceil(r * 2 + RING_PX * 2)
  return (
    <svg width={box} height={box} aria-hidden="true">
      <circle
        cx={box / 2}
        cy={box / 2}
        r={r}
        fill={color}
        fillOpacity={filled ? 1 : HOLLOW_FILL}
        stroke={color}
        strokeWidth={RING_PX}
      />
    </svg>
  )
}

// cycle-expression-1: the legend swatch has no dot shape and cannot show hollow versus filled or dot
// size, so the built-in legend is off and this one-row key is hand-drawn.
function ChartKey() {
  const width = Math.ceil(RADIUS.Large * 4)
  const height = Math.ceil(RADIUS.Large * 2 + RING_PX * 2)
  return (
    <Group gap="md" wrap="wrap" align="center">
      <Group gap="xs" wrap="nowrap">
        <svg width={width} height={height} aria-hidden="true">
          <line
            x1={0}
            x2={width}
            y1={height / 2}
            y2={height / 2}
            stroke={VX.ink2}
            strokeWidth={RING_PX}
            strokeDasharray={VX.dashArray}
          />
          <circle
            cx={width / 2}
            cy={height / 2}
            r={RADIUS.Medium}
            fill={VX.accent}
            stroke={VX.accent}
            strokeWidth={RING_PX}
          />
        </svg>
        <Text size="xs" c="dimmed">
          Frontier
        </Text>
      </Group>
      <Group gap="xs" wrap="nowrap">
        <KeyDot r={RADIUS.Medium} filled={false} color={VX.muted} />
        <Text size="xs" c="dimmed">
          Beaten
        </Text>
      </Group>
      <Group gap="xs" wrap="nowrap">
        <Text size="xs" c="dimmed">
          Size
        </Text>
        {(['Small', 'Medium', 'Large'] as const).map((size) => (
          <Group key={size} gap={0} wrap="nowrap">
            <KeyDot r={RADIUS[size]} filled color={VX.ink2} />
            <Text size="xs" c="dimmed">
              {size.slice(0, 1)}
            </Text>
          </Group>
        ))}
      </Group>
    </Group>
  )
}

const subscribeNever = (): (() => void) => () => {}

const Y_PROPS = {
  domain: [Y_MIN, Y_MAX],
  ticks: [40, 60, 80, 100],
  format: (v: number) => String(v),
} as const

/** The loading skeleton: the same chart box and axes with grey placeholder dots in a rising band. */
function GhostChart({ view }: { view: View }) {
  return (
    <CartesianChart<Model, number>
      ariaLabel="Loading the price and quality of the models"
      data={GHOST}
      x={(d) => d.x}
      xDomain={[X_MIN, view.xMax]}
      xTicks={X_TICKS}
      formatX={formatX}
      y={Y_PROPS}
      series={SERIES}
      marks={(plot) => [
        dot(
          plot.rows(BEATEN_KEY).filter((r) => r.y !== null),
          {
            id: 'ghost-dots',
            x: 'x',
            y: 'y',
            r: RADIUS.Medium,
            fill: VX.muted,
            fillOpacity: GHOST_FILL,
            stroke: VX.muted,
            strokeOpacity: GHOST_FILL,
            strokeWidth: RING_PX,
          },
        ),
      ]}
      legend={false}
      height={CHART_HEIGHT}
      cursorGroup="n05-ghost"
      tooltip={false}
    />
  )
}

/** The price-quality scatter: quality up, log price right, the staircase of models nothing beats. */
export function PriceQualityChart({
  view,
  pending,
  idle,
}: {
  view: View
  pending: boolean
  /** The lead fact in words: what the readout says when no dot has focus. */
  idle: string
}) {
  const focused = useFocusedModel(view)
  const labelled = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  )
  return (
    <Stack gap="xs">
      {/* cycle-expression-1: AxisConfig has no title, so both axis names are captions written around the chart. */}
      <Text size="xs" c="dimmed">
        Quality score, axis from {Y_MIN}
      </Text>
      {pending ? (
        <GhostChart view={view} />
      ) : (
        <CartesianChart<Model, number>
          ariaLabel={`Quality score against price per 1M tokens for ${view.models.length} models, with the frontier of models no cheaper model beats`}
          data={view.models}
          x={(d) => d.x}
          xDomain={[X_MIN, view.xMax]}
          xTicks={X_TICKS}
          formatX={formatX}
          y={Y_PROPS}
          series={SERIES}
          marks={makeMarks(view, focused, labelled)}
          legend={false}
          height={CHART_HEIGHT}
          cursorGroup={CURSOR_GROUP}
          tooltip={{ formatHeader: (_x, d) => d.name, rows: tooltipRows }}
        />
      )}
      <Group justify="flex-end">
        <Text size="xs" c="dimmed">
          {view.breakAt === null
            ? 'Price per 1M tokens, USD, log scale'
            : 'Price per 1M tokens, USD, log scale; Free left of the break'}
        </Text>
      </Group>
      <ChartKey />
      {/* cycle-expression-1: the tooltip is the only readout the kit gives and it vanishes with the
          pointer, so the focused model, or the lead fact when none has focus, is also written here,
          in a live region of fixed height. */}
      <Box aria-live="polite" mih={READOUT_MIN_PX}>
        <Text size="sm">{focused === undefined ? idle : readoutOf(focused)}</Text>
      </Box>
    </Stack>
  )
}
