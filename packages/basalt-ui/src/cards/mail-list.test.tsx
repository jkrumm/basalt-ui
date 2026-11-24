import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { BulkBar } from '../table/parts/bulk-bar'
import { MailList } from './mail-list'
import type { MailItem, MailListProps } from './mail-list'
import { MailThread } from './mail-thread'
import { VirtualList } from '../ui/virtual-list'

// happy-dom measures every box as 0, which the window reads as "nothing visible".
// virtual-core reads offsetHeight up to 3.19.5 and clientHeight from 3.19.6 on.
const sizeProps = ['offsetHeight', 'clientHeight'] as const
const originals = sizeProps.map(
  (p) => [p, Object.getOwnPropertyDescriptor(HTMLElement.prototype, p)] as const,
)
beforeEach(() => {
  for (const p of sizeProps) {
    Object.defineProperty(HTMLElement.prototype, p, {
      configurable: true,
      get(this: HTMLElement) {
        return this.dataset['slot'] === 'virtual-list' ? 800 : 0
      },
    })
  }
})
afterEach(() => {
  cleanup()
  for (const [p, original] of originals) {
    if (original) Object.defineProperty(HTMLElement.prototype, p, original)
    else Reflect.deleteProperty(HTMLElement.prototype, p)
  }
})

const NOW = Date.UTC(2026, 10, 23, 9, 0)
const HOUR = 3_600_000
const DAY = 24 * HOUR

const ITEMS: MailItem[] = [
  {
    id: 'm1',
    from: { name: 'Lena Brandt', org: { name: 'Nordwerk' } },
    subject: 'PO-1042 confirmed',
    snippet: 'We confirm the order for 400 bearings.',
    at: NOW - HOUR,
    unread: true,
    starred: true,
    count: 3,
    entity: { label: 'PO-1042' },
  },
  {
    id: 'm2',
    from: { name: 'Karim Haddad' },
    subject: 'Revised lead time',
    snippet: 'The seals ship a week later.',
    at: NOW - DAY - HOUR,
    attachments: true,
  },
  {
    id: 'm3',
    from: { name: 'Ines Vogel' },
    subject: 'Invoice 7781',
    snippet: 'Attached the invoice.',
    at: NOW - 40 * DAY,
  },
]

function Harness(props: Partial<MailListProps>): ReactElement {
  const [selected, setSelected] = useState<readonly string[]>([])
  return (
    <MailList
      label="Inbox"
      items={ITEMS}
      now={NOW}
      onOpen={() => undefined}
      selected={selected}
      onSelectedChange={setSelected}
      virtual={VirtualList}
      bulk={
        <BulkBar
          count={selected.length}
          onClear={() => setSelected([])}
          actions={[{ id: 'archive', label: 'Archive', onClick: () => undefined }]}
        />
      }
      {...props}
    />
  )
}

describe('MailList', () => {
  test('heads runs by period and keeps the caller order', () => {
    const { container } = render(<Harness />)
    const headers = [...container.querySelectorAll('[data-slot="mail-list-header"]')].map(
      (h) => h.textContent,
    )
    expect(headers).toEqual(['Today· 1', 'Yesterday· 1', 'October· 1'])
    const rows = [...container.querySelectorAll('[data-slot="mail-row"]')].map((r) =>
      r.querySelector('[data-mail-open]')?.getAttribute('data-mail-open'),
    )
    expect(rows).toEqual(['m1', 'm2', 'm3'])
  })

  test('an unread row carries the dot and names itself unread', () => {
    const { container } = render(<Harness />)
    const first = container.querySelector('[data-slot="mail-row"]')
    expect(first?.hasAttribute('data-unread')).toBe(true)
    expect(first?.querySelector('[data-slot="mail-unread"]')).not.toBeNull()
    expect(
      screen.getByRole('button', { name: 'Unread, Lena Brandt, PO-1042 confirmed' }),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Karim Haddad, Revised lead time' })).toBeTruthy()
  })

  test('opens a row on click and marks the open one current', () => {
    const onOpen = mock((id: string) => id)
    render(<Harness onOpen={onOpen} open="m2" />)
    fireEvent.click(screen.getByRole('button', { name: 'Unread, Lena Brandt, PO-1042 confirmed' }))
    expect(onOpen).toHaveBeenCalledWith('m1')
    expect(
      screen
        .getByRole('button', { name: 'Karim Haddad, Revised lead time' })
        .getAttribute('aria-current'),
    ).toBe('true')
  })

  test('selection marks the list as selecting and shows the bulk bar inside it', () => {
    const { container } = render(<Harness />)
    expect(container.querySelector('[data-slot="mail-list-bulk"]')).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Revised lead time' }))
    const list = container.querySelector('[data-slot="mail-list"]')
    expect(list?.hasAttribute('data-selecting')).toBe(true)
    const bar = container.querySelector('[data-slot="mail-list-bulk"] [role="toolbar"]')
    expect(bar?.textContent).toContain('1 selected')
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(list?.hasAttribute('data-selecting')).toBe(false)
  })

  test('x toggles the focused row, arrows move focus between rows', () => {
    render(<Harness />)
    const first = screen.getByRole('button', { name: 'Unread, Lena Brandt, PO-1042 confirmed' })
    first.focus()
    fireEvent.keyDown(first, { key: 'x' })
    expect(
      (
        screen.getByRole('checkbox', { name: 'Select PO-1042 confirmed' }) as HTMLElement
      ).getAttribute('aria-checked'),
    ).toBe('true')
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Karim Haddad, Revised lead time' }),
    )
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'End' })
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Ines Vogel, Invoice 7781' }),
    )
  })

  test('the star is a toggle button when onStar is given', () => {
    const onStar = mock((item: MailItem, on: boolean) => [item.id, on])
    render(<Harness onStar={onStar} />)
    const star = screen.getAllByRole('button', { name: 'Remove star' })[0] as HTMLElement
    expect(star.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(star)
    expect(onStar.mock.calls[0]?.[1]).toBe(false)
  })

  test('an empty mailbox says so', () => {
    render(<Harness items={[]} />)
    expect(screen.getByText('No mail here')).toBeTruthy()
  })
})

describe('BulkBar list form', () => {
  test('renders nothing at 0 and the count and actions otherwise', () => {
    const onClick = mock(() => undefined)
    const { container, rerender } = render(
      <BulkBar
        count={0}
        onClear={() => undefined}
        actions={[{ id: 'a', label: 'Archive', onClick }]}
      />,
    )
    expect(container.firstChild).toBeNull()
    rerender(
      <BulkBar
        count={2}
        onClear={() => undefined}
        actions={[{ id: 'a', label: 'Archive', onClick }]}
      />,
    )
    expect(screen.getByRole('toolbar', { name: 'Bulk actions' }).textContent).toContain(
      '2 selected',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('MailThread', () => {
  const MESSAGES = [
    { id: 'a', from: { name: 'Lena Brandt' }, at: NOW - 2 * DAY, body: 'Can you confirm PO-1042?' },
    { id: 'b', from: { name: 'Mara Okafor' }, at: NOW - DAY, body: 'Confirmed on our side.' },
    {
      id: 'c',
      from: { name: 'Lena Brandt', address: 'lena@nordwerk.example' },
      at: NOW - HOUR,
      body: 'Shipping Friday.\nInvoice attached.',
      attachments: [{ name: 'invoice-7781.pdf', kind: 'PDF', size: 421_888, href: '/files/7781' }],
    },
  ]

  test('opens the latest message, one at a time', () => {
    const { container } = render(<MailThread label="PO-1042" messages={MESSAGES} />)
    const triggers = screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-expanded'))
    expect(triggers.map((b) => b.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'true'])
    expect(container.textContent).toContain('lena@nordwerk.example')
    expect(
      screen.getByRole('link', { name: 'Download invoice-7781.pdf' }).getAttribute('href'),
    ).toBe('/files/7781')
    fireEvent.click(triggers[0] as HTMLElement)
    const after = screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-expanded'))
    expect(after.map((b) => b.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false'])
  })

  test('draws the reply at the foot', () => {
    render(
      <MailThread
        label="PO-1042"
        messages={MESSAGES}
        reply={<button type="button">Reply</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'Reply' })).toBeTruthy()
  })
})
