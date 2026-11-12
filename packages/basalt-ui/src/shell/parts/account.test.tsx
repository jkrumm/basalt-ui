/**
 * `RailAccount`: one footer row per state. The 2.x plan/role badge matrix and `showEmail` are
 * gone (v3 has `detail`), so the signed-in tests cover the v3 shape.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { Account } from '../contract'
import { RailAccount } from './account'

afterEach(cleanup)

const mount = (account: Account | undefined): ReturnType<typeof render> =>
  render(<RailAccount account={account} />)

const SIGNED_IN: Account = {
  status: 'signed-in',
  name: 'Johannes Krumm',
  detail: 'jk@example.com',
}

const openMenu = async (): Promise<void> => {
  fireEvent.click(screen.getByLabelText('Account menu'))
  await waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBeNull())
}

describe('every state renders ONE row (the signed-in row is the menu trigger)', () => {
  const states: [string, Account][] = [
    ['loading', { status: 'loading' }],
    ['signed-out', { status: 'signed-out', onSignIn: () => {} }],
    ['signed-in', SIGNED_IN],
  ]
  for (const [name, account] of states) {
    test(name, () => {
      const { container } = mount(account)
      expect(container.children).toHaveLength(1)
      const slot = container.firstElementChild?.getAttribute('data-slot')
      expect(slot).toBe(account.status === 'signed-in' ? 'menu-trigger' : 'shell-rail-account')
    })
  }

  test('no account renders nothing', () => {
    const { container } = mount(undefined)
    expect(container.firstChild).toBeNull()
  })
})

describe('a missing or invalid account throws a named message', () => {
  test('an object without a status', () => {
    expect(() => mount({} as unknown as Account)).toThrow(
      '[basalt] RailAccount: prop "account" must be an object with a "status".',
    )
  })

  test('a non-object', () => {
    expect(() => mount('nope' as unknown as Account)).toThrow('[basalt] RailAccount:')
  })

  test('null', () => {
    expect(() => mount(null as unknown as Account)).toThrow('[basalt] RailAccount:')
  })
})

describe('loading row', () => {
  test('is a skeleton row, hidden from assistive tech', () => {
    const { container } = mount({ status: 'loading' })
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('signed-out row', () => {
  test('is named "Sign in" independent of its text (the collapsed rail hides the text)', () => {
    mount({ status: 'signed-out', onSignIn: () => {} })
    expect(screen.getByRole('button', { name: 'Sign in' }).getAttribute('aria-label')).toBe(
      'Sign in',
    )
  })

  test('calls onSignIn', () => {
    let fired = 0
    mount({ status: 'signed-out', onSignIn: () => (fired += 1) })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(fired).toBe(1)
  })
})

describe('signed-in row', () => {
  test('the row is the menu trigger named "Account menu"', () => {
    const { container } = mount(SIGNED_IN)
    const trigger = screen.getByLabelText('Account menu')
    expect(trigger.contains(container.querySelector('[data-slot="shell-rail-avatar"]'))).toBe(true)
  })

  test('shows the name and the muted detail', () => {
    mount(SIGNED_IN)
    expect(screen.getByText('Johannes Krumm')).toBeTruthy()
    expect(screen.getByText('jk@example.com')).toBeTruthy()
  })

  test('without a detail only the name shows', () => {
    mount({ status: 'signed-in', name: 'Jo' })
    expect(screen.queryByText('jk@example.com')).toBeNull()
    expect(screen.getByText('Jo', { selector: 'span.truncate' })).toBeTruthy()
  })

  test('the avatar falls back to initials of first and last name', () => {
    const { container } = mount(SIGNED_IN)
    expect(container.querySelector('[data-slot="shell-rail-avatar"]')?.textContent).toBe('JK')
  })

  test('a single name gives one initial', () => {
    const { container } = mount({ status: 'signed-in', name: 'cher' })
    expect(container.querySelector('[data-slot="shell-rail-avatar"]')?.textContent).toBe('C')
  })

  test('an avatar image replaces the initials', () => {
    const { container } = mount({ ...SIGNED_IN, avatar: 'https://example.com/a.png' } as Account)
    const img = container.querySelector('img[data-slot="shell-rail-avatar"]')
    expect(img?.getAttribute('src')).toBe('https://example.com/a.png')
    expect(container.querySelector('span[data-slot="shell-rail-avatar"]')).toBeNull()
  })

  test('rows fire their own handlers from the menu', async () => {
    let fired = ''
    mount({
      ...SIGNED_IN,
      rows: [
        { label: 'Manage account', onClick: () => (fired = 'manage') },
        { label: 'Billing', onClick: () => (fired = 'billing') },
      ],
    } as Account)
    await openMenu()
    fireEvent.click(screen.getByText('Billing'))
    expect(fired).toBe('billing')
  })

  test('Sign out appears only with onSignOut and calls it', async () => {
    let fired = 0
    mount({ ...SIGNED_IN, onSignOut: () => (fired += 1) } as Account)
    await openMenu()
    fireEvent.click(screen.getByText('Sign out'))
    expect(fired).toBe(1)
  })

  test('no onSignOut means no Sign out item', async () => {
    mount({ ...SIGNED_IN, rows: [{ label: 'Manage', onClick: () => {} }] } as Account)
    await openMenu()
    expect(screen.queryByText('Sign out')).toBeNull()
    expect(screen.getByText('Manage')).toBeTruthy()
  })

  test('a signed-in row without rows or sign-out still renders', () => {
    mount({ status: 'signed-in', name: 'Jo Doe' })
    expect(screen.getByLabelText('Account menu')).toBeTruthy()
  })
})
