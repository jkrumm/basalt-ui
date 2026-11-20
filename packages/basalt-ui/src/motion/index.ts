/**
 * `basalt-ui/motion` — the enter and exit presets for `motion/react`, each collapsed under reduced
 * motion without the caller asking. The scale they are built from (durations, easings, springs and the
 * stagger step) is exported by `basalt-ui/tokens`, which needs no peer.
 */
import { useReducedMotionConfig } from 'motion/react'
import type { MotionPresetName } from '../tokens/motion'
import { motionPreset } from './presets'
import type { MotionPresetProps } from './presets'

export {
  motionPreset,
  type MotionPresetOptions,
  type MotionPresetProps,
  type MotionPresetTarget,
  type MotionTween,
} from './presets'
export type { MotionPresetName } from '../tokens/motion'

/**
 * A preset's `motion` props, collapsed when the user prefers reduced motion or an ancestor
 * `<MotionConfig reducedMotion="always">` asks for it: the element then shows its end state at once.
 *
 * @useWhen a popover or panel you build, a list item or a card enters and leaves; spread it on a `motion` element inside `AnimatePresence`. Guide: `docs/motion.md`.
 * @neverWhen a basalt part already animates (dialog, sheet, popover, menu, tooltip, toast); a page without React (use `animate-enter-*`).
 *
 * @example
 * const enter = useMotionPreset('item', { index })
 * return <motion.li {...enter}>{row.name}</motion.li>
 */
export function useMotionPreset(
  name: MotionPresetName,
  options: { readonly index?: number } = {},
): MotionPresetProps {
  const reduced = useReducedMotionConfig() === true
  return motionPreset(name, { ...options, reduced })
}
