/**
 * `notifyUndo` / `notifyUndoable` (audit B #13) — the undo window the toast layer was missing.
 *
 * The invariant under test is the coupling the audit named: the Undo affordance and the commit
 * delay are ONE number, and exactly one of `onUndo` / `onExpire` ever runs, exactly once. Fake
 * timers drive the window so the expiry is asserted, not waited on.
 */
import { MantineProvider } from '@mantine/core'
import { Notifications, notifications } from '@mantine/notifications'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test'
import { clear, useNotificationHistory } from './store'
import { notifyUndo, notifyUndoable } from './notify'

beforeEach(() => {
  clear()
  jest.useFakeTimers()
})

afterEach(() => {
  // Mantine's notification store is module-level and outlives the DOM that Testing Library's
  // auto-cleanup tears down — an unclosed toast would render again in the next test that mounts
  // <Notifications />, and its auto-close timer would still be pending under fake timers.
  act(() => {
    notifications.clean()
    notifications.cleanQueue()
  })
  jest.useRealTimers()
})

/** Reads the persisted history so the recorded message is asserted through the public hook. */
function HistoryProbe() {
  const { items } = useNotificationHistory()
  return <span data-testid="messages">{items.map((item) => item.message).join('|')}</span>
}

describe('notifyUndo', () => {
  test('the window elapsing runs onExpire exactly once', () => {
    let undone = 0
    let expired = 0
    notifyUndo({
      message: 'Item deleted',
      onUndo: () => {
        undone++
      },
      onExpire: () => {
        expired++
      },
    })

    // Default window is 6000ms — nothing has committed one tick before it.
    jest.advanceTimersByTime(5999)
    expect(expired).toBe(0)

    jest.advanceTimersByTime(1)
    expect(expired).toBe(1)
    expect(undone).toBe(0)

    // The timer is spent — a later tick cannot commit a second time.
    jest.advanceTimersByTime(60_000)
    expect(expired).toBe(1)
  })

  test('a custom window is the one number that moves', () => {
    let expired = 0
    notifyUndo({
      message: 'Item deleted',
      window: 1500,
      onUndo: () => {},
      onExpire: () => {
        expired++
      },
    })

    jest.advanceTimersByTime(1499)
    expect(expired).toBe(0)
    jest.advanceTimersByTime(1)
    expect(expired).toBe(1)
  })

  test('dismiss() settles the window immediately — the commit is never stranded', () => {
    let undone = 0
    let expired = 0
    const handle = notifyUndo({
      message: 'Item deleted',
      onUndo: () => {
        undone++
      },
      onExpire: () => {
        expired++
      },
    })

    handle.dismiss()
    expect(expired).toBe(1)
    expect(undone).toBe(0)

    // Idempotent, and the cleared timer cannot fire behind it.
    handle.dismiss()
    jest.advanceTimersByTime(60_000)
    expect(expired).toBe(1)
  })

  test('the toast offers Undo, and clicking it reverts without ever committing', () => {
    let undone = 0
    let expired = 0

    render(
      <MantineProvider>
        <Notifications />
      </MantineProvider>,
    )

    act(() => {
      notifyUndo({
        message: 'Item deleted',
        onUndo: () => {
          undone++
        },
        onExpire: () => {
          expired++
        },
      })
    })

    expect(screen.getByText('Item deleted')).not.toBeNull()
    const undo = screen.getByRole('button', { name: 'Undo' })

    act(() => {
      undo.click()
    })

    expect(undone).toBe(1)
    expect(expired).toBe(0)

    // The window is cancelled, not merely hidden — onExpire never runs after an undo.
    act(() => {
      jest.advanceTimersByTime(60_000)
    })
    expect(undone).toBe(1)
    expect(expired).toBe(0)
  })

  test('the history records the plain text, not the composed toast body', () => {
    act(() => {
      notifyUndo({ message: 'Item deleted', onUndo: () => {} })
    })
    render(<HistoryProbe />)

    expect(screen.getByTestId('messages').textContent).toBe('Item deleted')
  })
})

describe('notifyUndoable', () => {
  test('commits the mutation when the window elapses', () => {
    let mutated = 0
    let reverted = 0
    notifyUndoable(
      () => {
        mutated++
      },
      () => {
        reverted++
      },
      { message: 'Item deleted', window: 1000 },
    )

    jest.advanceTimersByTime(1000)
    expect(mutated).toBe(1)
    expect(reverted).toBe(0)
  })

  test('reverts and never mutates when undone', () => {
    let mutated = 0
    let reverted = 0

    render(
      <MantineProvider>
        <Notifications />
      </MantineProvider>,
    )

    act(() => {
      notifyUndoable(
        () => {
          mutated++
        },
        () => {
          reverted++
        },
        { message: 'Item deleted' },
      )
    })

    act(() => {
      screen.getByRole('button', { name: 'Undo' }).click()
    })
    act(() => {
      jest.advanceTimersByTime(60_000)
    })

    expect(reverted).toBe(1)
    expect(mutated).toBe(0)
  })
})
