import { describe, expect, mock, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fireEvent, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { createRootRoute } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { createBasaltRouter } from './create-router'
import { ErrorComponent, NotFoundComponent, PendingComponent } from './route-defaults'

// The route defaults render at the route that failed — possibly ABOVE `BasaltProvider` — so none of
// them may need a MantineProvider.
const errorProps = (error: unknown, reset = () => {}) =>
  ({ error, reset }) satisfies ErrorComponentProps

describe('router defaults render without a provider', () => {
  test('pending: an accessible status spinner', () => {
    render(<PendingComponent />)
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Loading')
    const html = renderToString(<PendingComponent />)
    expect(html).toContain('<output')
    expect(html).toContain('aria-label="Loading"')
  })

  test('error: message in an alert, Try again calls reset', () => {
    const reset = mock(() => {})
    render(<ErrorComponent {...errorProps(new Error('boom'), reset)} />)
    expect(screen.getByRole('alert').textContent).toContain('Something went wrong')
    expect(screen.getByRole('alert').textContent).toContain('boom')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(reset).toHaveBeenCalledTimes(1)
    expect(renderToString(<ErrorComponent {...errorProps(new Error('boom'))} />)).toContain('boom')
  })

  test.each([
    ['a thrown string', 'plain'],
    ['undefined', undefined],
    ['a message-less object', {}],
  ])('error: %s never renders "undefined" and does not crash', (_name, error) => {
    const html = renderToString(<ErrorComponent {...errorProps(error)} />)
    expect(html).not.toContain('undefined')
    expect(html).toContain('Try again')
  })

  test('not-found: its text', () => {
    render(<NotFoundComponent />)
    expect(screen.getByText('Page not found')).toBeDefined()
    expect(renderToString(<NotFoundComponent />)).toContain('This address does not match any page.')
  })
})

describe('createBasaltRouter wiring', () => {
  test('wires the defaults', () => {
    const { options } = createBasaltRouter({ routeTree: createRootRoute() })
    expect(options.defaultPendingComponent).toBe(PendingComponent)
    expect(options.defaultErrorComponent).toBe(ErrorComponent)
    expect(options.defaultNotFoundComponent).toBe(NotFoundComponent)
  })

  test('a consumer-supplied component overrides the default', () => {
    const Own = () => null
    const { options } = createBasaltRouter({ routeTree: createRootRoute() })
    const merged = { ...options, defaultPendingComponent: Own, defaultErrorComponent: Own }
    expect(merged.defaultPendingComponent).toBe(Own)
    expect(merged.defaultNotFoundComponent).toBe(NotFoundComponent)
  })
})

describe('fallback stylesheets', () => {
  test.each(['fallback.module.css', 'route-defaults.module.css', 'error-fallback.module.css'])(
    '%s: every var(--vx-*) read has a literal fallback',
    (file) => {
      const css = readFileSync(new URL(file, import.meta.url), 'utf8')
      const bare = css.match(/var\(--vx-[\w-]+\)/g)
      expect(bare).toBeNull()
    },
  )
})
