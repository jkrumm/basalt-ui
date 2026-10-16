/**
 * `ext<typeof X>()` keeps `X.extend()`'s compile-time checking with no value import of `X`. One
 * `@ts-expect-error` per bad line, proven by `tsc --noEmit`.
 */
import { expect, test } from 'bun:test'
import type { Button, Card, Input } from '@mantine/core'
import { ext } from './extend'

ext<typeof Button>({ defaultProps: { size: 'md' } })
ext<typeof Card>({ styles: { root: { padding: 0 } } })
ext<typeof Input>({ vars: () => ({ wrapper: {}, input: {} }) })

// Never called: the bad inputs are compile-time facts only.
export function rejected(): void {
  // @ts-expect-error `sizee` is not a Button prop
  ext<typeof Button>({ defaultProps: { sizee: 'md' } })
  // @ts-expect-error `vars` is a resolver function, not a number
  ext<typeof Card>({ vars: 3 })
  // @ts-expect-error `nope` is not a Card styles part
  ext<typeof Card>({ classNames: { nope: 'x' } })
  // @ts-expect-error `nope` is not a Card styles part
  ext<typeof Card>({ styles: { nope: {} } })
  // @ts-expect-error a non-component has no `extend`
  ext<string>({})
  // @ts-expect-error a plain object has no `extend`
  ext<{ a: 1 }>({})
}

test('the ext types compile', () => {
  expect(ext<typeof Button>({ defaultProps: { size: 'md' } })).toEqual({
    defaultProps: { size: 'md' },
  })
})
