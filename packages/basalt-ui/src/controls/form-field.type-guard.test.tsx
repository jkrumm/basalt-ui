/**
 * Compile-time proof (checked by `tsc --noEmit`) that a `FormField` needs its `label`, takes a
 * `field` or a `control` and never both. The valid lines prove each `@ts-expect-error` fails for that
 * reason and not everywhere.
 */
import { expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import type { FieldLike } from '../core/ports'
import { Input } from '../ui/input'
import { memoryHandle } from './control-view.handles'
import { FormField } from './form-field'

const field: FieldLike<string> = {
  state: { value: 'x', meta: { errors: [] } },
  handleChange() {},
  handleBlur() {},
}
const control = memoryHandle('tg.ff', 'x', { kind: 'string' })

export const withField: ReactElement = (
  <FormField label="Name" field={field}>
    <Input />
  </FormField>
)
export const withControl: ReactElement = (
  <FormField label="Name" control={control}>
    <Input />
  </FormField>
)

export const noLabel: ReactElement = (
  // @ts-expect-error a field without a label has no accessible name
  <FormField field={field}>
    <Input />
  </FormField>
)

export const both: ReactElement = (
  // @ts-expect-error `field` and `control` are one source each, never both
  <FormField label="Name" field={field} control={control}>
    <Input />
  </FormField>
)

export const neither: ReactElement = (
  // @ts-expect-error a field needs a `field` or a `control`
  <FormField label="Name">
    <Input />
  </FormField>
)

test('the guards compile', () => {
  expect(control.isDefault).toBe(true)
  expect(field.state.value).toBe('x')
})
