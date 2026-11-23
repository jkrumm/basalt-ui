/**
 * `basalt-ui/tokens` — the token layer's public surface. The implementation lives in
 * `./core` (internal: the provider, CLI and theme import it from there); only what a consumer
 * names is re-exported here.
 */
export type { AccentName } from './accents'
export { BP, p } from './palette'
export { CONTAINER_CLASSES, CONTAINER_GRID_BREAKPOINTS, CONTAINER_KEYS } from './size-classes'
export {
  MOTION_DURATION,
  MOTION_EASE_ENTER,
  MOTION_EASE_EXIT,
  MOTION_EASE_STANDARD,
  MOTION_SPRING,
  MOTION_STAGGER,
  staggerDelay,
  type MotionBezier,
  type MotionPresetName,
  type MotionSpring,
} from './motion'
export {
  alpha,
  buildPaletteCss,
  defineSeries,
  groupTokens,
  seriesTokens,
  BASALT,
  type ColorPair,
  type SeriesGroup,
  type SeriesMap,
} from './core'
