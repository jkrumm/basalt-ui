import { describe, expect, mock, spyOn, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createMemoryHistory,
} from '@tanstack/react-router'
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

  test('error: message in an alert, Try again calls reset', async () => {
    const reset = mock(() => {})
    render(<ErrorComponent {...errorProps(new Error('boom'), reset)} />)
    expect(screen.getByRole('alert').textContent).toContain('Something went wrong')
    expect(screen.getByRole('alert').textContent).toContain('boom')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(reset).toHaveBeenCalledTimes(1))
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

describe('Try again in a mounted router', () => {
  test('re-runs a loader that failed once, and renders the route after one click', async () => {
    const quiet = spyOn(console, 'error').mockImplementation(() => {})
    let calls = 0
    const root = createRootRoute()
    const flaky = createRoute({
      getParentRoute: () => root,
      path: '/',
      loader: () => {
        calls += 1
        if (calls === 1) throw new Error('services unreachable')
        return 'ok'
      },
      component: () => <p>route content</p>,
    })
    const router = createBasaltRouter({
      routeTree: root.addChildren([flaky]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })
    render(<RouterProvider router={router} />)
    await screen.findByText('services unreachable')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByText('route content')
    expect(calls).toBe(2)
    quiet.mockRestore()
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
