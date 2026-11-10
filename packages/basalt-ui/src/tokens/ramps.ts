/**
 * The 2.x `BP` families, carried hex-identical and kept INTERNAL (tokens-visual 3.8): no `--vx-*`
 * name, no package export, so `BP` and `p()` can go and no argo/rb series colour shifts. The data
 * form `{ hue: 'forest', light: 3, dark: 4 }` that `defineSeries` accepts resolves through
 * {@link rampPair}; `ramps.test.ts` pins every hex against `palette.ts`'s `BP` until that module
 * is deleted.
 */

// theme-allow-file raw-hex — the ramp data IS hex; series colour is app data resolved through here.

/** Five steps, darkest first for the colour families (a grey family runs dark-surface to light). */
export const RAMPS = {
  darkGray: ['#18181b', '#27272a', '#3f3f46', '#52525c', '#71717a'],
  gray: ['#52525c', '#71717a', '#a1a1aa', '#d4d4d8', '#e4e4e7'],
  lightGray: ['#d4d4d8', '#e4e4e7', '#e5e5e5', '#f4f4f5', '#fafafa'],
  blue: ['#0c4a6e', '#0369a1', '#0284c7', '#38bdf8', '#7dd3fc'],
  green: ['#165a36', '#1c6e42', '#238551', '#32a467', '#72ca9b'],
  orange: ['#77450d', '#935610', '#c87619', '#ec9a3c', '#fbb360'],
  red: ['#8e292c', '#ac2f33', '#cd4246', '#e76a6e', '#fa999c'],
  vermilion: ['#96290d', '#b83211', '#d33d17', '#eb6847', '#ff9980'],
  rose: ['#a82255', '#c22762', '#db2c6f', '#f5498b', '#ff66a1'],
  violet: ['#5c255c', '#7c327c', '#9d3f9d', '#bd6bbd', '#d69fd6'],
  indigo: ['#5642a6', '#634dbf', '#7961db', '#9881f3', '#bdadff'],
  cerulean: ['#0c5174', '#0f6894', '#147eb3', '#3fa6da', '#68c1ee'],
  turquoise: ['#004d46', '#007067', '#00a396', '#13c9ba', '#7ae1d8'],
  forest: ['#1d7324', '#238c2c', '#29a634', '#43bf4d', '#62d96b'],
  lime: ['#43501b', '#5a701a', '#8eb125', '#b6d94c', '#d4f17e'],
  gold: ['#5c4405', '#866103', '#d1980b', '#f0b726', '#fbd065'],
  sepia: ['#5e4123', '#7a542e', '#946638', '#af855a', '#d0b090'],
} as const

export type RampHue = keyof typeof RAMPS

/** A step index into a five-step ramp. */
export type RampStep = 0 | 1 | 2 | 3 | 4

/** 2.x `p()`'s defaults: shade 3 (index 2) on light, shade 4 (index 3) on dark. */
export const DEFAULT_RAMP_STEPS = { light: 2, dark: 3 } as const satisfies Record<
  'light' | 'dark',
  RampStep
>

/** The `{ light, dark }` hex pair a series entry `{ hue, light?, dark? }` resolves to. */
export function rampPair(
  hue: RampHue,
  steps: { light?: RampStep; dark?: RampStep } = {},
): { light: string; dark: string } {
  const ramp = RAMPS[hue]
  return {
    light: ramp[steps.light ?? DEFAULT_RAMP_STEPS.light],
    dark: ramp[steps.dark ?? DEFAULT_RAMP_STEPS.dark],
  }
}
