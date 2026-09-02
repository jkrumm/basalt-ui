/**
 * `SidebarAccount` — the two halves of the `common/props.ts` + `common/validate.ts` contract, on a
 * component that has THREE roots rather than one. `state.status` picks between a skeleton `Group`,
 * an unauthenticated `UnstyledButton` and the `Menu.Target` button, so "className reaches the root"
 * is three assertions, not one: the branch that dropped it would have looked fine in every other.
 *
 * CSS-module hashes are unavailable under `bun test` (`classes.accountRow` resolves to `''`), so
 * each row is found by the class the CALLER passed.
 */
import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { SidebarAccount } from './app-sidebar-account'
import type { BasaltAccountProps } from './account-types'

const IDENTITY = { id: 'u1', name: 'Johannes Krumm', email: 'jk@example.com' }

function mount(node: ReactNode) {
  return render(<MantineProvider>{node}</MantineProvider>)
}

describe('className reaches the root of every state branch', () => {
  const branches: [string, BasaltAccountProps['state']][] = [
    ['loading', { status: 'loading' }],
    ['unauthenticated', { status: 'unauthenticated' }],
    ['authenticated', { status: 'authenticated', identity: IDENTITY }],
  ]

  for (const [name, state] of branches) {
    test(name, () => {
      const { container, unmount } = mount(
        <SidebarAccount state={state} className="my-account" style={{ marginTop: '3px' }} />,
      )
      const root = container.querySelector('.my-account')
      expect(root).not.toBeNull()
      expect(root?.getAttribute('style') ?? '').toContain('margin-top: 3px')
      unmount()
    })
  }

  test('the authenticated row is the menu trigger, and it carries the class', () => {
    mount(
      <SidebarAccount
        state={{ status: 'authenticated', identity: IDENTITY }}
        className="my-account"
      />,
    )
    expect(screen.getByLabelText('Account menu').classList.contains('my-account')).toBe(true)
  })
})

// F-ERR-1: `state` is read for its `status` on the first line of the body, so a missing one used to
// surface as a raw `TypeError` swallowed by `BasaltErrorBoundary` — a blank sidebar footer.
describe('a missing `state` throws a named message', () => {
  test('SidebarAccount names itself and the prop', () => {
    expect(() => mount(<SidebarAccount {...({} as unknown as BasaltAccountProps)} />)).toThrow(
      '[basalt] SidebarAccount: prop "state" is required.',
    )
  })
})
