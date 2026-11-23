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
 * - `controls.preview`: the name of a wizard's preview pane;
 * - `controls.appearance.*`: the rows, options and reset of `AppearanceSwitcher`, and
 *   `controls.appearance.accentName(name)` an accent swatch's name.
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
  | 'controls.preview'
  | 'controls.appearance.scheme'
  | 'controls.appearance.light'
  | 'controls.appearance.dark'
  | 'controls.appearance.system'
  | 'controls.appearance.accent'
  | 'controls.appearance.density'
  | 'controls.appearance.dense'
  | 'controls.appearance.denseHelp'
  | 'controls.appearance.normal'
  | 'controls.appearance.normalHelp'
  | 'controls.appearance.comfortable'
  | 'controls.appearance.comfortableHelp'
  | 'controls.appearance.frame'
  | 'controls.appearance.panel'
  | 'controls.appearance.panelHelp'
  | 'controls.appearance.flush'
  | 'controls.appearance.flushHelp'
  | 'controls.appearance.reset',
  string
> &
  Record<'controls.appearance.accentName', (f: Format, name: string) => string> &
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
  'controls.appearance.scheme': 'Theme',
  'controls.appearance.light': 'Light',
  'controls.appearance.dark': 'Dark',
  'controls.appearance.system': 'System',
  'controls.appearance.accent': 'Accent colour',
  'controls.appearance.density': 'Density',
  'controls.appearance.dense': 'Compact',
  'controls.appearance.denseHelp': '28 px controls, the most rows.',
  'controls.appearance.normal': 'Regular',
  'controls.appearance.normalHelp': '32 px controls.',
  'controls.appearance.comfortable': 'Comfortable',
  'controls.appearance.comfortableHelp': '40 px controls, room to tap.',
  'controls.appearance.frame': 'Layout',
  'controls.appearance.panel': 'Inset',
  'controls.appearance.panelHelp': 'The page sits on a rounded panel.',
  'controls.appearance.flush': 'Edge to edge',
  'controls.appearance.flushHelp': 'The page meets the window. Phones always do.',
  'controls.appearance.reset': 'Reset appearance',
  'controls.appearance.accentName': (_f, name) => name.charAt(0).toUpperCase() + name.slice(1),
} satisfies Partial<BasaltMessages>
