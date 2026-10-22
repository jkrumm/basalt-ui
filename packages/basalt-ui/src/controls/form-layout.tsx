/**
 * ./controls — the form layout primitives: `FormSection`, `FormRow`, `FormGroup`, `FormActions`.
 * Mantine-coupled. They need no `@mantine/form` (layout only), which is why they live here and not
 * in `./forms`, whose barrel value-imports it: importing a row from there made a consumer install a
 * peer it never used.
 *
 * The gap they close (audit B #5 / §4): `./forms` shipped no layout at all, so the only row
 * primitive in the package was `SettingsRow` over in `./dashboard` — which is the SETTINGS-page
 * variant of the same shape, not the form one. Every consumer form therefore hand-rolled its own
 * label/control geometry, and each one picked its own breakpoint behaviour.
 *
 * **`FormRow` IS law C1's third home, the form row** (`docs/CONTROLS-SPEC.md` §1). Like
 * `SettingsRow` it mounts a `CtlSlot`, so a bound control is the 32 px field (44 under a coarse
 * pointer, 16 px text) of SPEC § 6.13 and not Mantine's 42 px `md`; a child's own `size` still wins.
 * `SettingsRow` is not deprecated and is not duplicated here — reach for it on a settings page (a
 * stack of divider-separated rows inside a `SettingsSection` card), and for `FormRow` inside a
 * `<form>` with validation, hints and errors.
 *
 * Disabled propagation is native `<fieldset disabled>` driven by `FormStateProvider` — see
 * `form-state.tsx` for why that rather than `cloneElement`.
 */
import { VisuallyHidden } from '@mantine/core'
import { useId } from 'react'
import type { ReactNode } from 'react'
import { cx } from '../common/props'
import type { BasaltProps, SlotStylesProps } from '../common/props'
import { assertRequiredProps } from '../common/validate'
import { BarActionSlot } from './actions'
import type { SlotActions } from './actions'
import { WidgetHeader } from '../dashboard/widget-header'
import type { WidgetHeaderTitleProps } from '../dashboard/widget-header'
import { CtlSlot } from '../theme'
import { useSizeClass } from '../shell/use-size-class'
import { useFormState } from '../forms/form-state'
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

/** True when `error` carries a message: `undefined`, `null` and `false` are three shapes of "clean". */
function hasError(error: ReactNode): boolean {
  return error !== undefined && error !== null && error !== false
}

/**
 * The error line under a control region: the bad-status icon, then one sentence.
 *
 * The falsy test is the reason this is shared: `error` takes `form.errors[path]` verbatim, which is
 * `undefined` on a clean field, `null` after a cleared error and `false` from a `cond && message`
 * — three shapes, and a call site testing only one paints an empty red box on the other two. The
 * icon is decorative (`aria-hidden`): colour and a glyph are not the message, the sentence is, and
 * the region it sits in names it through `aria-describedby`.
 */
function FieldError({ error, id }: { error: ReactNode; id: string }) {
  if (!hasError(error)) return null
  return (
    <span id={id} className={classes.error}>
      <svg
        className={classes.errorIcon}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        aria-hidden="true"
        data-field-error-icon=""
      >
        <circle cx="8" cy="8" r="6.25" />
        <path d="M8 4.75v3.9M8 11.2v.05" />
      </svg>
      <span>{error}</span>
    </span>
  )
}

/** The ids a row/group hangs its description and error on, and the `aria-describedby` that names them. */
function useDescribedBy(hint: string | undefined, error: ReactNode) {
  const uid = useId()
  const hintId = `${uid}-hint`
  const errorId = `${uid}-error`
  const ids = [hint !== undefined ? hintId : null, hasError(error) ? errorId : null].filter(
    (id) => id !== null,
  )
  return { hintId, errorId, describedBy: ids.length > 0 ? ids.join(' ') : undefined }
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
    /**
     * The field's error, rendered under the control. Falsy renders nothing. For a Mantine input
     * wired through `inputProps(form, path)`, Mantine's own `Input.Wrapper` already renders the
     * field error — passing it here too would render it twice. Reserve this prop for children that
     * render no error of their own (a raw input, a custom control) and read it typed:
     * `error={inputProps(form, path).error}`.
     */
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
 * // A Mantine input wired through inputProps already renders its own error via Input.Wrapper —
 * // omit `error` here, or it renders twice.
 * <FormRow label="Email" hint="We only use it for receipts." required>
 *   <TextInput key={fieldKey(form, 'email')} {...inputProps(form, 'email')} />
 * </FormRow>
 *
 * @example
 * // A raw control renders no error of its own — pass it explicitly.
 * <FormRow label="Email" required error={inputProps(form, 'email').error}>
 *   <input value={form.values.email} onChange={(e) => form.setFieldValue('email', e.target.value)} />
 * </FormRow>
 */
export function FormRow(props: FormRowProps) {
  // F-ERR-1: a missing `label` would otherwise render a nameless row and read as a CSS bug.
  assertRequiredProps('FormRow', props, ['label'])
  const { label, hint, error, required, htmlFor, children, className, style, classNames } = props
  const { disabled } = useFormState()
  const { hintId, errorId, describedBy } = useDescribedBy(hint, error)

  return (
    <div
      className={cx(classes.row, classNames?.root, className)}
      {...(style !== undefined && { style })}
    >
      <div className={classes.grid}>
        <div className={cx(classes.rowLabel, classNames?.label)}>
          <label className={classes.label} {...(htmlFor !== undefined && { htmlFor })}>
            {label}
            <RequiredMark required={required} />
          </label>
          {hint !== undefined && (
            <span id={hintId} className={classes.hint}>
              {hint}
            </span>
          )}
        </div>
        <fieldset
          className={cx(classes.control, classNames?.control)}
          disabled={disabled}
          {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
        >
          <CtlSlot>{children}</CtlSlot>
          <FieldError error={error} id={errorId} />
        </fieldset>
      </div>
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
  /**
   * `column` stacks the options; `row` lays them out inline, wraps, and bottom-aligns them, so a
   * trailing button sits level with the inputs instead of stretching to the tallest child. Give a
   * `FormRow` inside a `row` group (or any flex row) a definite width — it is an inline-size
   * container, so its intrinsic width is zero and it collapses otherwise. @default 'column'
   */
  direction?: 'row' | 'column'
  /**
   * Sets the group up as a form SECTION: the legend becomes the section title (`md`, 500), the
   * children stack 12 apart like rows, and a section followed by another keeps 24 between them —
   * so a form is a run of `section` groups with no wrapper to space them. @default false
   */
  section?: boolean
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
 *   <Checkbox
 *     key={fieldKey(form, 'onDeploy')}
 *     {...inputProps(form, 'onDeploy', { type: 'checkbox' })}
 *     label="Deploys"
 *   />
 *   <Switch
 *     key={fieldKey(form, 'onError')}
 *     {...inputProps(form, 'onError', { type: 'checkbox' })}
 *     label="Errors"
 *   />
 * </FormGroup>
 */
export function FormGroup(props: FormGroupProps) {
  assertRequiredProps('FormGroup', props, ['label'])
  const {
    label,
    hint,
    error,
    required,
    direction = 'column',
    section = false,
    children,
    className,
    style,
  } = props
  const { disabled } = useFormState()
  const { hintId, errorId, describedBy } = useDescribedBy(hint, error)

  return (
    <fieldset
      className={cx(classes.group, className)}
      disabled={disabled}
      {...(section && { 'data-section': '' })}
      {...(describedBy !== undefined && { 'aria-describedby': describedBy })}
      {...(style !== undefined && { style })}
    >
      <legend className={classes.legend}>
        {label}
        <RequiredMark required={required} />
      </legend>
      {hint !== undefined && (
        <span id={hintId} className={classes.hint}>
          {hint}
        </span>
      )}
      <div className={classes.groupControls} data-direction={direction}>
        {children}
      </div>
      <FieldError error={error} id={errorId} />
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
 * The row a form ends on. Trailing-aligned, wrapping, sticky to the bottom of the scrollport on a
 * compact screen (a long form's primary stays in reach), and `disabled` as a unit while the enclosing
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
  const compact = useSizeClass() === 'compact'

  return (
    <fieldset
      className={cx(classes.actions, className)}
      disabled={disabled}
      {...(compact && { 'data-sticky': '' })}
      {...(style !== undefined && { style })}
    >
      <BarActionSlot actions={actions} />
    </fieldset>
  )
}
