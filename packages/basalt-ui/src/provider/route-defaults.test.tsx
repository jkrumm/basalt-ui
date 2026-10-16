import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { createRootRoute } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { createBasaltRouter } from './create-router'

// The route defaults render at the route that failed — possibly ABOVE `BasaltProvider` — so none of
// them may need a MantineProvider.
const options = createBasaltRouter({ routeTree: createRootRoute() }).options
const Pending = options.defaultPendingComponent as () => React.ReactNode
const NotFound = options.defaultNotFoundComponent as () => React.ReactNode
const ErrorScreen = options.defaultErrorComponent as (
  p: Pick<ErrorComponentProps, 'error' | 'reset'>,
) => React.ReactNode

describe('router defaults render without a provider', () => {
  test('pending: an accessible status spinner', () => {
    render(<Pending />)
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Loading')
    expect(renderToString(<Pending />)).toContain('<output')
  })

  test('error: message in an alert, Try again calls reset', () => {
    const reset = mock(() => {})
    const props = { error: new Error('boom'), reset, info: undefined }
    render(<ErrorScreen {...props} />)
    expect(screen.getByRole('alert').textContent).toContain('Something went wrong')
    expect(screen.getByRole('alert').textContent).toContain('boom')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(reset).toHaveBeenCalledTimes(1)
    expect(renderToString(<ErrorScreen {...props} />)).toContain('boom')
  })

  test('not-found: its text', () => {
    render(<NotFound />)
    expect(screen.getByText('Page not found')).toBeDefined()
    expect(renderToString(<NotFound />)).toContain('This address does not match any page.')
  })
})
