/**
 * Shared motion constants — the animation analog of the `--vx-*` token system. A component reaches
 * for these instead of inventing its own duration/easing/spring values, so animated chrome across
 * the framework feels like one identity. Pairs with `motion` (`motion/react`), the framework's one
 * animation dependency (bundled implementation detail, same precedent as `@visx/*`).
 *
 * Reduced-motion is read via `@mantine/hooks`' `useReducedMotion` (already a peer dep) at the call
 * site — this module stays framework-agnostic (no React) so it can be imported anywhere.
 */

/**
 * Seconds, for tween-based transitions. Capped at 0.3 (300ms) — basalt-mantine.md's interaction
 * doctrine holds "never above 300ms (feels laggy)" for Mantine's own `Transition`, and the same
 * ceiling applies here so the two animation mechanisms agree on pacing.
 */
export const MOTION_DURATION = {
  fast: 0.15,
  base: 0.25,
  slow: 0.3,
} as const

/** Standard ease curve for tween transitions (Material "standard" curve). */
export const MOTION_EASE_STANDARD = [0.4, 0, 0.2, 1] as const

/** Standard spring for interactive, physical-feeling transitions (icon morphs, reveals). */
export const MOTION_SPRING = { type: 'spring', stiffness: 400, damping: 32, mass: 0.9 } as const
