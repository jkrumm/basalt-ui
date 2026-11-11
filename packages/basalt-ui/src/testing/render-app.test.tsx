/** `renderApp` seed: provider wrap, scheme on `data-theme`, UTC, explicit cleanup. */
import { screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'

import { useProviderContext } from '../core/provider'
import { cleanupApp, renderApp } from './render-app'

afterEach(cleanupApp)

function Probe() {
  const { locale } = useProviderContext()
  return <p data-testid="probe">{locale}</p>
}

function SchemeProbe() {
  return <p data-testid="scheme">{useProviderContext().scheme}</p>
}

describe('renderApp', () => {
  test('renders inside the provider with the default locale', () => {
    renderApp(<Probe />)
    expect(screen.getByTestId('probe').textContent).toBe('en')
  })

  test('forwards the locale option to the provider', () => {
    renderApp(<Probe />, { locale: 'de' })
    expect(screen.getByTestId('probe').textContent).toBe('de')
  })

  test('applies the scheme option to data-theme before any assertion', () => {
    renderApp(<Probe />, { scheme: 'dark' })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  test('the provider context sees the scheme option', () => {
    renderApp(<SchemeProbe />, { scheme: 'dark' })
    expect(screen.getByTestId('scheme').textContent).toBe('dark')
  })

  test('scheme auto removes the attribute', () => {
    document.documentElement.setAttribute('data-theme', 'dark')
    renderApp(<Probe />, { scheme: 'auto' })
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  test('leaves data-theme alone when no scheme is given', () => {
    document.documentElement.setAttribute('data-theme', 'light')
    renderApp(<Probe />)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  test('pins the time zone to UTC', () => {
    renderApp(<Probe />)
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('UTC')
    expect(new Date('2026-01-01T00:00:00Z').getHours()).toBe(0)
  })

  test('cleanupApp unmounts and restores data-theme, lang and TZ', () => {
    const before = process.env.TZ
    renderApp(<Probe />, { scheme: 'dark', locale: 'de' })
    cleanupApp()
    expect(screen.queryByTestId('probe')).toBeNull()
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    expect(document.documentElement.hasAttribute('lang')).toBe(false)
    expect(process.env.TZ).toBe(before)
  })
})
