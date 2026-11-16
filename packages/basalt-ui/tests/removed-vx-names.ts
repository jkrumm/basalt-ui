/**
 * `--vx-*` names basalt once emitted and no longer does, with the replacement MIGRATING names
 * (`null`: deleted with no replacement). Hand-kept on purpose: it is history, it only grows, and
 * `scripts/gen-vx-names.test.ts` pins that none of these is live and every replacement is. Tests
 * derive their fixtures from it instead of keeping a second copy.
 */
const VX_FILL_FAMILIES = [
  'gray',
  'red',
  'pink',
  'grape',
  'violet',
  'indigo',
  'cyan',
  'teal',
  'green',
  'lime',
  'yellow',
  'orange',
] as const

export const REMOVED_VX_NAMES: Readonly<Record<string, string | null>> = {
  '--vx-space-touch-target': '--vx-hit',
  '--vx-space-touch-control-height': '--vx-hit',
  '--vx-space-app-header-mobile-actions-height': '--vx-space-sticky-header-clearance',
  '--vx-space-sticky-header-clearance-mobile': '--vx-space-sticky-header-clearance',
  '--vx-space-sidebar-brand-inset-top': null,
  // The 1.4.0 camelCase aliases, deleted from 2.x — each names its kebab canonical.
  '--vx-goodSolid': '--vx-good-solid',
  '--vx-badSolid': '--vx-bad-solid',
  '--vx-warnSolid': '--vx-warn-solid',
  '--vx-axisStroke': '--vx-axis-stroke',
  '--vx-dotStroke': '--vx-dot-stroke',
  '--vx-tooltipBg': '--vx-tooltip-bg',
  '--vx-tooltipText': '--vx-tooltip-text',
  '--vx-tooltipMuted': '--vx-tooltip-muted',
  '--vx-tooltipBorder': '--vx-tooltip-border',
  '--vx-tooltipShadow': '--vx-tooltip-shadow',
  '--vx-legendText': '--vx-legend-text',
  '--vx-accentHover': '--vx-accent-hover',
  '--vx-accentFill': '--vx-accent-fill',
  '--vx-accentFillHover': '--vx-accent-fill-hover',
  '--vx-onAccent': '--vx-on-accent',
  '--vx-surface-panelHover': '--vx-surface-panel-hover',
  '--vx-goodSoft': '--vx-good-soft',
  '--vx-goodRef': '--vx-good-ref',
  '--vx-badRef': '--vx-bad-ref',
  '--vx-warnRef': '--vx-warn-ref',
  ...Object.fromEntries(
    VX_FILL_FAMILIES.map((family) => [`--vx-fillHover-${family}`, `--vx-fill-hover-${family}`]),
  ),
}
