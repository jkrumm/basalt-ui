/** `basalt-ui/testing`: tooling for test files, never in an app bundle. Optional peer: `@axe-core/playwright` (`quality.axe` only). */

export { installDomShims } from './dom-shims'
export { settled } from './settled'
export { SLOTS } from './slots'
export { expectShellInvariants } from './shell-invariants'
export { quality } from './quality'
export type {
  AxeOptions,
  AxeReport,
  OverflowOptions,
  OverlayKind,
  PageLike,
  Scheme as QualityScheme,
  WalkOptions,
} from './quality'
