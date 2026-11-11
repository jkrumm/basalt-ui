import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { IntlScope } from '../core/provider-props'
import { notify, resetNotify } from '../core/notify'
import { ToastHost } from './toast-host'

beforeEach(resetNotify)
afterEach(() => {
  cleanup()
  resetNotify()
})

const toasts = (): Element[] => [...document.querySelectorAll('[data-slot="toast"]')]

describe('ToastHost', () => {
  test('a notification sent before the host mounted is shown after it (S5)', async () => {
    notify('success', { message: 'Saved' })
    render(<ToastHost />)
    await act(async () => {})
    expect(toasts()).toHaveLength(1)
    expect(toasts()[0]?.textContent).toContain('Saved')
    expect(toasts()[0]?.className).toContain('border-s-good')
  })

  test('title and message both render, and an error takes the bad tone', async () => {
    render(<ToastHost />)
    await act(async () => {
      notify('error', { title: 'photo.jpg', message: 'Upload failed' })
    })
    expect(document.querySelector('[data-slot="toast-title"]')?.textContent).toBe('photo.jpg')
    expect(document.querySelector('[data-slot="toast-description"]')?.textContent).toBe(
      'Upload failed',
    )
    expect(toasts()[0]?.className).toContain('border-s-bad')
  })

  test('the viewport is a named, polite region hidden in print; an error mirrors into role=alert', async () => {
    render(<ToastHost />)
    await act(async () => {
      notify('error', { message: 'Boom' })
    })
    const region = document.querySelector('[data-slot="toast-viewport"]')
    expect(region?.getAttribute('role')).toBe('region')
    expect(region?.getAttribute('aria-live')).toBe('polite')
    expect(region?.getAttribute('aria-label')).toBe('Notifications')
    expect(region?.className).toContain('print:hidden')
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Boom')
  })

  test('the Undo action reverts once, closes the toast, and never takes focus', async () => {
    let runs = 0
    render(<ToastHost />)
    const before = document.activeElement
    await act(async () => {
      notify('success', { message: 'Deleted', undo: { revert: () => void (runs += 1) } })
    })
    expect(document.activeElement).toBe(before)
    const undo = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Undo')
    expect(undo).toBeDefined()
    await act(async () => {
      fireEvent.click(undo!)
    })
    expect(runs).toBe(1)
  })

  test('toast.undo is overridable through the messages prop', async () => {
    render(
      <IntlScope messages={{ 'toast.undo': 'Rückgängig' }}>
        <ToastHost />
      </IntlScope>,
    )
    await act(async () => {
      notify('info', { message: 'x', undo: { revert: () => {} } })
    })
    expect(document.body.textContent).toContain('Rückgängig')
  })
})
