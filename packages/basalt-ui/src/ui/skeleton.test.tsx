import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { IntlScope } from '../core/provider-props'
import { Skeleton, Spinner, skeletonParts, skeletonVariants } from './skeleton'

afterEach(cleanup)

describe('skeleton module', () => {
  test('every part carries data-slot and skeletonParts lists them', () => {
    const { container } = render(
      <>
        <Skeleton />
        <Spinner />
      </>,
    )
    const slots = [...container.querySelectorAll('[data-slot]')].map((el) =>
      el.getAttribute('data-slot'),
    )
    expect(slots).toEqual([...skeletonParts])
  })

  test('server render keeps the slots', () => {
    const html = renderToString(
      <>
        <Skeleton />
        <Spinner />
      </>,
    )
    expect(html).toContain('data-slot="skeleton"')
    expect(html).toContain('data-slot="spinner"')
  })
})

describe('skeleton floor', () => {
  test('a Skeleton is one line of the surrounding text: 1lh high, never a fixed height', () => {
    const classes = skeletonVariants().split(' ')
    expect(classes).toContain('h-lh')
    expect(classes.some((c) => /^(h|min-h|size)-(?!lh$)/.test(c))).toBe(false)
  })

  test('layout classes narrow it and the height stays', () => {
    const { container } = render(<Skeleton className="w-40 text-lg" />)
    const el = container.firstElementChild as HTMLElement
    expect(el.className).toContain('w-40')
    expect(el.className).toContain('h-lh')
  })

  test('the pulse is motion-safe only and the box is hidden from assistive tech', () => {
    const { container } = render(<Skeleton />)
    const el = container.firstElementChild as HTMLElement
    expect(el.className).toContain('motion-safe:animate-pulse')
    expect(el.className).not.toMatch(/(^| )animate-/)
    expect(el.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('Spinner', () => {
  test('is a status named Loading with no provider', () => {
    const { getByRole } = render(<Spinner />)
    expect(getByRole('status').getAttribute('aria-label')).toBe('Loading')
  })

  test('the name follows the provider messages', () => {
    const { getByRole } = render(
      <IntlScope messages={{ 'base.spinner.loading': 'Lädt' }}>
        <Spinner />
      </IntlScope>,
    )
    expect(getByRole('status').getAttribute('aria-label')).toBe('Lädt')
  })

  test('is one line high and turns only when motion is allowed', () => {
    const { container } = render(<Spinner />)
    const el = container.firstElementChild as HTMLElement
    expect(el.className).toContain('w-lh')
    expect(el.className).toContain('motion-safe:[&>svg]:animate-spin')
    expect(el.className).not.toMatch(/(^| )animate-/)
  })
})
