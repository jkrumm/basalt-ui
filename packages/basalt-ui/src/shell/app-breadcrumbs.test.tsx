/** `AppBreadcrumbs`' four crumb shapes: section, parent (link or plain text) and the page. */
import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import type { NavAnchor } from './nav-types'
import { AppBreadcrumbs } from './app-breadcrumbs'
import type { AppBreadcrumbsProps } from './app-breadcrumbs'

const ParentLink: NavAnchor = (props) => createElement('a', { ...props, href: '/dashboard' })

const show = (props: AppBreadcrumbsProps) =>
  render(
    <MantineProvider>
      <AppBreadcrumbs {...props} />
    </MantineProvider>,
  )

afterEach(cleanup)

describe('AppBreadcrumbs', () => {
  test('renders nothing without a page', () => {
    const { container } = render(
      <MantineProvider>
        <AppBreadcrumbs section="Main" />
      </MantineProvider>,
    )
    expect(container.querySelector('.mantine-Group-root')).toBeNull()
  })

  test('the page alone is a single crumb', () => {
    show({ page: 'Home' })
    expect(screen.getByText('Home')).toBeDefined()
    expect(document.querySelector('a')).toBeNull()
  })

  test('section / page shows the section as plain text', () => {
    show({ section: 'Main', page: 'Home' })
    expect(screen.getByText('Main').closest('a')).toBeNull()
    expect(screen.getByText('Home')).toBeDefined()
  })

  test('a parent with an anchor renders as a link through that anchor', () => {
    show({ section: 'Main', parent: 'Dashboard', parentAnchor: ParentLink, page: 'Sessions' })
    expect(screen.getByText('Dashboard').closest('a')?.getAttribute('href')).toBe('/dashboard')
    expect(screen.getByText('Sessions').closest('a')).toBeNull()
  })

  test('a parent without an anchor is plain text', () => {
    show({ section: 'Main', parent: 'Dashboard', page: 'Sessions' })
    expect(screen.getByText('Dashboard')).toBeDefined()
    expect(document.querySelector('a')).toBeNull()
  })
})
