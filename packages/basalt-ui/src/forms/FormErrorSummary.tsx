/**
 * ./forms — FormErrorSummary: accessible error-summary component for long forms.
 * Mantine-coupled. Optional peer: @mantine/form.
 */
import { Alert, List, Text } from '@mantine/core'
import type { UseFormReturnType } from '@mantine/form'
import type { BasaltProps } from '../common/props'
import { assertRequiredProps } from '../common/validate'
import { alpha, VX } from '../tokens'

// ── FormErrorSummary ──────────────────────────────────────────────────────────

/** Props for FormErrorSummary. */
export type FormErrorSummaryProps<Values extends Record<string, unknown>> = BasaltProps & {
  form: UseFormReturnType<Values>
  /** Accessible heading shown above the error list. Defaults to "Please fix the following errors". */
  title?: string
}

/**
 * Renders an accessible error summary list for long forms and screen readers.
 * Follows the WCAG error-summary pattern — a single `role="alert"` container that
 * lists all field errors, placed at the top of the form so AT announces it on submit.
 *
 * Returns `null` when the form has no errors (renders nothing when the form is clean).
 *
 * @example
 * import { FormErrorSummary, useBasaltForm } from 'basalt-ui/forms'
 *
 * function MyForm() {
 *   const form = useBasaltForm({ initialValues: { email: '' } })
 *   return (
 *     <form onSubmit={form.onSubmit(console.log)}>
 *       <FormErrorSummary form={form} title="Fix these before submitting" />
 *       <TextInput key={fieldKey(form, 'email')} {...inputProps(form, 'email')} label="Email" />
 *     </form>
 *   )
 * }
 */
export function FormErrorSummary<Values extends Record<string, unknown>>(
  props: FormErrorSummaryProps<Values>,
) {
  // F-ERR-1: without this, a missing `form` fails deep inside `Object.entries(form.errors)` as a
  // raw `TypeError` caught by `BasaltErrorBoundary` — a blank subtree with no message naming it.
  assertRequiredProps('FormErrorSummary', props, ['form'])
  const { form, title = 'Please fix the following errors', className, style } = props
  const errorEntries = Object.entries(form.errors)
  if (errorEntries.length === 0) return null

  return (
    <Alert
      role="alert"
      title={<Text fw={600}>{title}</Text>}
      {...(className !== undefined && { className })}
      {...(style !== undefined && { style })}
      styles={{
        root: {
          backgroundColor: alpha(VX.status.bad, 0.13),
          color: VX.status.bad,
          borderRadius: 'var(--vx-radius-ctrl)',
        },
      }}
    >
      <List size="sm" mt={4}>
        {errorEntries.map(([path, message]) => (
          <List.Item key={path}>{String(message)}</List.Item>
        ))}
      </List>
    </Alert>
  )
}
