/**
 * StatCard — the KPI atom (docs/DESIGN-SPEC.md §5, docs/CONTROLS-SPEC.md §2.2): a panel +
 * shadow-card + card-radius card (spacing xs/sm inset, no min-height — the content states the
 * height, ~88-96px for the title/hero/trend shape). The header composes
 * `WidgetHeader tier="widget"` — title/icon/value/delta/deltaPeriod all render through it, on the
 * shared hero-metric row under the title. `actions` (e.g. a ghost "..." menu trigger) is wrapped in
 * `CtlSlot tier="widget"` — the 24px ActionIcon step the 28px widget header row can hold, not the
 * 30px `ctl` tier, which used to grow the row and knock a card with a kebab 2px out of line with the
 * card beside it. `StatCard` is Mantine-coupled (`src/dashboard/`), unlike `ChartCard`, so it can
 * mount the slot at all; `ChartCard` writes the same `data-basalt-tier="widget"` marker by hand.
 *
 * `sparklinePlacement` decides where the trend visual sits: `'bleed'` (default) keeps the historic
 * full-width row beneath the hero value, bled past the card's own inset padding; `'right'` sits it
 * beside the hero row, the reference-design look. Below `sm`, `'right'` collapses back to the
 * `'bleed'` layout — CSS only, no JS branch (`stat-card.module.css`).
 *
 * `info` and `subtitle` are forwarded to that same `WidgetHeader`, and a hero KPI usually wants
 * both: `value` is typed `string`, so the unit and the basis have nowhere else to go — `subtitle`
 * carries them as a muted line, and `info` puts "how this number is computed" behind the glyph
 * beside the title instead of inside the heading's accessible name.
 *
 * `src/dashboard` stays @visx-free — `sparkline` is a plain `ReactNode` slot, never a chart import
 * here. Pass a `LineSparkline`/`BarSparkline` from `basalt-ui/charts` at the call site.
 *
 * `tone` marks the card as past a threshold with an accent rail down its leading edge. It exists
 * because `value` is typed `string`: without it, a card whose number has crossed a threshold reads
 * exactly as calm as one that hasn't, and the only way out from the consumer side is to wrap the
 * card in a hand-rolled positioned `<Box>` — which is a second card idiom in the app, drawn by code
 * the guard has no way to recognize as one. The rail is the largest signal available without
 * touching the value's own type: full card height, overlaying the card's edge rather than adding to
 * it, so layout is unchanged. `undefined` renders nothing at all — absence of a reading is neither a
 * good one nor a bad one, and must never be tinted. `'good'` is a deliberate positive verdict, never
 * the meaning of omission: it exists for the threshold where the calm number IS the finding (zero
 * downtime over the window), and a card that has measured nothing must not be able to reach green by
 * leaving the prop off.
 *
 * @example
 * import { StatCard } from 'basalt-ui'
 * import { LineSparkline } from 'basalt-ui/charts'
 *
 * // `sparkline` is a RENDER PROP over the slot's measured box, so full-bleed is genuinely the
 * // card's width — no `useChartSize` wrapper component, no hardcoded pixel value.
 * <StatCard
 *   title="Active Users"
 *   value="12,483"
 *   delta={4.2}
 *   sparkline={({ width, height }) => <LineSparkline data={history} width={width} height={height} />}
 * />
 *
 * @example
 * // The reference-design look — sparkline beside the hero value row instead of bled below it. The
 * // slot is a fixed 72×26 there, so the render prop still receives the box it should draw into.
 * <StatCard
 *   title="Active Users"
 *   value="12,483"
 *   delta={4.2}
 *   sparklinePlacement="right"
 *   sparkline={({ width, height }) => (
 *     <BarSparkline data={history} width={width} height={height} ariaLabel="Active users trend" />
 *   )}
 * />
 *
 * @example
 * // A hero card: the unit on its own muted line, the method behind the info glyph.
 * <StatCard
 *   title="Training load"
 *   value="412"
 *   subtitle="TSS · 7-day rolling"
 *   info="Sum of per-session TSS over the last 7 days, Garmin-reported."
 * />
 *
 * @example
 * // Past a threshold — an accent rail down the leading edge, value untouched.
 * <StatCard title="Downtime" value="29 min" tone="bad" />
 *
 * @example
 * // The earned zero — a measured value worth asserting, not a card that merely has no reading.
 * <StatCard title="Downtime · last 24h" value="0 min" tone="good" />
 *
 * @example
 * // The honest gate. A zero can be synthesized as well as measured — a downtime figure derived
 * // from outage rows reads 0 both when probes ran clean AND when no probe cycle was ingested at
 * // all, because a dead collector opens no outage row either. `tone` is a positive assertion
 * // about a reading, so the gate belongs on whether a reading exists, not on whether the number
 * // happens to be defined — those are separate facts. Gate on measured coverage instead:
 * <StatCard
 *   title="Downtime · last 24h"
 *   value={`${downtimeMinutes} min`}
 *   tone={hasCoverage ? (downtimeMinutes === 0 ? 'good' : 'bad') : undefined}
 * />
 */
import { Box, Card, VisuallyHidden } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { WidgetHeader } from '../widget-header'
import { CtlSlot } from '../theme'
import { VX } from '../tokens'
import classes from './stat-card.module.css'

/** A threshold verdict on the card's value. `undefined` is never tinted — see the module docblock. */
export type StatCardTone = 'good' | 'warn' | 'bad'

/**
 * The `'right'` placement's slot width, in px — a flex BASIS, not a fixed size. 72 is the reference
 * KPI card's trend width and the slot asks for exactly that; when the hero row needs the space (a
 * long formatted value plus a delta badge in a 4-up grid) the slot is the side that yields, because
 * the number is the card's content and the trend qualifies it. The render prop is handed the
 * MEASURED width either way, so the bars are drawn at the width they actually got — the previous
 * fixed 72 painted over the value instead.
 */
const SPARKLINE_RIGHT_WIDTH = 72
/** The `'right'` placement's slot height — sized to the hero row it sits beside, not to the card. */
const SPARKLINE_RIGHT_HEIGHT = 26

/**
 * The measured box a `sparkline` render prop receives.
 *
 * A `LineSparkline`/`BarSparkline` takes `width`/`height` as NUMBERS (they are SVG attributes — an
 * svg cannot size itself from CSS and then scale its scales), so "full bleed" was never expressible
 * as a `ReactNode`: the caller had to guess a pixel width, or write its own `useChartSize` wrapper
 * component. Four consumers wrote that wrapper; two of them hardcoded a width and drew a sparkline
 * that stopped short of the card edge on every viewport but the one they built on.
 */
export type StatCardSparklineSize = {
  width: number
  height: number
}

/**
 * Measures a slot and re-measures on resize. Plain `ResizeObserver`, not `useChartSize`:
 * `src/dashboard/**` is Mantine-coupled and @visx-FREE (see the module doc), and `useChartSize`
 * wraps `@visx/responsive`.
 *
 * The `undefined` guard is for the test DOM — happy-dom ships no `ResizeObserver`, and the one-shot
 * measure above it is what keeps a mounted card rendering its sparkline there.
 */
function useSlotWidth(active: boolean): {
  ref: (node: HTMLDivElement | null) => void
  width: number
} {
  const [width, setWidth] = useState(0)
  const nodeRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = nodeRef.current
    if (!active || node === null) return
    const measure = () => {
      setWidth(node.getBoundingClientRect().width)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [active])

  return {
    ref: (node) => {
      nodeRef.current = node
    },
    width,
  }
}

/** The rail's width, in px. Wide enough to read as a deliberate mark at a glance, narrow enough
 * that it cannot be mistaken for the card's own edge. */
const TONE_RAIL_WIDTH = 3

const TONE_LABEL: Record<StatCardTone, string> = {
  good: 'Within the good threshold',
  warn: 'Past the warning threshold',
  bad: 'Past the severe threshold',
}

export type StatCardProps = {
  /** Head-font title, rendered via `WidgetHeader tier="widget"`. */
  title: string
  /** Optional leading icon, forwarded to `WidgetHeader`. */
  icon?: ReactNode
  /** Muted line under the hero row, forwarded to `WidgetHeader` — the unit or basis a
   * pre-formatted `value` cannot carry (`per day`, `of 40 planned`). Not a second metric. */
  subtitle?: string
  /** Info tooltip beside the title, forwarded to `WidgetHeader` — how the number is computed. Never
   * part of the heading's accessible name; see `WidgetHeaderProps.info`. */
  info?: string
  /** Pre-formatted KPI value string (mono ~24px, weight 600, ink) — the hero-row value. */
  value: string
  /** Signed delta rendered via `DeltaBadge`; omit to hide the trend chip entirely. */
  delta?: number
  /** Optional comparison timeframe shown after the delta (e.g. `MoM`) — forwarded to `DeltaBadge`. */
  deltaPeriod?: string
  /**
   * Optional trend visual. Either a node, or a RENDER PROP receiving the slot's measured box.
   *
   * Prefer the render prop for anything from `basalt-ui/charts`: those take numeric `width`/`height`
   * (SVG attributes), so a plain node has to hardcode a width, and a hardcoded width is not
   * full-bleed on any viewport but the one it was typed on. With `sparklinePlacement="bleed"` the
   * measured width is the card's own inner width including the bled inset; with `'right'` it is the
   * fixed 72×26 slot (see {@link SPARKLINE_RIGHT_WIDTH} for why that one is not measured).
   *
   * @example
   * sparkline={({ width, height }) => <BarSparkline data={history} width={width} height={height} />}
   */
  sparkline?: ReactNode | ((size: StatCardSparklineSize) => ReactNode)
  /** Where `sparkline` sits. `'bleed'` (default) is today's full-width row bled to the card edges;
   * `'right'` sits it beside the hero value row. Collapses to `'bleed'` below `sm`. */
  sparklinePlacement?: 'bleed' | 'right'
  /** Header-right slot (e.g. a ghost "..." menu trigger) — wrapped in `CtlSlot tier="widget"`, so a
   * raw `ActionIcon` with no `size` lands on the 24px step the 28px header row holds (C1/C5). */
  actions?: ReactNode
  /** Threshold verdict — draws an accent rail down the card's leading edge and announces itself to
   * assistive tech. Omitting it is NOT `'good'`: omitted covers a reading that is fine AND one that
   * is absent, and stays untinted so a card with nothing measured can never render green. Pass
   * `'good'` only to assert a measured value that has earned the verdict. */
  tone?: StatCardTone
}

export function StatCard({
  title,
  icon,
  subtitle,
  info,
  value,
  delta,
  deltaPeriod,
  sparkline,
  sparklinePlacement = 'bleed',
  actions,
  tone,
}: StatCardProps) {
  const isRender = typeof sparkline === 'function'
  const bleeds = sparklinePlacement === 'bleed'
  // Only a render prop needs a measurement; a plain node sizes itself.
  const slot = useSlotWidth(isRender)
  const measured: StatCardSparklineSize = { width: slot.width, height: SPARKLINE_RIGHT_HEIGHT }

  return (
    <Card
      style={{
        // Card inset = spacing xs / sm, matching every other basalt card. `overflow: hidden` clips
        // the full-bleed sparkline to the card's rounded corners; an element's own `box-shadow`
        // renders outside its border box and is NOT clipped by its own `overflow`, so the
        // shadow-card ring is unaffected (verified — only an ANCESTOR's overflow clips a
        // descendant's shadow). Mantine's Card root already sets `overflow: hidden`; this is
        // explicit for intent.
        //
        // NO `minHeight`. It was 118px, which is ~25px of dead space under a card holding a title
        // row, a hero row and a 26px trend — and it was dead space the card could not use, since the
        // body is `height: 100%` and the sparkline is `margin-top: auto`. The content is what states
        // the height now (~88-96px), and four cards in a `SimpleGrid` still match because a grid row
        // stretches its items.
        padding: 'var(--mantine-spacing-xs) var(--mantine-spacing-sm)',
        overflow: 'hidden',
        // Anchors the tone rail. Set unconditionally so a card's stacking context does not change
        // depending on whether it happens to have crossed a threshold this render.
        position: 'relative',
      }}
      data-tone={tone}
    >
      {tone !== undefined && (
        <>
          {/* The rail is decoration; the verdict it encodes is real information, so it is also
              stated in text for anyone who cannot see a 3px colour bar. Colour alone is never the
              only carrier of a threshold. */}
          <VisuallyHidden>{TONE_LABEL[tone]}</VisuallyHidden>
          <Box
            aria-hidden="true"
            style={{
              position: 'absolute',
              insetBlock: 0,
              insetInlineStart: 0,
              width: TONE_RAIL_WIDTH,
              // `StatCardTone`'s members are `VX.status` keys by construction, so the rail reads the
              // per-scheme `--vx-status-*` solid directly — never a hex, so it re-resolves in both
              // schemes and under a consumer's `derive` retune. Contrast against
              // `--vx-surface-panel` is measured in `theme/contrast.test.ts`.
              background: VX.status[tone],
            }}
          />
        </>
      )}

      <div className={classes.body} data-placement={sparklinePlacement}>
        <div className={classes.header}>
          <WidgetHeader
            tier="widget"
            title={title}
            {...(icon !== undefined && { icon })}
            {...(subtitle !== undefined && { subtitle })}
            {...(info !== undefined && { info })}
            value={value}
            {...(delta !== undefined && { delta })}
            {...(deltaPeriod !== undefined && { deltaPeriod })}
            // `tier="widget"`, not the default `ctl`: the header row this slot sits in is 28px
            // (`--vx-space-widget-header-height`) and a 30px `ctl` control grew it to 30, so a card
            // with a kebab sat 2px below a card without one in the same grid row. See
            // `theme/ctl-theme.tsx`'s `WIDGET_THEME`.
            {...(actions !== undefined && {
              actions: <CtlSlot tier="widget">{actions}</CtlSlot>,
            })}
          />
        </div>

        {sparkline !== undefined && (
          <div
            ref={slot.ref}
            className={bleeds ? classes.sparklineBleed : classes.sparklineRight}
            {...(!bleeds && {
              // CUSTOM PROPERTIES, not `flexBasis`/`height` directly. A React inline style beats
              // every stylesheet rule, so an inline `flexBasis: 72` also applied below `sm` — where
              // `'right'` collapses to a COLUMN and flex-basis is therefore the main-axis HEIGHT.
              // The mobile sparkline rendered in a 72px-tall box holding 26px of bars, which is the
              // dead band under every KPI value on a phone. Handed to CSS as values instead, the
              // media query can reset the box and the numbers still live in one place.
              style: {
                '--basalt-stat-sparkline-w': `${SPARKLINE_RIGHT_WIDTH}px`,
                '--basalt-stat-sparkline-h': `${SPARKLINE_RIGHT_HEIGHT}px`,
              } as CSSProperties,
            })}
          >
            {/* A measured slot renders nothing on the first commit (width 0) — an SVG at width 0 is
                a visible 0-width box that then jumps, which is worse than one frame of nothing. */}
            {isRender ? measured.width > 0 && sparkline(measured) : sparkline}
          </div>
        )}
      </div>
    </Card>
  )
}
