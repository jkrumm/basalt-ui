// Spike (W1 ledger): all three drafts commit ONCE per typed phrase and follow an outside reset.
import { act, render } from '@testing-library/react'
import { expect, test } from 'bun:test'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useDebouncedFieldIncumbent } from './debounce-incumbent'
import { useDebouncedFieldMantine } from './debounce-mantine'
import { useDebouncedFieldPacer } from './debounce-pacer'

type Hook = typeof useDebouncedFieldIncumbent
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

for (const [name, useHook] of [
  ['incumbent', useDebouncedFieldIncumbent],
  ['pacer', useDebouncedFieldPacer],
  ['mantine', useDebouncedFieldMantine],
] as const satisfies ReadonlyArray<readonly [string, Hook]>) {
  test(`${name}: one commit per phrase, follows outside reset`, async () => {
    const commits: string[] = []
    let api: { draft: { value: string; set: (v: string) => void }; reset: () => void } | undefined
    function Probe(): ReactNode {
      const [value, setValue] = useState('')
      const draft = useHook(value, (v) => {
        commits.push(v)
        setValue(v)
      })
      api = { draft, reset: () => setValue('') }
      return <output>{draft.value}</output>
    }
    const { container } = render(<Probe />)
    for (const ch of ['a', 'ab', 'abc']) act(() => api?.draft.set(ch))
    await act(() => wait(260))
    expect(commits).toEqual(['abc'])
    act(() => api?.reset())
    expect(container.textContent).toBe('')
  })
}
