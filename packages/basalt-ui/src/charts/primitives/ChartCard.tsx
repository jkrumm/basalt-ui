/**
 * Standard wrapper for every visx chart (docs/CONTROLS-SPEC.md §2.2) — card with a `WidgetHeader
 * tier="widget"` title row (icon/info/value/delta/count/actions) plus an optional subtitle, over a
 * clipped chart body. Do not wrap visx charts in bare divs.
 *
 * `WidgetHeader` lives in `src/widget-header/` and is itself Mantine-free, so composing it here
 * keeps `./charts` resolving with no `@mantine/*` installed (`check-dist-layering.mjs`,
 * `basalt/token-layer-boundary`). The `actions` slot cannot mount `CtlSlot` (Mantine-coupled) for
 * the same reason — it carries only `data-basalt-tier="widget"`; a basalt control placed there
 * sizes itself (`size="ctl"` internally), and a raw Mantine element is not auto-tiered.
 *
 * The header renders only when at least one of title/info/value/actions/icon/count is set — ending
 * the `''`-as-hidden-header sentinel a consumer used to reach for otherwise.
 */
import type { CSSProperties, ReactNode } from 'react'
import { cx } from '../../common/props'
import type { BasaltProps, SlotStylesProps } from '../../common/props'
import { VX } from '../../tokens'
import { WidgetHeader } from '../../widget-header'
import type { DeltaPolarity } from '../../widget-header'

// Surfaces resolve per theme via CSS vars, so the styles are static (no useMemo/isDark).
// Depth = `shadow-card` (a whisper shadow + a 1px ring baked into the same value), never a
// `border` property (docs/DESIGN-SPEC.md §5) — so a ChartCard reads IDENTICALLY to a Mantine
// Card/Paper (same shadow token, same radius token, no intrinsic margin; outer spacing comes
// from the parent Stack/SimpleGrid gap). Shadow + panel background + card radius all live on
// this OUTER box, which is never clipped — only the chart body below clips its own bottom
// corners (`bodyClipStyle`). The header is a direct, unclipped child of this box on purpose:
// `WidgetHeader`'s info bubble (`widget-header.module.css`'s `.infoBubble`, which is where the
// tooltip this file used to own now lives) opens downward past the header's own box, and must be
// able to overhang the card edge without being invisibly cut off.
const cardStyle: CSSProperties = {
  borderRadius: VX.radiusCard,
  boxShadow: VX.shadowCard,
  backgroundColor: VX.surface.panel,
}
const bodyClipStyle: CSSProperties = {
  // Clip the chart body to the card's bottom corners — a chart with its own square edges would
  // otherwise poke past the card's border-radius. Only the bottom corners: the body's top edge is
  // interior, sitting under the (unclipped) header. Trade-off: a chart tooltip that overflows the
  // card bounds is clipped too; the kinds keep tooltips inside the plot area, so this is fine in
  // practice — a consumer rendering an oversized/edge tooltip should portal it out of the card.
  borderBottomLeftRadius: VX.radiusCard,
  borderBottomRightRadius: VX.radiusCard,
  overflow: 'hidden',
  padding: '2px var(--mantine-spacing-sm, 0.8125rem) var(--mantine-spacing-xs, 0.6875rem)',
}
// Card inset = spacing xs (vertical) / sm (horizontal). The `--mantine-spacing-*` vars carry
// basalt's OWNED scale (theme.spacing.xs 0.6875rem / sm 0.8125rem); the rem fallbacks keep a
// Mantine-free `./charts`-only consumer (no MantineProvider vars) padded identically. No
// header/body divider — the title block and the plot read as one continuous surface; a rule here
// only doubled the card's shadow-embedded ring and made the header feel heavier.
const headerWrapStyle: CSSProperties = {
  padding: 'var(--mantine-spacing-xs, 0.6875rem) var(--mantine-spacing-sm, 0.8125rem) 4px',
}

/**
 * The three boxes a `ChartCard` paints, and therefore the slot set a consumer may class
 * (`SlotStylesProps`). `root` is the card itself (shadow, radius, panel background), `header` the
 * unclipped title band, `body` the clipped chart well. There is deliberately no slot for
 * `WidgetHeader`'s own internals — that component owns its own contract.
 */
export type ChartCardSlot = 'root' | 'header' | 'body'

export type ChartCardProps = BasaltProps &
  SlotStylesProps<ChartCardSlot> & {
    /** Optional — the header renders only when this or one of info/value/actions/icon/count is set. */
    title?: string
    /** Optional leading icon, forwarded to `WidgetHeader`. */
    icon?: ReactNode
    /** Optional muted line rendered below the title row — does NOT by itself trigger the header. */
    subtitle?: string
    /** Renders `WidgetHeader`'s info glyph beside the title — a `More information` button whose
     * bubble opens on hover, focus and click. Never part of the heading's accessible name. */
    info?: string
    /** Pre-formatted metric value, on the hero-metric row with `delta`. */
    value?: string
    /** Signed delta rendered via `DeltaBadge`, alongside `value`. */
    delta?: number
    /** Comparison timeframe forwarded to `DeltaBadge` (e.g. `MoM`). */
    deltaPeriod?: string
    /** Which sign reads as the good verdict on the delta chip — forwarded to `DeltaBadge`'s
     * `polarity`. Defaults to `'up-good'` (today's behaviour). */
    deltaPolarity?: DeltaPolarity
    /** Mono count tag after the title. */
    count?: number
    /** Right-aligned slot — carries `data-basalt-tier="widget"` (no `CtlSlot`; see module doc). */
    actions?: ReactNode
    children: ReactNode
  }

export function ChartCard({
  title,
  icon,
  subtitle,
  info,
  value,
  delta,
  deltaPeriod,
  deltaPolarity,
  count,
  actions,
  className,
  classNames,
  style,
  children,
}: ChartCardProps) {
  const hasHeader =
    title !== undefined ||
    info !== undefined ||
    value !== undefined ||
    actions !== undefined ||
    icon !== undefined ||
    count !== undefined

  return (
    <div className={cx(classNames?.root, className)} style={{ ...cardStyle, ...style }}>
      {hasHeader && (
        <div
          {...(classNames?.header !== undefined && { className: classNames.header })}
          style={headerWrapStyle}
        >
          <WidgetHeader
            tier="widget"
            title={title ?? ''}
            {...(icon !== undefined && { icon })}
            {...(subtitle !== undefined && { subtitle })}
            {...(info !== undefined && { info })}
            {...(value !== undefined && { value })}
            {...(delta !== undefined && { delta })}
            {...(deltaPeriod !== undefined && { deltaPeriod })}
            {...(deltaPolarity !== undefined && { deltaPolarity })}
            {...(count !== undefined && { count })}
            {...(actions !== undefined && {
              actions: <span data-basalt-tier="widget">{actions}</span>,
            })}
          />
        </div>
      )}
      <div
        {...(classNames?.body !== undefined && { className: classNames.body })}
        style={bodyClipStyle}
      >
        {children}
      </div>
    </div>
  )
}
