/**
 * `DeltaBadge` moved to `src/widget-header/` (docs/CONTROLS-SPEC.md §2.2) so `WidgetHeader` can
 * compose it Mantine-free. Re-exported here unchanged so this deep import path — and `StatCard`'s
 * own `./delta-badge` import — keep working without a wave-3 edit.
 */
export { DeltaBadge, type DeltaBadgeProps, type DeltaPolarity } from '../widget-header/delta-badge'
