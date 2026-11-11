/**
 * The JSON token emitter (static-framework-free section 3 row 4, amendment A1): literal hex has ONE
 * generated source. Server HTML, email, web manifests and `theme-color` metas cannot load `var()`,
 * so they read this file instead of keeping a hand copy of the palette.
 *
 * It reads the same resolved table as `emitTokensCss` (`resolveTokens`, values from `deriveV3` in
 * HCT, hex out), so a JSON value and the CSS value of the same role cannot disagree, and it is gated
 * the same way: a config that fails a gate emits nothing.
 *
 * Opaque roles only: surfaces, inks, brand, status, `line`, `dim-bar`, `chart-N`, `seq-N`. The alpha
 * mixes (`hairline`, `hover`, `selected`, `scrim`, `input`, `grid`, `crosshair`, `-tint`) are ABSENT,
 * not flattened: a flattened mix is one surface's guess at a value that depends on what it sits on.
 * The test is "the table value is a `{ light, dark }` pair of `#rrggbb`", so a role added later is
 * exported or kept out by what it is, never by a list that can drift.
 *
 * Pure and deterministic: no clock, no filesystem; key order is table order, so two runs are
 * byte-equal.
 */
import { DEFAULT_DERIVE_V3_CONFIG, deriveV3 } from './derive'
import type { EmitOptions } from './emit'
import { assertGates } from './gates'
import { isPair, resolveTokens } from './table'

type Scheme = 'light' | 'dark'

/** The file's shape: header fields stand in for the two comment lines of a generated stylesheet. */
export type JsonTokens = {
  $generated: string
  $provenance: string
  /** `--vx-contract`: the token contract the roles belong to. */
  contract: 3
  schemes: Record<Scheme, Record<string, string>>
}

const HEX = /^#[0-9a-f]{6}$/i

/** The marker words of the stylesheet header, in a field: JSON has no comment line to point at. */
const GENERATED = '@generated basalt-ui — do not edit; regenerate with the command in $provenance'

/**
 * The opaque roles for a config, per scheme.
 * @throws GateError when the config fails a gate; the emitter never ships a silent bad accent.
 */
export function emitJson(options: EmitOptions): JsonTokens {
  const derived = deriveV3({ ...DEFAULT_DERIVE_V3_CONFIG, ...options.config })
  assertGates(derived)
  const schemes: JsonTokens['schemes'] = { light: {}, dark: {} }
  for (const { def, value } of resolveTokens(undefined, derived)) {
    if (!isPair(value) || !HEX.test(value.light) || !HEX.test(value.dark)) continue
    schemes.light[def.name] = value.light
    schemes.dark[def.name] = value.dark
  }
  return {
    $generated: GENERATED,
    $provenance: `basalt-ui ${options.version} — \`${options.command ?? 'basalt-ui tokens:css --format json'}\``,
    contract: 3,
    schemes,
  }
}

/** The file as written: two-space JSON and a trailing newline, the form `--check` compares. */
export function emitJsonText(options: EmitOptions): string {
  return `${JSON.stringify(emitJson(options), null, 2)}\n`
}
