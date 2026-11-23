import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { Combobox } from '../../ui/combobox'
import { VirtualList } from '../../ui/virtual-list'
import type { ListItems } from './options'

afterEach(cleanup)

const rowTexts = (): string[] =>
  [
    ...document.querySelectorAll(
      '[data-slot="option-row"], [data-slot="option-group-label"], [data-slot="option-create"]',
    ),
  ].map((el) =>
    el.getAttribute('data-slot') === 'option-group-label'
      ? `# ${el.textContent ?? ''}`
      : el.getAttribute('data-slot') === 'option-create'
        ? `+ ${el.textContent ?? ''}`
        : (el.querySelector('[data-slot="option-label"]')?.textContent ?? ''),
  )

const rows = (): number => document.querySelectorAll('[data-slot="option-row"]').length

const status = (): string | null =>
  document.querySelector('[data-slot="option-status"]')?.textContent ?? null

const input = (): HTMLInputElement =>
  document.querySelector('input[aria-label]') as HTMLInputElement

const type = async (text: string): Promise<void> => {
  await act(async () => {
    fireEvent.change(input(), { target: { value: text } })
  })
}

const CITIES: ListItems = [
  {
    label: 'Germany',
    options: [
      { value: 'ber', label: 'Berlin' },
      { value: 'ham', label: 'Hamburg' },
    ],
  },
  {
    label: 'France',
    options: [
      { value: 'par', label: 'Paris' },
      { value: 'lyo', label: 'Lyon' },
    ],
  },
]

type Call = { query: string; signal: AbortSignal; resolve: (items: ListItems) => void }

function fakeLoader(): {
  calls: Call[]
  load: (q: string, c: { signal: AbortSignal }) => Promise<ListItems>
} {
  const calls: Call[] = []
  return {
    calls,
    load: (query, { signal }) =>
      new Promise<ListItems>((resolve) => {
        calls.push({ query, signal, resolve })
      }),
  }
}

describe('Combobox options form', () => {
  test('groups get a header and search ranks across them', async () => {
    await act(async () => {
      render(<Combobox aria-label="City" options={CITIES} defaultOpen />)
    })
    expect(rowTexts()).toEqual(['# Germany', 'Berlin', 'Hamburg', '# France', 'Paris', 'Lyon'])
    await type('ly')
    expect(rowTexts()).toEqual(['# France', 'Lyon'])
    await type('zzz')
    expect(rowTexts()).toEqual([])
    expect(status()).toBe('No match')
  })

  test('every row keeps a check slot, so a hint ends on one column', async () => {
    await act(async () => {
      render(<Combobox aria-label="City" options={CITIES} defaultOpen defaultValue="ber" />)
    })
    const rowEls = [...document.querySelectorAll('[data-slot="option-row"]')]
    expect(rowEls.length).toBe(4)
    for (const row of rowEls) expect(row.querySelector('[data-slot="option-check"]')).not.toBeNull()
  })

  test('async: loading, then results; a slow first answer never overwrites a later one', async () => {
    const { calls, load } = fakeLoader()
    await act(async () => {
      render(<Combobox aria-label="Repo" options={load} defaultOpen />)
    })
    await waitFor(() => expect(calls.length).toBe(1))
    expect(status()).toBe('Loading…')
    await act(async () => calls[0]?.resolve([{ value: 'a', label: 'Alpha' }]))
    expect(rowTexts()).toEqual(['Alpha'])
    expect(status()).toBeNull()

    await type('b')
    await type('be')
    await waitFor(() => expect(calls.map((c) => c.query)).toEqual(['', 'b', 'be']))
    expect(calls[1]?.signal.aborted).toBe(true)
    await act(async () => calls[2]?.resolve([{ value: 'beta', label: 'Beta' }]))
    expect(rowTexts()).toEqual(['Beta'])
    await act(async () => calls[1]?.resolve([{ value: 'bravo', label: 'Bravo' }]))
    expect(rowTexts()).toEqual(['Beta'])
  })

  test('async groups and a failed load', async () => {
    const { calls, load } = fakeLoader()
    await act(async () => {
      render(<Combobox aria-label="City" options={load} defaultOpen />)
    })
    await waitFor(() => expect(calls.length).toBe(1))
    await act(async () => calls[0]?.resolve(CITIES))
    expect(rowTexts()).toEqual(['# Germany', 'Berlin', 'Hamburg', '# France', 'Paris', 'Lyon'])

    const failing = mock(() => Promise.reject(new Error('timeout')))
    cleanup()
    await act(async () => {
      render(<Combobox aria-label="City" options={failing} defaultOpen />)
    })
    await waitFor(() => expect(status()).toContain('timeout'))
  })

  test('onCreate works with groups and with a loader', async () => {
    const onCreate = mock((text: string) => text.toLowerCase())
    const onValueChange = mock((_value: unknown) => {})
    await act(async () => {
      render(
        <Combobox
          aria-label="City"
          options={CITIES}
          defaultOpen
          onCreate={onCreate}
          onValueChange={onValueChange}
        />,
      )
    })
    await type('Lyonnais')
    expect(rowTexts()).toEqual(['+ Create "Lyonnais"'])
    await type('Ly')
    expect(rowTexts()).toEqual(['# France', 'Lyon', '+ Create "Ly"'])
    await type('Zurich')
    await act(async () => {
      fireEvent.click(document.querySelector('[data-slot="option-create"]') as Element)
    })
    expect(onCreate).toHaveBeenCalledWith('Zurich')
    expect(onValueChange.mock.calls.at(-1)?.[0]).toBe('zurich')

    cleanup()
    const { calls, load } = fakeLoader()
    await act(async () => {
      render(<Combobox aria-label="City" options={load} defaultOpen onCreate={onCreate} />)
    })
    await type('Oslo')
    await waitFor(() => expect(calls.at(-1)?.query).toBe('Oslo'))
    expect(rowTexts()).toEqual([])
    await act(async () => calls.at(-1)?.resolve(CITIES.slice(0, 1)))
    expect(rowTexts()).toEqual(['# Germany', 'Berlin', 'Hamburg', '+ Create "Oslo"'])
  })

  test('without a virtual port a long list renders every row', async () => {
    const some = Array.from({ length: 150 }, (_, i) => ({ value: `v${i}`, label: `Option ${i}` }))
    await act(async () => {
      render(<Combobox aria-label="Some" options={some} defaultOpen />)
    })
    expect(rows()).toBe(150)
  })

  test('10,000 options render windowed and keep the keyboard', async () => {
    // happy-dom measures every box as 0: give the scroller its viewport and its scroll length.
    const sizes = { offsetHeight: 320, clientHeight: 320, scrollHeight: 320_000 }
    const originals = Object.keys(sizes).map(
      (prop) => [prop, Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop)] as const,
    )
    for (const [prop, px] of Object.entries(sizes)) {
      Object.defineProperty(HTMLElement.prototype, prop, {
        configurable: true,
        get(this: HTMLElement) {
          return this.dataset['slot'] === 'virtual-list' ? px : 0
        },
      })
    }
    afterEach(() => {
      for (const [prop, descriptor] of originals) {
        if (descriptor) Object.defineProperty(HTMLElement.prototype, prop, descriptor)
        else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[prop]
      }
    })
    const many = Array.from({ length: 10_000 }, (_, i) => ({
      value: `v${i}`,
      label: `Option ${i}`,
    }))
    await act(async () => {
      render(<Combobox aria-label="Big" options={many} defaultOpen virtual={VirtualList} />)
    })
    expect(rows()).toBeGreaterThan(0)
    expect(rows()).toBeLessThan(60)
    for (let i = 0; i < 40; i += 1) {
      await act(async () => {
        fireEvent.keyDown(input(), { key: 'ArrowDown' })
      })
    }
    const active = document.querySelector('[data-slot="option-row"][data-highlighted]')
    // The first key highlights the first row, so forty keys land on the fortieth.
    expect(active?.textContent).toContain('Option 39')
    expect(input().getAttribute('aria-activedescendant')).toBe(active?.id ?? '')
    expect(rows()).toBeLessThan(60)
    // The active row is scrolled into view: the window has moved off the top.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    const scroller = document.querySelector('[data-slot="virtual-list"]') as HTMLElement
    expect(scroller.scrollTop).toBeGreaterThan(0)
  })
})
