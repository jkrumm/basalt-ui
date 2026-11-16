/**
 * `--basalt-*` names basalt once emitted and no longer does, with the replacement MIGRATING names
 * (`null`: deleted with no replacement). Hand-kept on purpose: it is history, it only grows, and
 * `scripts/gen-basalt-names.test.ts` pins that none of these is live and every replacement is. Tests
 * derive their fixtures from it instead of keeping a second copy.
 */
const BASALT_FILL_FAMILIES = [
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

export const REMOVED_BASALT_NAMES: Readonly<Record<string, string | null>> = {
  '--basalt-space-touch-target': '--basalt-hit',
  '--basalt-space-touch-control-height': '--basalt-hit',
  '--basalt-space-app-header-mobile-actions-height': '--basalt-space-sticky-header-clearance',
  '--basalt-space-sticky-header-clearance-mobile': '--basalt-space-sticky-header-clearance',
  '--basalt-space-sidebar-brand-inset-top': null,
  // The 1.4.0 camelCase aliases, deleted from 2.x — each names its kebab canonical.
  '--basalt-goodSolid': '--basalt-good-solid',
  '--basalt-badSolid': '--basalt-bad-solid',
  '--basalt-warnSolid': '--basalt-warn-solid',
  '--basalt-axisStroke': '--basalt-axis-stroke',
  '--basalt-dotStroke': '--basalt-dot-stroke',
  '--basalt-tooltipBg': '--basalt-tooltip-bg',
  '--basalt-tooltipText': '--basalt-tooltip-text',
  '--basalt-tooltipMuted': '--basalt-tooltip-muted',
  '--basalt-tooltipBorder': '--basalt-tooltip-border',
  '--basalt-tooltipShadow': '--basalt-tooltip-shadow',
  '--basalt-legendText': '--basalt-legend-text',
  '--basalt-accentHover': '--basalt-accent-hover',
  '--basalt-accentFill': '--basalt-accent-fill',
  '--basalt-accentFillHover': '--basalt-accent-fill-hover',
  '--basalt-onAccent': '--basalt-on-accent',
  '--basalt-surface-panelHover': '--basalt-surface-panel-hover',
  '--basalt-goodSoft': '--basalt-good-soft',
  '--basalt-goodRef': '--basalt-good-ref',
  '--basalt-badRef': '--basalt-bad-ref',
  '--basalt-warnRef': '--basalt-warn-ref',
  ...Object.fromEntries(
    BASALT_FILL_FAMILIES.map((family) => [
      `--basalt-fillHover-${family}`,
      `--basalt-fill-hover-${family}`,
    ]),
  ),
}
