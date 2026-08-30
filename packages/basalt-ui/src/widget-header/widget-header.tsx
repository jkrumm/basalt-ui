/**
 * WidgetHeader — the one heading primitive behind every section, card and table title
 * (docs/CONTROLS-SPEC.md §2.2, law C8). Plain elements + one CSS module, no `@mantine/*` import
 * anywhere in this folder, so it can be composed from inside `charts/` without tripping
 * `basalt/token-layer-boundary` or `check-dist-layering.mjs`.
 *
 * `tier: 'section'` renders an `<h2>` at the taller section-header height; `tier: 'widget'`
 * renders an `<h3>` at the tighter, display-only icon-tier height — both share the same head-font
 * 88%/550 title treatment. `tier: 'group'` also renders an `<h3>`, but at the quietest rank on the
 * page: a mono, uppercase, faint micro-label — an inspector/aside group heading, one step below a
 * `widget` tier and resolved automatically by `Section` when it renders on the `PageAside` panel
 * surface (never a call-site prop). The title row holds title/icon/info/count/actions only; `value`
 * + `delta` render on their own hero-metric row directly beneath it, for every tier — never inline
 * with the title. `StatCard`, `ChartCard`, `Section`, `SettingsSection`/`DangerZone` and
 * `BasaltDataTable` each compose this and render nothing else above their body (wave 3,
 * docs/CONTROLS-SPEC.md §2.2's composer table).
 *
 * @example
 * import { WidgetHeader } from 'basalt-ui'
 *
 * <WidgetHeader
 *   tier="widget"
 *   title="Active Users"
 *   value="12,483"
 *   delta={4.2}
 *   deltaPeriod="MoM"
 *   actions={<ActionIcon variant="subtle"><IconDots /></ActionIcon>}
 * />
 */
import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { IconSlot } from '../theme/icon-slot'
import { DeltaBadge } from './delta-badge'
import type { DeltaPolarity } from './delta-badge'
import classes from './widget-header.module.css'

export type WidgetHeaderTier = 'section' | 'widget' | 'group'

export type WidgetHeaderProps = {
  /** `section` renders an `<h2>` at the section-header height; `widget` renders an `<h3>` at the
   * tighter icon-tier height, display-only; `group` also renders an `<h3>` but as the quietest
   * heading rank on the page — mono micro uppercase faint, one step below `widget` — for an
   * inspector/aside group label. `Section` resolves `group` automatically from the enclosing filter
   * surface; it is never a call-site prop. */
  tier: WidgetHeaderTier
  /** Head-font title (88% stretch, weight 550). */
  title: string
  /** Optional leading icon, rendered before the title. Decorative — hidden from assistive tech. */
  icon?: ReactNode
  /** Optional muted line rendered below the title row. */
  subtitle?: string
  /**
   * Renders an info glyph BESIDE the heading (never inside it — this text would otherwise become
   * part of the heading's accessible name, and an `info` paragraph read out in every headings list
   * is what that cost). The glyph is named `More information`; the text itself reaches assistive
   * tech through `aria-describedby` on a `role="tooltip"` bubble that opens on hover, focus and
   * click — so a keyboard user gets it too. Mantine-free: a plain state bubble, not a Tooltip.
   */
  info?: string
  /** Pre-formatted metric value (mono, hero size). Renders on its own row with `delta`, directly
   * under the title row — never inline with the title. */
  value?: string
  /**
   * The value's unit, rendered immediately after it on the hero row: muted, mono, `--vx-text-sm`.
   *
   * It exists because `value` is a pre-formatted `string` and a KPI's unit is not part of the
   * number: `412` and `TSS` are two facts at two weights, and jamming them into one string paints
   * the unit at the hero's 24px — which reads as a second numeral. `subtitle` was the only place a
   * unit could go before this, and a unit on its own line under the value is a different claim (the
   * BASIS: `7-day rolling`), so cards using both had to pick one.
   *
   * Never a substitute for the number's own formatting: a thousands separator, a currency symbol or
   * a `%` belong in `value`, where they are part of how the numeral reads.
   */
  unit?: string
  /** Signed delta rendered via `DeltaBadge`, on the same hero-metric row as `value`. */
  delta?: number
  /** Comparison timeframe forwarded to `DeltaBadge` (e.g. `MoM`). */
  deltaPeriod?: string
  /** Which sign reads as the good verdict — forwarded to `DeltaBadge`'s `polarity`. Defaults to
   * `'up-good'` (today's behaviour). See {@link DeltaPolarity}. */
  deltaPolarity?: DeltaPolarity
  /**
   * Formats `delta` into the chip's label — forwarded to `DeltaBadge`'s `format`. Defaults to
   * `${Math.abs(delta).toFixed(1)}%`.
   *
   * It exists because not every delta is a percentage: a pace card's trend is `0:12 /km` and a
   * throughput card's is `0.3 km/h`, and the default printed both as a percent — a wrong unit on a
   * KPI, which is worse than no chip. A FUNCTION rather than a label string, so the number stays the
   * number: `delta` still drives the tone and the glyph, and there is exactly one place the sign is
   * decided.
   *
   * The value arrives SIGNED, so a formatter that wants to print the sign itself (`−0:12 /km`) can —
   * pair it with `deltaGlyph={false}` so the ▼ does not say the same thing twice.
   */
  deltaFormat?: (delta: number) => string
  /** Render `DeltaBadge`'s ▲/▼ glyph. Defaults to `true`; a zero delta never shows one. Pass
   * `false` when `deltaFormat` prints the sign itself. */
  deltaGlyph?: boolean
  /** Trend visual slot, rendered below the metric row. Carries `data-placement="right"` so a
   * wave-3 composer's `bleed` layout can select it. */
  sparkline?: ReactNode
  /** Mono count tag rendered after the title (C11 — every table/list states its count). `0` is a
   * real count and renders, distinct from omitting the prop entirely. */
  count?: number
  /** Right-aligned slot (`margin-inline-start: auto`) — the C1/C5 home for header actions. */
  actions?: ReactNode
}

/**
 * The info affordance. A `title` attribute alone was never enough — it renders on hover only, so a
 * keyboard user focusing the glyph saw nothing at all. This is the bubble `ChartCard` used to own
 * before it composed `WidgetHeader`, moved down here so every tier gets the same behaviour:
 * opens on hover/focus/click, closes on leave/blur/Escape/outside pointer-down, and is wired to the
 * trigger with `aria-describedby` only while open.
 *
 * Exported from the MODULE but deliberately not from `src/widget-header/index.ts`: it is not a
 * public primitive, it is the one info affordance basalt draws, and `controls/panel-row.tsx`
 * composes it so an inspector row's `hint` is the same glyph, bubble and keyboard behaviour a
 * `WidgetHeader`'s `info` is — not a second one that drifts.
 */
export function InfoGlyph({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const tipId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (triggerRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  return (
    <span className={classes.info}>
      <button
        ref={triggerRef}
        type="button"
        className={classes.infoTrigger}
        // The GLYPH is named, not the text — `text` reaches AT through `aria-describedby` below, so
        // it never lands in the heading's or the button's accessible name.
        aria-label="More information"
        aria-describedby={open ? tipId : undefined}
        data-open={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
        }}
      >
        <svg width={11} height={11} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm0 5a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1z" />
        </svg>
      </button>
      {open && (
        <span id={tipId} role="tooltip" className={classes.infoBubble}>
          {text}
        </span>
      )}
    </span>
  )
}

export function WidgetHeader({
  tier,
  title,
  icon,
  subtitle,
  info,
  value,
  unit,
  delta,
  deltaPeriod,
  deltaPolarity,
  deltaFormat,
  deltaGlyph,
  sparkline,
  count,
  actions,
}: WidgetHeaderProps) {
  const Heading = tier === 'section' ? 'h2' : 'h3'

  return (
    <div className={classes.root} data-tier={tier}>
      <div className={classes.titleRow}>
        <Heading className={classes.heading}>
          {/* `IconSlot` owns the box; the TIER owns its size, through the
              `--vx-space-icon-size` this module sets per `data-tier`. So a `tier="widget"`
              heading draws 14px and a `tier="section"` heading 16px with no prop and no
              per-component `> svg` rule — see `theme/icon-slot.tsx`. */}
          {icon !== undefined && <IconSlot className={classes.icon}>{icon}</IconSlot>}
          <span className={classes.titleText}>{title}</span>
        </Heading>
        {/* OUTSIDE the heading on purpose — see `info`'s own doc. */}
        {info !== undefined && <InfoGlyph text={info} />}
        {count !== undefined && <span className={classes.count}>{count}</span>}
        {actions !== undefined && <span className={classes.actions}>{actions}</span>}
      </div>
      {(value !== undefined || delta !== undefined) && (
        <div className={classes.metrics}>
          {value !== undefined && <span className={classes.value}>{value}</span>}
          {/* Gated on `value`, not on itself: a unit with nothing to qualify is a stray word, and a
              card that lost its number must not keep printing `TSS` beside the empty space. */}
          {value !== undefined && unit !== undefined && (
            <span className={classes.unit}>{unit}</span>
          )}
          {delta !== undefined && (
            <DeltaBadge
              value={delta}
              period={deltaPeriod}
              {...(deltaPolarity !== undefined && { polarity: deltaPolarity })}
              {...(deltaFormat !== undefined && { format: deltaFormat })}
              {...(deltaGlyph !== undefined && { withGlyph: deltaGlyph })}
            />
          )}
        </div>
      )}
      {subtitle !== undefined && <span className={classes.subtitle}>{subtitle}</span>}
      {sparkline !== undefined && (
        <div className={classes.sparkline} data-placement="right">
          {sparkline}
        </div>
      )}
    </div>
  )
}
