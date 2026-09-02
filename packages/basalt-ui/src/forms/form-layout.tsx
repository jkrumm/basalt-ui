/**
 * ./forms — the form layout primitives: `FormSection`, `FormRow`, `FormGroup`, `FormActions`.
 * Mantine-coupled. Optional peer: @mantine/form (these four need none of it — they are layout).
 *
 * The gap they close (audit B #5 / §4): `./forms` shipped no layout at all, so the only row
 * primitive in the package was `SettingsRow` over in `./dashboard` — which is the SETTINGS-page
 * variant of the same shape, not the form one. Every consumer form therefore hand-rolled its own
 * label/control geometry, and each one picked its own breakpoint behaviour.
 *
 * **`FormRow` IS law C1's third home, the form row** (`docs/CONTROLS-SPEC.md` §1). Like
 * `SettingsRow` it keeps Mantine's `md` size tier and mounts no `CtlSlot`: a control bound to a
 * field is read and typed into, not a 30px chrome affordance, and its own `size` prop stays
 * load-bearing. `SettingsRow` is not deprecated and is not duplicated here — reach for it on a
 * settings page (a stack of divider-separated rows inside a `SettingsSection` card), and for
 * `FormRow` inside a `<form>` with validation, hints and errors.
 *
 * Disabled propagation is native `<fieldset disabled>` driven by `FormStateProvider` — see
 * `form-state.tsx` for why that rather than `cloneElement`.
 */
import { VisuallyHidden } from '@mantine/core'
import type { ReactNode } from 'react'
import { cx } from '../common/props'
import type { BasaltProps, SlotStylesProps } from '../common/props'
import { assertRequiredProps } from '../common/validate'
import { BarActionSlot } from '../controls/actions'
import type { SlotActions } from '../controls/actions'
import { WidgetHeader } from '../widget-header'
import type { WidgetHeaderTitleProps } from '../widget-header'
import { useFormState } from './form-state'
import classes from './form-layout.module.css'

// ── the two fragments FormRow and FormGroup both paint ────────────────────────

/**
 * The required marker: an accent `*` for sighted readers, `(required)` in text for assistive tech.
 *
 * Extracted because `FormRow` (inside its `<label>`) and `FormGroup` (inside its `<legend>`) wrote
 * it twice, and the WCAG 1.3.1 half is exactly the half a copy quietly loses — colour and a glyph
 * are not a label, so a second site that keeps the `*` and drops the `VisuallyHidden` reads as
 * correct and is not. Renders nothing when the field is not required, so a caller passes the flag
 * straight through rather than branching around it.
 */
function RequiredMark({ required }: { required: boolean | undefined }) {
  if (required !== true) return null
  return (
    <>
      <span aria-hidden="true" className={classes.required}>
        *
      </span>
      <VisuallyHidden>(required)</VisuallyHidden>
    </>
  )
}

/**
 * The error line under a control region.
 *
 * The falsy test is the reason this is shared: `error` takes `form.errors[path]` verbatim, which is
 * `undefined` on a clean field, `null` after a cleared error and `false` from a `cond && message`
 * — three shapes, and a call site testing only one paints an empty red box on the other two.
 */
function FieldError({ error }: { error: ReactNode }) {
  if (error === undefined || error === null || error === false) return null
  return <span className={classes.error}>{error}</span>
}

// ── FormSection ───────────────────────────────────────────────────────────────

/** The three boxes `FormSection` paints (`common/props.ts`). */
export type FormSectionSlot = 'root' | 'header' | 'body'

/**
 * Composed from the named `WidgetHeaderTitleProps` slice, the same way `SettingsSection` is — so
 * `icon` and `info` reach the header for free and the four composers cannot drift into four
 * different title subsets (audit B #2). `value`/`delta` are deliberately not taken: a form section
 * groups fields, it states no metric.
 */
export type FormSectionProps = BasaltProps &
  SlotStylesProps<FormSectionSlot> &
  WidgetHeaderTitleProps & {
    /** The section body — typically a stack of `FormRow`s. */
    children: ReactNode
  }

/**
 * A titled grouping of form rows: a `WidgetHeader tier="section"` above a stack.
 *
 * **Not `Section`, and deliberately not a card.** `Section` is a collapsible, persistable page
 * widget with its own surface; a form is usually already inside one, and nesting a second card per
 * fieldset is the "two cards deep" a settings page reads as. This paints no background, no border
 * and no shadow — only the heading and the rhythm.
 *
 * @example
 * <FormSection title="Billing" subtitle="Where the invoice goes.">
 *   <FormRow label="Company">
 *     <TextInput key={fieldKey(form, 'company')} {...inputProps(form, 'company')} />
 *   </FormRow>
 *   <FormRow label="VAT ID">
 *     <TextInput key={fieldKey(form, 'vat')} {...inputProps(form, 'vat')} />
 *   </FormRow>
 * </FormSection>
 */
export function FormSection(props: FormSectionProps) {
  assertRequiredProps('FormSection', props, ['title'])
  const { title, icon, subtitle, info, children, className, style, classNames } = props

  return (
    <section
      className={cx(classes.section, classNames?.root, className)}
      {...(style !== undefined && { style })}
    >
      <WidgetHeader
        tier="section"
        title={title}
        {...(icon !== undefined && { icon })}
        {...(subtitle !== undefined && { subtitle })}
        {...(info !== undefined && { info })}
        {...(classNames?.header !== undefined && { className: classNames.header })}
      />
      <div className={cx(classes.sectionBody, classNames?.body)}>{children}</div>
    </section>
  )
}

// ── FormRow ───────────────────────────────────────────────────────────────────

/** The three boxes `FormRow` paints (`common/props.ts`). */
export type FormRowSlot = 'root' | 'label' | 'control'

export type FormRowProps = BasaltProps &
  SlotStylesProps<FormRowSlot> & {
    /** The field's label. Ink, `--vx-text-md` — the same weight `SettingsRow` gives its own. */
    label: string
    /** Muted line under the label: the rule, the unit, the example. Never the error. */
    hint?: string
    /** The field's error, rendered under the control. Pass `form.errors[path]` — falsy renders nothing. */
    error?: ReactNode
    /** Marks the field required: an accent `*` for sighted readers, `(required)` for assistive tech. */
    required?: boolean
    /**
     * Associates the `<label>` with the control's id. Mantine generates one per input, so pass the
     * SAME `id` to both. Without it the row's label is a caption, not a label — which is why a
     * control carrying its OWN `label` prop should not also sit under a `FormRow` label.
     */
    htmlFor?: string
    /** The control. Anything: a Mantine input, a segmented control, a consumer's own widget. */
    children: ReactNode
  }

/**
 * One labelled field: label left / control right on desktop, label above the control below `sm`.
 * The swap is CSS (law C9) — no `useMediaQuery`, so it is correct in SSR markup and it costs no
 * render.
 *
 * The control region is a `<fieldset>` that goes `disabled` whenever the enclosing
 * `FormStateProvider` says the form is busy, which is the whole disabled-propagation story: no
 * `disabled` prop to thread, no `cloneElement`, real `:disabled` styling from Mantine.
 *
 * @example
 * <FormRow label="Email" hint="We only use it for receipts." required error={form.errors['email']}>
 *   <TextInput key={fieldKey(form, 'email')} {...inputProps(form, 'email')} />
 * </FormRow>
 */
export function FormRow(props: FormRowProps) {
  // F-ERR-1: a missing `label` would otherwise render a nameless row and read as a CSS bug.
  assertRequiredProps('FormRow', props, ['label'])
  const { label, hint, error, required, htmlFor, children, className, style, classNames } = props
  const { disabled } = useFormState()

  return (
    <div
      className={cx(classes.row, classNames?.root, className)}
      {...(style !== undefined && { style })}
    >
      <div className={cx(classes.rowLabel, classNames?.label)}>
        <label className={classes.label} {...(htmlFor !== undefined && { htmlFor })}>
          {label}
          <RequiredMark required={required} />
        </label>
        {hint !== undefined && <span className={classes.hint}>{hint}</span>}
      </div>
      <fieldset className={cx(classes.control, classNames?.control)} disabled={disabled}>
        {children}
        <FieldError error={error} />
      </fieldset>
    </div>
  )
}

// ── FormGroup ─────────────────────────────────────────────────────────────────

export type FormGroupProps = BasaltProps & {
  /** The group's label, rendered as the fieldset's `<legend>` — the accessible name of the cluster. */
  label: string
  /** Muted line under the legend. */
  hint?: string
  /** The group-level error, rendered under the controls. */
  error?: ReactNode
  /** Marks the group required — same two-channel treatment as `FormRow`. */
  required?: boolean
  /** `column` stacks the options; `row` lays them out inline and wraps. @default 'column' */
  direction?: 'row' | 'column'
  /** The cluster — checkboxes, radios, chips. */
  children: ReactNode
}

/**
 * A labelled cluster of related controls: a checkbox group, a radio group, a set of chips.
 *
 * **The label is ALWAYS above**, never beside — a `FormRow`'s side-by-side geometry breaks the
 * moment the right column holds four stacked checkboxes rather than one input. That is the whole
 * reason this is a second primitive and not a `FormRow` variant.
 *
 * It renders a real `<fieldset>` + `<legend>`, which is the correct grouping semantic for a set of
 * inputs sharing one question — and, as with `FormRow`, is what makes the `FormStateProvider`
 * disable propagate natively.
 *
 * @example
 * <FormGroup label="Notify me about" direction="row">
 *   <Checkbox key={fieldKey(form, 'onDeploy')} {...inputProps(form, 'onDeploy')} label="Deploys" />
 *   <Checkbox key={fieldKey(form, 'onError')} {...inputProps(form, 'onError')} label="Errors" />
 * </FormGroup>
 */
export function FormGroup(props: FormGroupProps) {
  assertRequiredProps('FormGroup', props, ['label'])
  const { label, hint, error, required, direction = 'column', children, className, style } = props
  const { disabled } = useFormState()

  return (
    <fieldset
      className={cx(classes.group, className)}
      disabled={disabled}
      {...(style !== undefined && { style })}
    >
      <legend className={classes.legend}>
        {label}
        <RequiredMark required={required} />
      </legend>
      {hint !== undefined && <span className={classes.hint}>{hint}</span>}
      <div className={classes.groupControls} data-direction={direction}>
        {children}
      </div>
      <FieldError error={error} />
    </fieldset>
  )
}

// ── FormActions ───────────────────────────────────────────────────────────────

export type FormActionsProps = BasaltProps & {
  /**
   * The submit/cancel row, in either form law C15 accepts: typed `BarAction[]` DATA — which basalt
   * projects, budgets and folds into a `More` menu past three — or an opaque `ReactNode` the caller
   * drew itself. Rendered through the SAME `BarActionSlot` every other home uses, so a form's
   * actions and a page bar's cannot look like two different vocabularies.
   *
   * A `BarAction` renders a `type="button"`, so a typed submit is `onClick: submit`; a native
   * `<Button type="submit">` goes through the node arm.
   */
  actions: SlotActions
}

/**
 * The row a form ends on. Trailing-aligned, wrapping, and `disabled` as a unit while the enclosing
 * `FormStateProvider` reports a submit in flight — which is what stops the double-submit that
 * a per-button `loading` prop only hides.
 *
 * @example
 * <FormActions
 *   actions={[
 *     { key: 'cancel', label: 'Cancel', onClick: close },
 *     { key: 'save', label: 'Save', onClick: submit },
 *   ]}
 * />
 */
export function FormActions(props: FormActionsProps) {
  // No `assertRequiredProps` here, unlike its siblings: `actions` is a `ReactNode` on one arm and
  // `null` is a legitimate one (`{canSave ? row : null}`). Throwing on it would fail the honest
  // empty case, which `BarActionSlot` already renders as nothing.
  const { actions, className, style } = props
  const { disabled } = useFormState()

  return (
    <fieldset
      className={cx(classes.actions, className)}
      disabled={disabled}
      {...(style !== undefined && { style })}
    >
      <BarActionSlot actions={actions} />
    </fieldset>
  )
}
