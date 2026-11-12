import type { Format } from '../format'
import type { BasaltMessages } from './index'

/**
 * The strings of `ControlView` and the kind renderers. Keys carry the area prefix (`controls.`),
 * which the coverage test holds:
 *
 * - `controls.local`: the word of the override cue, a neutral chip beside the label;
 * - `controls.overridesGlobal(value)`: the cue's title, `Overrides global: <value>`;
 * - `controls.useGlobal`: the reset button of a row (`row` and `inline` print its word);
 * - `controls.resetToGlobal(label)`: the reset button's accessible name on a compact surface;
 * - `controls.clear`: the clear button of a text or number control;
 * - `controls.any`: the placeholder of a control with no value to show.
 */
export type ControlsMessages = Record<
  'controls.local' | 'controls.useGlobal' | 'controls.clear' | 'controls.any',
  string
> &
  Record<'controls.overridesGlobal', (f: Format, value: string) => string> &
  Record<'controls.resetToGlobal', (f: Format, label: string) => string>

export const controls = {
  'controls.local': 'Local',
  'controls.useGlobal': 'Use global',
  'controls.clear': 'Clear',
  'controls.any': 'Any',
  'controls.overridesGlobal': (_f, value) => `Overrides global: ${value}`,
  'controls.resetToGlobal': (_f, label) => `Reset ${label} to global`,
} satisfies Partial<BasaltMessages>
