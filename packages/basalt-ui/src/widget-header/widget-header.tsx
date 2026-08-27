/**
 * WidgetHeader — the one heading primitive behind every section, card and table title
 * (docs/CONTROLS-SPEC.md §2.2, law C8). Plain elements + one CSS module, no `@mantine/*` import
 * anywhere in this folder, so it can be composed from inside `charts/` without tripping
 * `basalt/token-layer-boundary` or `check-dist-layering.mjs`.
 *
 * `tier: 'section'` renders an `<h2>` at the taller section-header height; `tier: 'widget'`
 * renders an `<h3>` at the tighter, display-only icon-tier height — both share the same head-font
 * 88%/550 title treatment. The title row holds title/icon/info/count/actions only; `value` +
 * `delta` render on their own hero-metric row directly beneath it, for both tiers — never inline
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
import type { ReactNode } from 'react'
import { DeltaBadge } from './delta-badge'
import classes from './widget-header.module.css'

export type WidgetHeaderProps = {
  /** `section` renders an `<h2>` at the section-header height; `widget` renders an `<h3>` at the
   * tighter icon-tier height, display-only. */
  tier: 'section' | 'widget'
  /** Head-font title (88% stretch, weight 550). */
  title: string
  /** Optional leading icon, rendered before the title. Decorative — hidden from assistive tech. */
  icon?: ReactNode
  /** Optional muted line rendered below the title row. */
  subtitle?: string
  /** Renders an info glyph carrying this text as its accessible name (`aria-label`) and native
   * `title` tooltip — no Mantine Tooltip. */
  info?: string
  /** Pre-formatted metric value (mono, hero size). Renders on its own row with `delta`, directly
   * under the title row — never inline with the title. */
  value?: string
  /** Signed delta rendered via `DeltaBadge`, on the same hero-metric row as `value`. */
  delta?: number
  /** Comparison timeframe forwarded to `DeltaBadge` (e.g. `MoM`). */
  deltaPeriod?: string
  /** Trend visual slot, rendered below the metric row. Carries `data-placement="right"` so a
   * wave-3 composer's `bleed` layout can select it. */
  sparkline?: ReactNode
  /** Mono count tag rendered after the title (C11 — every table/list states its count). `0` is a
   * real count and renders, distinct from omitting the prop entirely. */
  count?: number
  /** Right-aligned slot (`margin-inline-start: auto`) — the C1/C5 home for header actions. */
  actions?: ReactNode
}

function InfoGlyph({ text }: { text: string }) {
  return (
    <span className={classes.info}>
      <button type="button" className={classes.infoTrigger} title={text} aria-label={text}>
        <svg width={11} height={11} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm0 5a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0v-7a1 1 0 0 1 1-1z" />
        </svg>
      </button>
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
  delta,
  deltaPeriod,
  sparkline,
  count,
  actions,
}: WidgetHeaderProps) {
  const Heading = tier === 'section' ? 'h2' : 'h3'

  return (
    <div className={classes.root} data-tier={tier}>
      <div className={classes.titleRow}>
        <Heading className={classes.heading}>
          {icon !== undefined && (
            <span className={classes.icon} aria-hidden="true">
              {icon}
            </span>
          )}
          <span className={classes.titleText}>{title}</span>
          {info !== undefined && <InfoGlyph text={info} />}
        </Heading>
        {count !== undefined && <span className={classes.count}>{count}</span>}
        {actions !== undefined && <span className={classes.actions}>{actions}</span>}
      </div>
      {(value !== undefined || delta !== undefined) && (
        <div className={classes.metrics}>
          {value !== undefined && <span className={classes.value}>{value}</span>}
          {delta !== undefined && <DeltaBadge value={delta} period={deltaPeriod} />}
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
