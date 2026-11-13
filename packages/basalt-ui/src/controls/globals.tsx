/**
 * The glue between global controls and the shell header, internal to `./controls` (no export). A
 * global control is declared once, on the root route, and drawn once, in `AppShell globalControls`;
 * a page that adds its own `PageBar controls` never replaces it.
 *
 * `globalControls(specs)` returns the `ControlsSlot` the header renders. Both forms are in the
 * server HTML and the swap is CSS, never a JS media query:
 *
 * - from `md` up, one pill per spec (`ControlView` in the `pill` presentation, what `filterSlot`
 *   draws);
 * - below `md`, `FilterSet`'s own `Filters (n)` button on a container too narrow for its pill row,
 *   which opens the specs as row forms in a sheet. Count, `Reset all` and the cue are `FilterSet`'s,
 *   so they cannot drift from the page-level filter bar.
 *
 * A write to global G re-renders G's pill and the count, never a sibling pill or a card that is
 * bound to another field.
 */
import type { ReactElement } from 'react'
import type { ControlsSlot } from '../core/ports'
import { ControlView } from './control-view'
import type { AnySpec } from './filter-set-census'
import { SpecFilterSet } from './filter-set-spec'

/**
 * `FilterSet` picks pills or the `Filters (n)` button by its container's width, so the compact
 * wrapper has a fixed one narrower than its `@regular` threshold; a shrink-wrapped container would
 * measure its own content.
 */
function GlobalControls({ specs }: { specs: readonly AnySpec[] }): ReactElement {
  return (
    <>
      <div data-slot="global-pills" className="hidden min-w-0 items-center gap-2 md:flex">
        {specs.map((s) => (
          <ControlView key={s.handle.key} spec={s} />
        ))}
      </div>
      <div data-slot="global-compact" className="w-32 md:hidden">
        <SpecFilterSet specs={specs} />
      </div>
    </>
  )
}

/**
 * The header slot of the global controls: `AppShell globalControls={globalControls(specs)}`. Draws
 * nothing for no specs. Pass the list built once at module scope, not per render: the compact form
 * keeps one subscription per spec for the life of the mount.
 */
export function globalControls(specs: readonly AnySpec[]): ControlsSlot {
  return {
    kind: 'controls-slot',
    count: specs.length,
    render: () => (specs.length === 0 ? null : <GlobalControls specs={specs} />),
  }
}
