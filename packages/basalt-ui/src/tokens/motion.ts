/**
 * The motion scale: the one source of every `--basalt-dur-*`, `--basalt-ease-*`, `--basalt-spring*` and
 * `--basalt-stagger` value. `table.ts` reads its motion rows from here, so the CSS variables, the
 * Tailwind classes (`duration-fast`, `ease-enter`, `animate-enter-*`) and these constants cannot drift.
 *
 * Units follow the consumer: the constants are in seconds and bezier arrays, the units `motion` takes;
 * the CSS rows are milliseconds and `cubic-bezier()`. Under `prefers-reduced-motion: reduce` the CSS
 * variables are `0ms` (`tokens.css`), and `basalt-ui/motion` presets collapse the same way.
 *
 * Pure data: no React, no `motion` import, so an Astro script reads it with no peer installed.
 */

/** Durations in milliseconds, the CSS side of {@link MOTION_DURATION}. */
export const MOTION_DURATION_MS = { fast: 150, base: 250, slow: 400 } as const

/**
 * The duration scale in seconds: `fast` for hover, press and small overlays, `base` for enter, exit
 * and reveal, `slow` for large surfaces (sheet, dock, peek). Same values as `--basalt-dur-*`.
 *
 * @useWhen a `motion` transition or a script needs a duration; the guide is `docs/motion.md`.
 * @neverWhen CSS or Tailwind can time it: use `duration-fast` or `var(--basalt-dur-fast)`, which collapse under reduced motion on their own.
 *
 * @example
 * <motion.div animate={{ opacity: 1 }} transition={{ duration: MOTION_DURATION.base, ease: MOTION_EASE_ENTER }} />
 */
export const MOTION_DURATION = {
  fast: MOTION_DURATION_MS.fast / 1000,
  base: MOTION_DURATION_MS.base / 1000,
  slow: MOTION_DURATION_MS.slow / 1000,
} as const

/** A cubic bezier as `motion` takes it: `[x1, y1, x2, y2]`. */
export type MotionBezier = readonly [number, number, number, number]

/**
 * The standard curve for a change in place (`--basalt-ease`, Tailwind `ease-standard`).
 *
 * @useWhen a `motion` transition changes an element that stays on screen (a width, a color, a position).
 * @neverWhen the element arrives or leaves: use `MOTION_EASE_ENTER` or `MOTION_EASE_EXIT`.
 */
export const MOTION_EASE_STANDARD: MotionBezier = [0.4, 0, 0.2, 1]
/**
 * Decelerate: an element arriving (`--basalt-ease-enter`, Tailwind `ease-enter`).
 *
 * @useWhen a hand-built `motion` enter that no preset covers.
 * @neverWhen an overlay, list item or card enters: `useMotionPreset` already uses it.
 */
export const MOTION_EASE_ENTER: MotionBezier = [0, 0, 0.2, 1]
/**
 * Accelerate: an element leaving (`--basalt-ease-exit`, Tailwind `ease-exit`).
 *
 * @useWhen a hand-built `motion` exit that no preset covers.
 * @neverWhen an overlay, list item or card leaves: `useMotionPreset` already uses it.
 */
export const MOTION_EASE_EXIT: MotionBezier = [0.4, 0, 1, 1]

/** `cubic-bezier(…)` for a bezier array. */
export const cubicBezier = (b: MotionBezier): string => `cubic-bezier(${b.join(', ')})`

/** A `motion` spring transition: `visualDuration` in seconds, `bounce` 0 (none) to 1. */
export type MotionSpring = {
  readonly type: 'spring'
  readonly visualDuration: number
  readonly bounce: number
}

/**
 * The two springs. `standard` settles with no overshoot; `bouncy` overshoots by about 3 % (a card that
 * lands, a chip that pops). As CSS they are `--basalt-spring` and `--basalt-spring-bouncy`.
 *
 * @useWhen a `motion` element moves or resizes in a way the user caused (`layout`, a drag release, a dealt card).
 * @neverWhen data arrives or a list fills: a tween on the scale reads calmer; and never `bouncy` for anything the user did not cause.
 *
 * @example
 * <motion.div layout transition={MOTION_SPRING.standard} />
 */
export const MOTION_SPRING = {
  standard: { type: 'spring', visualDuration: 0.25, bounce: 0 },
  bouncy: { type: 'spring', visualDuration: 0.4, bounce: 0.25 },
} as const satisfies Record<string, MotionSpring>

/**
 * The CSS form of each spring: the settle duration and the `linear()` curve `motion`'s own spring
 * generator prints for the same parameters (`spring({ visualDuration, bounce }).toString()`).
 * `motion.test.ts` regenerates both, so the CSS spring and the JS spring are one curve.
 */
export const MOTION_SPRING_CSS = {
  standard:
    '500ms linear(0, 0.1402, 0.3764, 0.584, 0.7361, 0.838, 0.9029, 0.9428, 0.9668, 0.9809, 0.9892, 0.9939, 0.9966, 0.9981, 0.9989, 0.9994, 1)',
  bouncy:
    '700ms linear(0, 0.0702, 0.226, 0.4079, 0.5805, 0.7263, 0.8392, 0.92, 0.9735, 1.0055, 1.0219, 1.0279, 1.0276, 1.0239, 1.0189, 1.0138, 1.0093, 1.0057, 1.0031, 1.0013, 1.0001, 0.9995, 1)',
} as const satisfies Record<keyof typeof MOTION_SPRING, string>

/**
 * The delay between two items of a staggered list, in seconds (`--basalt-stagger`, 30 ms).
 *
 * @useWhen reading the step itself; a delay for an index is `staggerDelay(index)`.
 * @neverWhen multiplying it by an index: `staggerDelay` also caps the delay at the slow step.
 */
export const MOTION_STAGGER = 0.03

/**
 * The enter delay of the item at `index`, in seconds. It grows by {@link MOTION_STAGGER} per item and
 * stops at `MOTION_DURATION.slow`, so a long list does not keep its tail waiting.
 *
 * @useWhen a hand-built `motion` list enter staggers its items.
 * @neverWhen the item uses `useMotionPreset('item', { index })`, which applies it; or in CSS, where `stagger` with `--i` does.
 *
 * @example
 * items.map((item, i) => <motion.li key={item.id} transition={{ delay: staggerDelay(i) }} />)
 */
export function staggerDelay(index: number): number {
  const steps = Math.max(0, Math.floor(index))
  return Math.min(Math.round(steps * MOTION_STAGGER * 1000) / 1000, MOTION_DURATION.slow)
}

/** Where each enter preset starts: opacity, rise in px, scale. Read by the CSS keyframes and `basalt-ui/motion`. */
export const MOTION_ENTER_FROM = {
  overlay: { opacity: 0, y: 0, scale: 0.96 },
  item: { opacity: 0, y: 4, scale: 1 },
  card: { opacity: 0, y: 8, scale: 0.98 },
} as const

/** The three enter and exit presets. */
export type MotionPresetName = keyof typeof MOTION_ENTER_FROM
