/**
 * `BasaltDevDock` — the render-shape contract (nothing in production, nothing with no tool, the
 * header title per tool, the close affordance). The lazily-loaded panel bodies themselves
 * (`ReactQueryDevtoolsPanel`, `TanStackRouterDevtoolsPanel`, `ThemeLabControls`) each need their
 * own live provider (`QueryClient`, `Router`) or peer — out of scope for this unit tier, which
 * only proves the dock's own chrome (title/close/production gate), matching the level of coverage
 * `query-devtools.tsx`'s own `BasaltQueryDevtools` has today (none — it is a thin, directly
 * inspectable wrapper).
 */
import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { BasaltDevDock } from './dev-dock'

const originalEnv = process.env['NODE_ENV']

afterEach(() => {
  if (originalEnv === undefined) delete process.env['NODE_ENV']
  else process.env['NODE_ENV'] = originalEnv
})

describe('BasaltDevDock — render shape', () => {
  test('tool: null renders no dock chrome', () => {
    render(
      <MantineProvider>
        <BasaltDevDock tool={null} onClose={() => {}} />
      </MantineProvider>,
    )
    expect(screen.queryByLabelText('Close devtools')).toBeNull()
  })

  test('production renders no dock chrome even with a tool selected', () => {
    process.env['NODE_ENV'] = 'production'
    render(
      <MantineProvider>
        <BasaltDevDock tool="theme" onClose={() => {}} />
      </MantineProvider>,
    )
    expect(screen.queryByLabelText('Close devtools')).toBeNull()
  })

  test('tool: "theme" shows the Theme Lab title', () => {
    render(
      <MantineProvider>
        <BasaltDevDock tool="theme" onClose={() => {}} />
      </MantineProvider>,
    )
    expect(screen.getByText('Theme Lab')).toBeDefined()
  })

  test('the close button fires onClose', () => {
    let closed = false
    render(
      <MantineProvider>
        <BasaltDevDock tool="theme" onClose={() => (closed = true)} />
      </MantineProvider>,
    )
    screen.getByLabelText('Close devtools').click()
    expect(closed).toBe(true)
  })
})
