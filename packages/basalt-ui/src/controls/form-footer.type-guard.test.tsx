/** Compile-time proof (checked by `tsc --noEmit`): at most five actions, at most one primary. */
import { expect, test } from 'bun:test'
import type { FormLike } from '../core/ports'
import { FormFooter } from './form-footer'

const form: FormLike<unknown> = {
  state: { values: {}, isSubmitting: false, canSubmit: true, errors: [] },
  options: {},
  store: { subscribe: () => ({ unsubscribe() {} }) },
  reset() {},
}

export const none = <FormFooter form={form} actions={[]} />
export const first = (
  <FormFooter
    form={form}
    actions={[
      { label: 'P', primary: true },
      { label: 'A' },
      { label: 'A2' },
      { label: 'A3' },
      { label: 'A4' },
    ]}
  />
)
export const middle = (
  <FormFooter
    form={form}
    actions={[{ label: 'A' }, { label: 'P', primary: true }, { label: 'B' }]}
  />
)
export const five = (
  <FormFooter
    form={form}
    actions={[{ label: '1' }, { label: '2' }, { label: '3' }, { label: '4' }, { label: '5' }]}
  />
)
export const six = (
  <FormFooter
    form={form}
    // @ts-expect-error a sixth action
    actions={[
      { label: '1' },
      { label: '2' },
      { label: '3' },
      { label: '4' },
      { label: '5' },
      { label: '6' },
    ]}
  />
)
export const twoPrimaries = (
  <FormFooter
    form={form}
    // @ts-expect-error a second primary
    actions={[{ label: 'P', primary: true }, { label: 'A' }, { label: 'Q', primary: true }]}
  />
)

test('the action types compile', () => {
  expect([none, first, middle, five, six, twoPrimaries].length).toBe(6)
})
