/**
 * Compile-time regression guard for the exact-keyed token-factory contract.
 *
 * The headline of the token system is "pass a literal series map, get an exact-keyed token map —
 * a renamed or removed key fails tsc." Nothing at runtime locks that: if `groupTokens` /
 * `seriesTokens` ever re-widen their return to `Record<string, string>`, every runtime gate
 * (lint, test, pack-test) still passes green. This file turns that regression into a *type* error
 * caught by `bun run typecheck`: the `@ts-expect-error` below only stays valid while `demoColors`
 * is exact-keyed. If the map re-widens, accessing an unknown key stops erroring, the directive
 * becomes unused, and tsc fails with TS2578.
 *
 * Never called — `tsc` typechecks the file regardless; the bundler tree-shakes it away.
 */
import { demoColors } from './series'

export function assertDemoColorsExactKeyed(): string {
  // @ts-expect-error 'nope' is not a key of the exact-keyed demo series map
  return demoColors.nope
}
