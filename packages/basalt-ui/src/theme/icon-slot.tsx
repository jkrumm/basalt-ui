/**
 * `IconSlot` — the ONE box every `icon` prop in the public API renders through
 * (`docs/CONTROLS-SPEC.md` §3).
 *
 * basalt ships no icon dependency, so every `icon` slot takes a `ReactNode` the consumer fills —
 * and a consumer's glyph arrives at whatever geometry its own icon set chose: `width="24"` from
 * Tabler's defaults, no `width` at all from a hand-written `<svg viewBox="0 0 20 20">`, a
 * `stroke-width` tuned for a 24px box, or an `<img>` off a sprite sheet. Passing that node straight
 * into Mantine's `leftSection` (which is a bare `flex` box with no size of its own) lets the CALLER
 * decide the height of a basalt control's row. That is the class of bug this component closes: the
 * icon's box is the framework's, and there is no prop on it.
 *
 * **Derived, not configured.** There is no `size` prop, on purpose — a size at a call site is the
 * same C5 violation a `size="xs"` on a Button is. The box reads `--vx-space-icon-size` (default
 * 16px, the control tier's mark), and the only thing entitled to set that var is a HOME's own CSS:
 * `WidgetHeader` sets it per `data-tier`, so a `tier="widget"` heading draws 14px icons and a
 * `tier="section"` heading draws 16px, with every call site unchanged.
 *
 * Mantine-free and dependency-free (one CSS module, one `<span>`), so `src/widget-header/**` — which
 * `ChartCard` composes from inside `src/charts/**` — can deep-import it without pulling
 * `@mantine/*` into the charts graph (`scripts/check-dist-layering.mjs`). Deep-import it as
 * `../theme/icon-slot`, never through the `./theme` barrel, for exactly that reason. INTERNAL: it is
 * not on any barrel. A consumer never needs it — passing `icon` IS the contract, and this is what
 * makes that contract hold.
 *
 * `data-basalt-icon` is the queryable marker, the same idiom `CtlSlot` uses for `data-basalt-tier`:
 * a CSS-module class name is a build-time hash, so it is not something a test — or a consumer
 * debugging a misaligned row — can select on.
 *
 * @example
 * // A control's icon slot — no size anywhere at the call site.
 * <Button leftSection={<IconSlot>{icon}</IconSlot>}>{label}</Button>
 */
import type { ReactNode } from 'react'
import classes from './icon-slot.module.css'

export type IconSlotProps = {
  readonly children: ReactNode
  /**
   * Composed ONTO the slot class, never in place of it — a home adds colour/state rules (the pill's
   * muted-then-ink icon, a header's faint one) and the geometry stays the slot's.
   */
  readonly className?: string
}

export function IconSlot({ children, className }: IconSlotProps): ReactNode {
  return (
    // `aria-hidden` unconditionally: an icon in a basalt control is DECORATIVE by construction —
    // every control that takes one also carries a label or an `aria-label`, so a named icon would
    // double the announced name. A caller wanting a meaningful graphic names the control, not this.
    <span
      className={className === undefined ? classes.slot : `${classes.slot} ${className}`}
      data-basalt-icon
      aria-hidden="true"
    >
      {children}
    </span>
  )
}
