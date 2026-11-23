/**
 * `Composer`: Enter and Shift+Enter, IME composition, the restore of a failed send, the stop button
 * while streaming, and mentions picked from a grouped async list and returned as data.
 */
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ListItems } from '../core/list/options'
import { Composer } from './composer'
import type { ComposerMessage, ComposerProps } from './composer'

afterEach(cleanup)

const noop = (): void => {}

function setup(props: Partial<ComposerProps<string>> = {}) {
  const sent: ComposerMessage<string>[] = []
  const view = render(
    <Composer<string>
      aria-label="Message"
      onSend={(m) => {
        sent.push(m)
      }}
      {...props}
    />,
  )
  const box = view.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement
  const type = (value: string) => fireEvent.change(box, { target: { value } })
  return { ...view, box, sent, type }
}

describe('Composer — sending', () => {
  test('Enter sends the trimmed text and clears; Shift+Enter does not send', () => {
    const { box, sent, type } = setup()
    type('  hello  ')
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true })
    expect(sent).toHaveLength(0)
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(sent).toEqual([{ text: 'hello', mentions: [], files: [] }])
    expect(box.value).toBe('')
  })

  test('the Enter that confirms an IME candidate never sends', () => {
    const { box, sent, type } = setup()
    type('かな')
    fireEvent.keyDown(box, { key: 'Enter', isComposing: true })
    fireEvent.keyDown(box, { key: 'Enter', keyCode: 229 })
    expect(sent).toHaveLength(0)
    expect(box.value).toBe('かな')
  })

  test('a rejected send gives the text back', async () => {
    const { box, type } = setup({ onSend: () => Promise.reject(new Error('offline')) })
    type('draft')
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(box.value).toBe('')
    await waitFor(() => expect(box.value).toBe('draft'))
  })

  test('a send that throws gives the text back; a newer edit beats a late restore', async () => {
    let fail: (reason: unknown) => void = noop
    const { box, type, rerender } = setup({
      onSend: () => {
        throw new Error('no')
      },
    })
    type('first')
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(box.value).toBe('first')
    rerender(
      <Composer<string>
        aria-label="Message"
        onSend={() => new Promise((_, reject) => (fail = reject))}
      />,
    )
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(box.value).toBe('')
    type('newer')
    await act(async () => fail(new Error('late')))
    expect(box.value).toBe('newer')
  })

  test('while streaming the send button is stop, and Enter sends nothing', () => {
    let stopped = 0
    const { box, sent, type, getByRole, queryByRole } = setup({
      status: 'streaming',
      onStop: () => (stopped += 1),
    })
    type('next')
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(sent).toHaveLength(0)
    expect(queryByRole('button', { name: 'Send' })).toBeNull()
    fireEvent.click(getByRole('button', { name: 'Stop' }))
    expect(stopped).toBe(1)
  })
})

describe('Composer — files', () => {
  test('the add menu counts and dedupes against the files already attached', async () => {
    const { getByRole, sent, box } = setup({ files: { maxFiles: 2 } })
    fireEvent.click(getByRole('button', { name: 'Add' }))
    const input = await waitFor(() => {
      const found = document.querySelector('input[type="file"]')
      expect(found).not.toBeNull()
      return found as HTMLInputElement
    })
    const file = (name: string) => new File(['x'], name, { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [file('a.txt'), file('b.txt')] } })
    fireEvent.click(getByRole('button', { name: 'Add' }))
    const again = await waitFor(
      () => document.querySelector('input[type="file"]') as HTMLInputElement,
    )
    fireEvent.change(again, { target: { files: [file('c.txt')] } })
    fireEvent.change(box, { target: { value: 'see attached' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(sent[0]?.files.map((f) => f.name)).toEqual(['a.txt', 'b.txt'])
  })
})

describe('Composer — mentions', () => {
  const people: ListItems<string> = [
    {
      label: 'Suppliers',
      options: [
        { value: 's-1', label: 'Acme Bearings' },
        { value: 's-2', label: 'Nordseal' },
      ],
    },
    {
      label: 'Parts',
      options: [
        { value: 'p-7', label: 'Acme rotor seal' },
        { value: 'p-9', label: 'Hex bolt' },
      ],
    },
  ]
  const queries: string[] = []
  const loader = async (query: string): Promise<ListItems<string>> => {
    queries.push(query)
    const q = query.toLowerCase()
    return people
      .map((group) =>
        'options' in group
          ? {
              ...group,
              options: group.options.filter((o) => String(o.label).toLowerCase().includes(q)),
            }
          : group,
      )
      .filter((group) => !('options' in group) || group.options.length > 0)
  }

  test('@ opens a grouped async list filtered by the text after it', async () => {
    const { type } = setup({ mentions: { source: loader } })
    type('ask @acm')
    const list = await waitFor(() => {
      const found = document.querySelector('[role="listbox"]')
      expect(found?.querySelectorAll('[role="option"]')).toHaveLength(2)
      return found as HTMLElement
    })
    expect(queries.at(-1)).toBe('acm')
    expect(list.textContent).toContain('Suppliers')
    expect(list.textContent).toContain('Parts')
    expect(list.textContent).not.toContain('Hex bolt')
  })

  test('a pick inserts the label and the send returns the mention as data', async () => {
    const { box, sent, type } = setup({ mentions: { source: loader } })
    type('ask @acm')
    await waitFor(() => expect(document.querySelectorAll('[role="option"]')).toHaveLength(2))
    fireEvent.keyDown(box, { key: 'ArrowDown' })
    expect(box.getAttribute('aria-activedescendant')).toBe(
      document.querySelectorAll('[role="option"]')[1]?.id ?? 'missing',
    )
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(box.value).toBe('ask @Acme rotor seal ')
    expect(sent).toHaveLength(0)
    fireEvent.change(box, { target: { value: 'ask @Acme rotor seal stock?' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(sent).toEqual([
      {
        text: 'ask @Acme rotor seal stock?',
        mentions: [{ value: 'p-7', label: 'Acme rotor seal', start: 4, end: 20 }],
        files: [],
      },
    ])
  })

  test('Escape closes the list and keeps the draft; editing into a token drops it', async () => {
    const { box, sent, type } = setup({ mentions: { source: people } })
    type('@nor')
    await waitFor(() => expect(document.querySelector('[role="listbox"]')).not.toBeNull())
    fireEvent.keyDown(box, { key: 'Escape' })
    expect(box.getAttribute('aria-controls')).toBeNull()
    expect(box.value).toBe('@nor')
    type('')
    type('@')
    await waitFor(() => expect(document.querySelectorAll('[role="option"]')).toHaveLength(4))
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(box.value).toBe('@Acme Bearings ')
    type('@Acme Bxarings ')
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(sent[0]?.mentions).toEqual([])
  })

  test('a send forgets a dismissed list, so the next draft opens it at the same place', async () => {
    const { box, type } = setup({ mentions: { source: people } })
    type('@nor')
    await waitFor(() => expect(box.getAttribute('aria-controls')).not.toBeNull())
    fireEvent.keyDown(box, { key: 'Escape' })
    type('@nor x')
    fireEvent.keyDown(box, { key: 'Enter' })
    type('@')
    await waitFor(() => expect(box.getAttribute('aria-controls')).not.toBeNull())
  })
})
