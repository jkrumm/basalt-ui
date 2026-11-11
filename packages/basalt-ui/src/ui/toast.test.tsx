import { Toast as BaseToast } from '@base-ui/react/toast'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { IntlScope } from '../core/provider-props'
import { Toast, ToastClose, ToastDescription, ToastTitle, ToastViewport, toastParts } from './toast'

afterEach(cleanup)

const TOAST = { id: 'a', title: 'Saved', description: 'Project renamed.' }

function Stack(props: { tone?: 'good' | 'bad' }): ReactElement {
  return (
    <BaseToast.Provider>
      <ToastViewport>
        <Toast toast={TOAST} {...(props.tone === undefined ? {} : { tone: props.tone })}>
          <ToastTitle />
          <ToastDescription />
          <ToastClose />
        </Toast>
      </ToastViewport>
    </BaseToast.Provider>
  )
}

describe('toast module', () => {
  test('the viewport is a labelled live region in the body and every slot is listed', () => {
    const { container } = render(<Stack />)
    expect(container.querySelector('[data-slot]')).toBeNull()
    const region = document.querySelector('[data-slot="toast-viewport"]')
    expect(region?.getAttribute('role')).toBe('region')
    expect(region?.getAttribute('aria-label')).toBe('Notifications')
    for (const el of document.querySelectorAll('[data-slot]')) {
      expect(toastParts as readonly string[]).toContain(el.getAttribute('data-slot') ?? '')
    }
  })

  test('the toast carries its own title and description, and the tone picks the edge', () => {
    render(<Stack tone="bad" />)
    expect(document.querySelector('[data-slot="toast-title"]')?.textContent).toBe('Saved')
    expect(document.querySelector('[data-slot="toast-description"]')?.textContent).toBe(
      'Project renamed.',
    )
    expect(document.querySelector('[data-slot="toast"]')?.className).toContain('border-s-bad')
  })

  test('toast.viewport and toast.dismiss come from the catalog and an override replaces them', () => {
    render(<Stack />)
    expect(document.querySelector('[data-slot="toast-close"]')?.getAttribute('aria-label')).toBe(
      'Dismiss',
    )
    cleanup()
    render(
      <IntlScope messages={{ 'toast.viewport': 'Hinweise', 'toast.dismiss': 'Schließen' }}>
        <Stack />
      </IntlScope>,
    )
    expect(document.querySelector('[data-slot="toast-viewport"]')?.getAttribute('aria-label')).toBe(
      'Hinweise',
    )
    expect(document.querySelector('[data-slot="toast-close"]')?.getAttribute('aria-label')).toBe(
      'Schließen',
    )
  })
})
