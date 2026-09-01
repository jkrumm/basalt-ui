/**
 * `DeltaBadge` moved to `src/widget-header/` (docs/CONTROLS-SPEC.md §2.2) so `WidgetHeader` can
 * compose it Mantine-free. Re-exported here unchanged so this deep import path — and `StatCard`'s
 * own `./delta-badge` import — keep working without a wave-3 edit.
 *
 * `basalt-ui/widget-header` is canonical — this alias exists only so `basalt-ui/dashboard`-style
 * deep imports keep resolving; the root barrel (`src/index.ts`) sources `DeltaBadge` from
 * `../widget-header`, not from here.
 */
export { DeltaBadge, type DeltaBadgeProps, type DeltaPolarity } from '../widget-header/delta-badge'
