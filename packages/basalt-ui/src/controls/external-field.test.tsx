/**
 * A basalt control bound to `externalField` — the external value drives the control and a click
 * calls the external setter. No router, no store: the handle is the whole contract.
 */
import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'bun:test'
import { useSyncExternalStore } from 'react'
import { externalField } from '../state'
import { ViewTabs } from './view-tabs'

type Mode = 'rest' | 'interval'

let mode: Mode = 'rest'
const sets: Mode[] = []
const listeners = new Set<() => void>()
const setMode = (next: Mode): void => {
  sets.push(next)
  mode = next
  for (const l of listeners) l()
}
const useMode = (): Mode =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => mode,
  )

const timerMode = externalField({
  values: ['rest', 'interval'],
  fallback: 'rest',
  labels: { rest: 'Rest Timer', interval: 'Interval Timer' },
  use: () => [useMode(), setMode],
})

test('ViewTabs binds it: the value drives the control, a click calls the setter', () => {
  render(
    <MantineProvider>
      <ViewTabs field={timerMode} label="Timer mode" />
    </MantineProvider>,
  )
  const interval = screen.getAllByLabelText('Interval Timer')[0]!
  const rest = screen.getAllByLabelText('Rest Timer')[0]! as HTMLInputElement
  expect(rest.checked).toBe(true)
  fireEvent.click(interval)
  expect(sets).toEqual(['interval'])
  act(() => setMode('rest'))
  expect((screen.getAllByLabelText('Rest Timer')[0]! as HTMLInputElement).checked).toBe(true)
})
