/**
 * `basalt-ui/controls` — the control tier (`docs/v3/concepts/controls-url-state.md`).
 *
 * Every control here renders at the `ctl` tier from the home that hosts it and owns its own
 * desktop/mobile swap in CSS (law C9).
 */

// Filters are data: `spec(handle, label, options?)` entries a `FilterSet` or a `ControlHome` renders.
export { FilterSet } from './filter-set'
export { ViewTabs } from './view-tabs'

// v3 forms: `FormField` carries label, description and error by construction; `FormRow` lays fields out by container tier.
export { FormField } from './form-field'
export type { FormFieldProps } from './form-field'
export { FormRow } from './form-row'
export type { FormRowProps } from './form-row'
export { FormSection } from './form-section'
export type { FormSectionProps } from './form-section'
export type { FormFieldLayout } from './form-field'

// A multi-step form's step list: the current step marked, done steps reachable, folded when narrow.
export { Stepper } from './stepper'
export type { StepperProps, StepperStep } from './stepper'

// v3 forms, state side: the local draft, the save-error mapper and the action row (`FormLike` is structural; the form engine stays the app's).
export { useFormDraft } from './draft'
export { toSubmitErrors } from './submit'
export { FormFooter } from './form-footer'

// v3 control-view: the cue and the reset live in `ControlView` alone; `spec` is the data a home renders.
export { ControlView } from './control-view'
export { spec } from './spec'
export type { FilterSpec } from './contract'

// v3 control-home: the home decides the presentation; `filterSlot` is the typed channel into it.
export { ControlHome } from './control-home'
export { filterSlot } from './filter-slot'
