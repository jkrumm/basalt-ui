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
 * - `controls.any`: the placeholder of a control with no value to show;
 * - `controls.back`, `controls.continue`: the back button and the primary of a wizard step;
 * - `controls.review`, `controls.reviewHelp`: the last step of a wizard and its help line;
 * - `controls.edit`, `controls.editField(label)`: a review row's jump back, its word and its name;
 * - `controls.preview`: the name of a wizard's preview pane.
 */
export type ControlsMessages = Record<
  | 'controls.local'
  | 'controls.useGlobal'
  | 'controls.clear'
  | 'controls.any'
  | 'controls.back'
  | 'controls.continue'
  | 'controls.review'
  | 'controls.reviewHelp'
  | 'controls.edit'
  | 'controls.preview',
  string
> &
  Record<'controls.overridesGlobal', (f: Format, value: string) => string> &
  Record<'controls.resetToGlobal' | 'controls.editField', (f: Format, label: string) => string>

export const controls = {
  'controls.local': 'Local',
  'controls.useGlobal': 'Use global',
  'controls.clear': 'Clear',
  'controls.any': 'Any',
  'controls.back': 'Back',
  'controls.continue': 'Continue',
  'controls.review': 'Review',
  'controls.reviewHelp': 'Check every answer, or go back to change one.',
  'controls.edit': 'Edit',
  'controls.preview': 'Preview',
  'controls.editField': (_f, label) => `Edit ${label}`,
  'controls.overridesGlobal': (_f, value) => `Overrides global: ${value}`,
  'controls.resetToGlobal': (_f, label) => `Reset ${label} to global`,
} satisfies Partial<BasaltMessages>
