import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { RelationshipCard } from './relationship-card'

afterEach(cleanup)

const FACTS = [
  { label: 'On hand', value: '1,200' },
  { label: 'Next delivery', value: 'Dec 4', mono: true },
] as const

describe('RelationshipCard', () => {
  test('is one link over the card to the record, named for assistive technology', () => {
    const { getByRole, container } = render(
      <RelationshipCard title="Hex bolt M8" href="/ref/part/hb-m8" facts={FACTS} />,
    )
    const link = getByRole('link', { name: 'Open Hex bolt M8' })
    expect(link.getAttribute('href')).toBe('/ref/part/hb-m8')
    expect(link.className).toContain('absolute inset-0')
    expect(container.querySelectorAll('a')).toHaveLength(1)
    expect(container.querySelector('[data-slot="relationship-card"]')).not.toBeNull()
  })

  test('linkLabel names the link instead of Open <title>', () => {
    const { getByRole } = render(
      <RelationshipCard title="Hex bolt M8" href="/p" linkLabel="Hex bolt M8, part" />,
    )
    expect(getByRole('link', { name: 'Hex bolt M8, part' })).toBeDefined()
  })

  test('draws the face and the title through EntityTitle', () => {
    const { container } = render(
      <RelationshipCard
        title="Katrin Brenner"
        subtitle="Key account manager"
        avatar={{}}
        href="/p"
      />,
    )
    const entity = container.querySelector('[data-slot="entity-title"]')!
    expect(entity.textContent).toContain('Katrin Brenner')
    expect(entity.textContent).toContain('Key account manager')
    expect(entity.querySelector('[data-slot="avatar"]')?.getAttribute('aria-label')).toBe(
      'Katrin Brenner',
    )
  })

  test('a relation is a line under the name', () => {
    const { container } = render(<RelationshipCard title="A" href="/p" relation="Signer" />)
    expect(container.querySelector('[data-slot="relationship-relation"]')?.textContent).toBe(
      'Signer',
    )
    expect(container.querySelector('[data-slot="relationship-strength"]')).toBeNull()
  })

  test('a strength is a word in a tone with its score, never color alone', () => {
    const { container } = render(
      <RelationshipCard
        title="A"
        href="/p"
        strength={{ label: 'Strong', tone: 'good', score: 82 }}
      />,
    )
    const strength = container.querySelector('[data-slot="relationship-strength"]')!
    expect(strength.textContent).toBe('Strong82')
    expect(strength.querySelector('[data-slot="lozenge"]')?.className).toContain('good')
    expect(container.querySelector('[data-slot="relationship-relation"]')).toBeNull()
  })

  test('facts are a definition list; a mono fact keeps the mono face', () => {
    const { container } = render(<RelationshipCard title="A" href="/p" facts={FACTS} />)
    const terms = [...container.querySelectorAll('dt')].map((el) => el.textContent)
    const values = [...container.querySelectorAll('dd')]
    expect(terms).toEqual(['On hand', 'Next delivery'])
    expect(values.map((el) => el.textContent)).toEqual(['1,200', 'Dec 4'])
    expect(values[0]?.className).not.toContain('font-mono')
    expect(values[1]?.className).toContain('font-mono')
  })

  test('no facts draw no list', () => {
    const { container } = render(<RelationshipCard title="A" href="/p" />)
    expect(container.querySelector('dl')).toBeNull()
  })

  test('renders on the server with no provider', () => {
    const html = renderToString(
      <RelationshipCard title="A" href="/p" facts={FACTS} relation="Signer" />,
    )
    expect(html).toContain('href="/p"')
    expect(html).toContain('On hand')
  })
})
