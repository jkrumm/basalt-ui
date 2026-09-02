/**
 * `PageTitle` — the shell-less page-title primitive. A plain `<h1>` on purpose (see the module
 * doc) — this pins that it renders one, with the title text as its accessible name.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { PageTitle } from './page-title'

describe('PageTitle', () => {
  test('renders the title as an h1', () => {
    render(<PageTitle title="Something went wrong" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Something went wrong' })).toBeDefined()
  })

  test('renders an optional subtitle below the title', () => {
    render(<PageTitle title="Argo" subtitle="Enter your API bearer token to continue." />)
    expect(screen.getByText('Enter your API bearer token to continue.')).toBeDefined()
  })

  test('omitting subtitle renders no subtitle node', () => {
    const { container } = render(<PageTitle title="Argo" />)
    expect(container.querySelector('p')).toBeNull()
  })

  test('className reaches the root', () => {
    const { container } = render(<PageTitle title="Argo" className="my-title" />)
    expect(container.querySelector('.my-title')).not.toBeNull()
  })

  test('icon renders before the title, aria-hidden', () => {
    const { container } = render(<PageTitle title="Argo" icon={<svg data-testid="icon" />} />)
    expect(screen.getByTestId('icon')).toBeDefined()
    expect(container.querySelector('[aria-hidden="true"] svg')).not.toBeNull()
  })
})
