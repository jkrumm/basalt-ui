/**
 * `SearchFilter` debounce parity: the field is written once per phrase, never for a no-op, and a
 * pending commit never outlives an outside change or the component.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { FieldHandle } from '../state'
import type { StringField } from '../state/fields'
import { SearchFilter } from './search-filter'

const WAIT = 260 // DEBOUNCE_MS (200) plus slack

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

type Harness = { writes: string[]; setOutside: (next: string) => void; unmount: () => void }

function mountFilter(initial = ''): Harness {
  const harness: Harness = { writes: [], setOutside: () => {}, unmount: () => {} }
  function Page(): ReactNode {
    const [value, setValue] = useState(initial)
    useEffect(() => {
      harness.setOutside = setValue
    }, [])
    const field = {
      use: () => [
        value,
        (next: string) => {
          harness.writes.push(next)
          setValue(next)
        },
      ],
      isDefault: (v: string) => v === '',
      clear: () => setValue(''),
    } as unknown as FieldHandle<StringField>
    return <SearchFilter field={field} placeholder="Search" />
  }
  harness.unmount = render(
    <MantineProvider>
      <Page />
    </MantineProvider>,
  ).unmount
  return harness
}

const input = (): HTMLInputElement => screen.getByPlaceholderText('Search')
const type = (text: string): void => {
  fireEvent.change(input(), { target: { value: text } })
}

afterEach(cleanup)

describe('SearchFilter debounce', () => {
  test('rapid keystrokes commit exactly once', async () => {
    const h = mountFilter()
    type('a')
    type('ab')
    type('abc')
    expect(h.writes).toEqual([])
    await act(() => sleep(WAIT))
    expect(h.writes).toEqual(['abc'])
  })

  test('typing then erasing inside the window never writes', async () => {
    const h = mountFilter()
    type('a')
    type('')
    await act(() => sleep(WAIT))
    expect(h.writes).toEqual([])
  })

  test('an outside change cancels a pending commit and resets the draft', async () => {
    const h = mountFilter()
    type('abc')
    act(() => {
      h.setOutside('reset')
    })
    await act(() => sleep(WAIT))
    expect(h.writes).toEqual([])
    expect(input().value).toBe('reset')
  })

  test('unmounting with a pending commit flushes it', async () => {
    const h = mountFilter()
    type('abc')
    h.unmount()
    await sleep(WAIT)
    expect(h.writes).toEqual(['abc'])
  })
})

describe('SearchFilter immediate commit', () => {
  test('Enter commits the pending query inside the debounce window', () => {
    const h = mountFilter()
    type('abc')
    expect(h.writes).toEqual([])
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(h.writes).toEqual(['abc'])
  })

  test('blur commits the pending query inside the debounce window', () => {
    const h = mountFilter()
    type('abc')
    fireEvent.blur(input())
    expect(h.writes).toEqual(['abc'])
  })

  test('a flushed commit is not written a second time when the debounce elapses', async () => {
    const h = mountFilter()
    type('abc')
    fireEvent.keyDown(input(), { key: 'Enter' })
    await act(() => sleep(WAIT))
    expect(h.writes).toEqual(['abc'])
  })

  test('Enter with nothing pending writes nothing', () => {
    const h = mountFilter()
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(h.writes).toEqual([])
  })

  test('is a search input with a search enter key', () => {
    mountFilter()
    expect(input().type).toBe('search')
    expect(input().getAttribute('enterkeyhint')).toBe('search')
  })

  test('a clear button appears when non-empty and clears the field at once', () => {
    const h = mountFilter('abc')
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(h.writes).toEqual([''])
    expect(input().value).toBe('')
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull()
  })

  test('no clear button while empty', () => {
    mountFilter()
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull()
  })
})
