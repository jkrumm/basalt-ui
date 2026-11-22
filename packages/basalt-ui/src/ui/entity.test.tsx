import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { LinkContext } from '../core/link'
import { EntityChip, EntityTitle, entityParts } from './entity'

afterEach(cleanup)

describe('EntityTitle', () => {
  test('is inline text by default: no heading, an inline-flex row', () => {
    const { container } = render(<EntityTitle title="Acme" subtitle="acme.com" />)
    const el = container.firstElementChild as HTMLElement
    expect(el.getAttribute('data-slot')).toBe('entity-title')
    expect(el.className).toContain('inline-flex')
    expect(container.querySelector('h1,h2,h3,h4,h5,h6')).toBeNull()
    expect(el.textContent).toBe('Acmeacme.com')
  })

  test('a level draws the title as that heading and the row as a block', () => {
    const { container } = render(<EntityTitle title="Acme" level={1} />)
    expect(container.querySelector('h1')?.textContent).toBe('Acme')
    expect((container.firstElementChild as HTMLElement).className).not.toContain('inline-flex')
  })

  test('an avatar prop draws a hidden face named by the title, with its initials', () => {
    const { container } = render(<EntityTitle title="Ada Lovelace" avatar={{}} />)
    const face = container.querySelector('[data-slot="avatar"]') as HTMLElement
    expect(face.getAttribute('aria-hidden')).toBe('true')
    expect(face.textContent).toBe('AL')
    cleanup()
    expect(
      render(<EntityTitle title="Acme" />).container.querySelector('[data-slot="avatar"]'),
    ).toBeNull()
  })

  test('size pairs the face and the type', () => {
    const { container } = render(
      <EntityTitle title="Acme" size="lg" avatar={{ shape: 'object' }} />,
    )
    expect(container.querySelector('[data-slot="avatar"]')?.className).toContain('size-12')
    expect(container.querySelector('.text-base')).not.toBeNull()
  })

  test('tags trail the text', () => {
    const { container } = render(
      <EntityTitle title="Acme" tags={<b data-testid="tag">Customer</b>} />,
    )
    expect(container.querySelector('[data-testid="tag"]')).not.toBeNull()
  })

  test('href makes the title a link through the installed link', () => {
    const { container } = render(<EntityTitle title="Acme" href="/companies/acme" />)
    const a = container.querySelector('a') as HTMLAnchorElement
    expect(a.getAttribute('href')).toBe('/companies/acme')
    expect(a.textContent).toBe('Acme')
  })

  test('href goes through the installed LinkComponent', () => {
    const seen: unknown[] = []
    const { container } = render(
      <LinkContext.Provider
        value={(p) => {
          seen.push(p.href)
          return <span data-custom="">{p.children}</span>
        }}
      >
        <EntityTitle title="Acme" href="/c/1" />
      </LinkContext.Provider>,
    )
    expect(seen).toEqual(['/c/1'])
    expect(container.querySelector('[data-custom]')).not.toBeNull()
  })
})

describe('EntityChip', () => {
  test('a plain chip is a 28 px pill with the label and no link or button', () => {
    const { container } = render(<EntityChip label="Acme" />)
    const el = container.firstElementChild as HTMLElement
    expect(el.getAttribute('data-slot')).toBe('entity-chip')
    expect(el.className).toContain('h-7')
    expect(el.textContent).toBe('Acme')
    expect(container.querySelector('a, button')).toBeNull()
  })

  test('href makes the label a link and a face sits before it', () => {
    const { container } = render(
      <EntityChip label="Acme" href="/c/acme" avatar={{ shape: 'object' }} />,
    )
    const a = container.querySelector('a') as HTMLAnchorElement
    expect(a.getAttribute('href')).toBe('/c/acme')
    expect(a.querySelector('[data-slot="avatar"]')).not.toBeNull()
  })

  test('the remove button is a sibling of the link, named, and fires onRemove', () => {
    const onRemove = mock(() => undefined)
    const { container, getByRole } = render(
      <EntityChip label="Acme" href="/c/acme" onRemove={onRemove} />,
    )
    const button = getByRole('button', { name: 'Remove Acme' })
    expect(container.querySelector('a')?.contains(button)).toBe(false)
    expect(button.className).toContain('opacity-0')
    expect(button.className).toContain('pointer-coarse:opacity-100')
    fireEvent.click(button)
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  test('removeLabel names the button', () => {
    const { getByRole } = render(
      <EntityChip label="Acme" onRemove={() => undefined} removeLabel="Unlink company" />,
    )
    expect(getByRole('button', { name: 'Unlink company' })).toBeTruthy()
  })

  test('entityParts lists every slot the module renders', () => {
    const { container } = render(
      <>
        <EntityTitle title="A" href="/a" avatar={{}} />
        <EntityChip label="B" href="/b" onRemove={() => undefined} />
      </>,
    )
    const slots = new Set(
      [...container.querySelectorAll('[data-slot]')]
        .map((el) => el.getAttribute('data-slot') ?? '')
        .filter((s) => s !== 'avatar'),
    )
    expect([...slots].toSorted()).toEqual([...entityParts].toSorted())
  })
})
