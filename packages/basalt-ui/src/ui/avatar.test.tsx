import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { Avatar, AvatarStack, avatarParts } from './avatar'

afterEach(cleanup)

const tint = (name: string): string =>
  render(<Avatar name={name} />)
    .container.querySelector('[data-tint]')
    ?.className.match(/bg-chart-\d\/15/)?.[0] ?? ''

const cls = (p: Parameters<typeof Avatar>[0]): string =>
  (render(<Avatar {...p} />).container.firstElementChild as HTMLElement).className

const icon = (props: { className?: string }) => (
  <svg data-testid="glyph" className={props.className} />
)

describe('avatar module', () => {
  test('renders a named image box with data-slot, and avatarParts lists every slot', () => {
    const { container } = render(<Avatar name="Ada Lovelace" />)
    const el = container.firstElementChild as HTMLElement
    expect(el.getAttribute('data-slot')).toBe('avatar')
    expect(el.getAttribute('role')).toBe('img')
    expect(el.getAttribute('aria-label')).toBe('Ada Lovelace')
    expect(avatarParts).toContain('avatar')
    expect(avatarParts).toContain('avatar-stack')
  })

  test('the fallback is the first and last initial, one at the smallest size', () => {
    expect(render(<Avatar name="ada king lovelace" />).container.textContent).toBe('AL')
    cleanup()
    expect(render(<Avatar name="Acme" />).container.textContent).toBe('A')
    cleanup()
    expect(render(<Avatar name="Ada Lovelace" size="xs" />).container.textContent).toBe('A')
  })

  test('an icon replaces the initials', () => {
    const { container, getByTestId } = render(<Avatar name="Acme" icon={icon} shape="object" />)
    expect(getByTestId('glyph')).toBeTruthy()
    expect(container.textContent).toBe('')
  })

  test('the tint is deterministic from the name and comes from a chart token', () => {
    const a = tint('Ada Lovelace')
    cleanup()
    expect(a).toMatch(/^bg-chart-[1-5]\/15$/)
    expect(tint(' ada lovelace ')).toBe(a)
  })

  test('shape and size pick the radius and the box', () => {
    expect(cls({ name: 'A', shape: 'person' })).toContain('rounded-full')
    cleanup()
    expect(cls({ name: 'A', shape: 'object' })).toContain('rounded-chip')
    cleanup()
    expect(cls({ name: 'A', shape: 'object', size: 'lg' })).toContain('rounded-ctrl')
    cleanup()
    expect(cls({ name: 'A', size: 'xs' })).toContain('size-4')
    cleanup()
    expect(cls({ name: 'A', size: 'lg' })).toContain('size-12')
  })

  // happy-dom has no network, so an image fails at once; a loaded image is proved in a real browser (tests/layout/ui-avatar.layout.test.ts).
  test('a failing image is dropped and the initials stay', () => {
    const { container } = render(<Avatar name="Ada Lovelace" src="/missing.png" />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toBe('AL')
    expect((container.firstElementChild as HTMLElement).hasAttribute('data-image')).toBe(false)
  })

  test('aria-hidden passes through for a name printed beside it', () => {
    const { container } = render(<Avatar name="Ada" aria-hidden="true" />)
    expect((container.firstElementChild as HTMLElement).getAttribute('aria-hidden')).toBe('true')
  })
})

describe('AvatarStack', () => {
  const people = [
    'Ada Lovelace',
    'Alan Turing',
    'Grace Hopper',
    'Edsger Dijkstra',
    'Barbara Liskov',
  ].map((name) => ({ name }))

  test('shows max faces and a named +N for the rest', () => {
    const { container } = render(<AvatarStack label="Assignees" people={people} max={3} />)
    const group = container.firstElementChild as HTMLElement
    expect(group.getAttribute('role')).toBe('group')
    expect(group.getAttribute('aria-label')).toBe('Assignees')
    expect(group.querySelectorAll('[data-slot="avatar"]')).toHaveLength(3)
    const more = group.querySelector('[aria-label="2 more"]') as HTMLElement
    expect(more.textContent).toBe('+2')
    expect(more.getAttribute('role')).toBe('img')
  })

  test('no overflow chip when everyone fits, and at least one face shows', () => {
    const { container } = render(<AvatarStack label="Assignees" people={people.slice(0, 2)} />)
    expect(container.querySelector('[aria-label$="more"]')).toBeNull()
    cleanup()
    const zero = render(<AvatarStack label="Assignees" people={people} max={0} />).container
    expect(zero.querySelectorAll('[data-slot="avatar"]')).toHaveLength(1)
  })

  test('the ground names the ring and the size the overlap', () => {
    const { container } = render(
      <AvatarStack label="Viewing" people={people} ground="card" size="lg" />,
    )
    const cls = (container.firstElementChild as HTMLElement).className
    expect(cls).toContain('ring-card')
    expect(cls).toContain('-ml-2.5')
    expect(container.querySelector('[data-slot="avatar"]')?.className).toContain('size-12')
  })
})
