/**
 * The enter and exit presets as plain `motion` props: `initial`, `animate`, `exit` and `transition`.
 * Pure data over the motion scale in `basalt-ui/tokens`; no `motion` import, so the tests and any
 * non-component caller read them without React.
 */
import {
  MOTION_DURATION,
  MOTION_EASE_ENTER,
  MOTION_EASE_EXIT,
  MOTION_ENTER_FROM,
  MOTION_SPRING,
  staggerDelay,
} from '../tokens/motion'
import type { MotionBezier, MotionPresetName, MotionSpring } from '../tokens/motion'

/** A tween: duration and delay in seconds. */
export type MotionTween = {
  readonly duration: number
  readonly ease?: MotionBezier
  readonly delay?: number
}

/** The values a preset animates. */
export type MotionPresetTarget = {
  readonly opacity: number
  readonly y?: number
  readonly scale?: number
  /** The exit's own timing, faster than the enter. */
  readonly transition?: MotionTween
}

/** Spread onto a `motion` element: `<motion.li {...preset} />`. */
export type MotionPresetProps = {
  /** `false` renders the end state at once, with no enter. */
  readonly initial: MotionPresetTarget | false
  readonly animate: MotionPresetTarget
  readonly exit: MotionPresetTarget
  readonly transition: MotionTween | (MotionSpring & { readonly delay?: number })
}

export type MotionPresetOptions = {
  /** The item's place in its list: its enter waits `staggerDelay(index)`. */
  readonly index?: number
  /** Collapse the preset: no movement, no scale, no fade, no delay. `useMotionPreset` sets it from the OS. */
  readonly reduced?: boolean
}

const EXIT: MotionTween = { duration: MOTION_DURATION.fast, ease: MOTION_EASE_EXIT }
const INSTANT: MotionTween = { duration: 0 }
const REST: MotionPresetTarget = { opacity: 1, y: 0, scale: 1 }

function from(name: MotionPresetName): { opacity: number; y: number; scale: number } {
  const { opacity, y, scale } = MOTION_ENTER_FROM[name]
  return { opacity, y, scale }
}

/**
 * A preset's props. `overlay` fades and scales in on the fast step; `item` fades and rises 4 px on the
 * base step, staggered by `index`; `card` fades, rises 8 px and scales on the standard spring. Every
 * exit fades on the fast step. With `reduced` the element shows its end state at once and leaves at once.
 *
 * @useWhen outside a component (a test, a list built in a loader), or where you read reduced motion yourself.
 * @neverWhen inside a component: `useMotionPreset` reads reduced motion for you.
 *
 * @example
 * <motion.li {...motionPreset('item', { index: i, reduced: prefersReduced })} />
 */
export function motionPreset(
  name: MotionPresetName,
  options: MotionPresetOptions = {},
): MotionPresetProps {
  if (options.reduced) {
    return {
      initial: false,
      animate: REST,
      exit: { opacity: 0, transition: INSTANT },
      transition: INSTANT,
    }
  }
  const enter = from(name)
  const exit: MotionPresetTarget =
    name === 'overlay'
      ? { opacity: 0, scale: enter.scale, transition: EXIT }
      : { opacity: 0, transition: EXIT }
  const delay = options.index === undefined ? 0 : staggerDelay(options.index)
  const transition =
    name === 'card'
      ? { ...MOTION_SPRING.standard, delay }
      : {
          duration: name === 'overlay' ? MOTION_DURATION.fast : MOTION_DURATION.base,
          ease: MOTION_EASE_ENTER,
          delay,
        }
  return { initial: enter, animate: REST, exit, transition }
}
