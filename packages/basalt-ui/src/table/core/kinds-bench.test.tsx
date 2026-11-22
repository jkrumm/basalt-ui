/**
 * The kinds the Notion-style table needs: `person`, `tags`, `countdown`, `link`, an entity with a
 * logo, a typed title icon and a quiet text. Rendering goes through `spec.render` with a fixed env,
 * the way the parts call it.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { createFormat } from '../../core/format'
import type { IconComponent } from '../../core/ports'
import { matchesFilter } from './filters'
import { col, specOf } from './kinds'
import { cellAttributes, countdownDays, isAbsent, linkTarget } from './kinds-cells'
import type { CellEnv } from './kinds-spec'

afterEach(cleanup)

type Row = {
  name: string
  owner: string
  team: string[]
  tags: string[]
  due: string
  site: string
  kind: 'note' | 'task'
  preview: string
}

const ROW: Row = {
  name: 'Quarterly plan',
  owner: 'Ada Lovelace',
  team: ['Ada Lovelace', 'Alan Turing', 'Grace Hopper'],
  tags: ['design', 'ops'],
  due: '2026-11-15',
  site: 'https://acme.example/pricing/',
  kind: 'note',
  preview: 'A long preview that must not wrap',
}

const ENV: CellEnv = {
  format: createFormat(),
  now: Date.parse('2026-11-11T12:00:00Z'),
  zone: 'UTC',
  box: { height: 24, phase: 'ready' },
}

const c = col<Row>()

function cell(
  column: ReturnType<typeof c.person>,
  row: Row = ROW,
  env: CellEnv = ENV,
): HTMLElement {
  const spec = specOf(column)
  function Cell(): ReactNode {
    return (
      <table>
        <tbody>
          <tr>
            <td {...cellAttributes(spec)}>{spec.render?.(row, env)}</td>
          </tr>
        </tbody>
      </table>
    )
  }
  return render(<Cell />).container.querySelector('td') as HTMLElement
}

const Glyph: IconComponent = ({ className }) => <svg data-glyph="" className={className} />

describe('person', () => {
  test('draws a face, the name and the muted role', () => {
    const td = cell(c.person('owner', { role: () => 'Founder', avatar: () => 'a.png' }))
    expect(td.querySelector('[data-slot="avatar"]')).not.toBeNull()
    expect(td.querySelector('[data-slot="table-person"]')?.textContent).toContain('Ada Lovelace')
    expect(td.querySelector('[data-slot="table-person-role"]')?.textContent).toBe('Founder')
  })

  test('people draws an avatar stack named by the header and titled with every name', () => {
    const td = cell(c.people('team', { header: 'Known by', max: 2 }))
    const stack = td.querySelector('[data-slot="avatar-stack"]')
    expect(stack?.getAttribute('aria-label')).toBe('Known by')
    expect(stack?.textContent).toContain('+1')
    expect(td.querySelector('[data-slot="table-people"]')?.getAttribute('title')).toBe(
      'Ada Lovelace, Alan Turing, Grace Hopper',
    )
  })

  test('a list sorts by its names and an empty list is absent', () => {
    const spec = specOf(c.people('team'))
    const sort = spec.sort
    expect(sort !== null && 'compare' in sort ? sort.compare(['A'], ['B']) : 0).toBeLessThan(0)
    expect(isAbsent([])).toBe(true)
  })

  test('the filter is any-of over a single name and over a list', () => {
    expect(specOf(c.person('owner', { filter: 'multi' })).filter).toBe('anyOf')
    expect(matchesFilter('anyOf', 'Ada Lovelace', ['Ada Lovelace'])).toBe(true)
    expect(matchesFilter('anyOf', ROW.team, ['Alan Turing'])).toBe(true)
    expect(matchesFilter('anyOf', ROW.team, ['Alan'])).toBe(false)
    expect(specOf(c.person('owner')).filter).toBeNull()
  })
})

describe('tags', () => {
  test('chips on one line in the tone map, labelled', () => {
    const td = cell(
      c.tags('tags', {
        labels: { design: 'Design' },
        tone: (tag) => (tag === 'ops' ? 'warn' : 'neutral'),
      }),
    )
    const chips = [...td.querySelectorAll('[data-slot="lozenge"]')]
    expect(chips.map((chip) => chip.textContent)).toEqual(['Design', 'ops'])
    expect(chips[1]?.className).toContain('text-warn')
  })

  test("filter is any-of across a row's tags", () => {
    expect(specOf(c.tags('tags', { filter: 'multi' })).filter).toBe('anyOf')
    expect(matchesFilter('anyOf', ROW.tags, ['ops', 'finance'])).toBe(true)
    expect(matchesFilter('anyOf', ROW.tags, ['finance'])).toBe(false)
  })

  test('searches the labels it shows and is absent when empty', () => {
    const spec = specOf(c.tags('tags', { labels: { design: 'Design' } }))
    expect(spec.search?.(ROW, ENV.format, ENV.now)).toContain('Design')
    const td = cell(c.tags('tags'), { ...ROW, tags: [] })
    expect(td.querySelector('[data-slot="table-absent"]')).not.toBeNull()
  })
})

describe('countdown', () => {
  const text = (due: string, o?: Parameters<typeof c.countdown>[1]) =>
    cell(c.countdown('due', o), { ...ROW, due }).querySelector('time')

  test('reads its distance from today, in days', () => {
    expect(text('2026-11-15')?.textContent).toBe('in 4 days')
    expect(text('2026-11-12')?.textContent).toBe('in 1 day')
    expect(text('2026-11-11')?.textContent).toBe('Today')
    expect(text('2026-10-16')?.textContent).toBe('26 days late')
    expect(text('2026-11-10')?.textContent).toBe('1 day late')
  })

  test('tones by the declared thresholds and prints the date beyond the horizon', () => {
    expect(text('2026-10-16')?.getAttribute('data-tone')).toBe('bad')
    expect(text('2026-11-15', { warn: 7 })?.getAttribute('data-tone')).toBe('warn')
    expect(text('2026-11-15')?.getAttribute('data-tone')).toBe('neutral')
    expect(text('2027-03-15')?.textContent).toBe('Mar 15, 2027')
    expect(text('2027-03-15', { horizon: 500 })?.textContent).toBe('in 124 days')
  })

  test('counts days in the zone and follows the clock it is given', () => {
    const late = Date.parse('2026-11-11T23:30:00Z')
    expect(countdownDays('2026-11-12', late, 'UTC')).toBe(1)
    expect(countdownDays('2026-11-12', late, 'Asia/Tokyo')).toBe(0)
    const next: CellEnv = { ...ENV, now: Date.parse('2026-11-13T12:00:00Z') }
    expect(cell(c.countdown('due'), ROW, next).querySelector('time')?.textContent).toBe('in 2 days')
  })

  test('sorts by the date and filters by a day range', () => {
    const spec = specOf(c.countdown('due'))
    expect(spec.sort).toEqual({ fn: 'datetime' })
    expect(() => c.countdown('due', { filter: 'range' } as never)).toThrow('picker')
    expect(spec.search?.(ROW, ENV.format, ENV.now)).toContain('2026-11-15')
  })
})

describe('link', () => {
  test('a web URL opens in a new tab as quiet text without its scheme', () => {
    const a = cell(c.link('site')).querySelector('a')
    expect(a?.getAttribute('href')).toBe('https://acme.example/pricing/')
    expect(a?.textContent).toBe('acme.example/pricing')
    expect(a?.getAttribute('rel')).toBe('noopener noreferrer')
  })

  test('an address is a mailto link and an unsafe URL is only text', () => {
    expect(linkTarget('ada@example.com')).toEqual({ href: 'mailto:ada@example.com', web: false })
    expect(linkTarget('javascript:alert(1)')).toBeNull()
    const td = cell(c.link('site'), { ...ROW, site: 'javascript:alert(1)' })
    expect(td.querySelector('a')).toBeNull()
    expect(td.textContent).toContain('javascript:alert(1)')
  })

  test('a row can name the destination, the label and an icon', () => {
    const td = cell(
      c.link('name', { href: () => '/notes/1', label: () => 'Plan', icon: () => Glyph }),
    )
    expect(td.querySelector('a')?.getAttribute('href')).toBe('/notes/1')
    expect(td.querySelector('a')?.textContent).toBe('Plan')
    expect(td.querySelector('[data-glyph]')).not.toBeNull()
  })
})

describe('entity and title', () => {
  test('an image draws a 16 px face in the object shape, a ref beside the name', () => {
    const td = cell(c.entity('name', { image: () => 'logo.png', ref: () => 'INV-0042' }))
    expect(td.querySelector('[data-slot="avatar"]')?.className).toContain('rounded-chip')
    expect(td.querySelector('[data-slot="table-entity-id"]')?.textContent).toBe('INV-0042')
  })

  test('the typed icon is chosen per row', () => {
    const Other: IconComponent = ({ className }) => <svg data-other="" className={className} />
    const column = c.title('name', { type: (row) => row.kind, icons: { note: Glyph, task: Other } })
    expect(specOf(column).kind).toBe('entity')
    expect(cell(column).querySelector('[data-glyph]')).not.toBeNull()
    expect(cell(column, { ...ROW, kind: 'task' }).querySelector('[data-other]')).not.toBeNull()
  })
})

describe('a list cell in the table', () => {
  test('an empty list is not a value for the footer count or a group', async () => {
    const { aggregate } = await import('../parts/footer-model')
    const rows = [{ tags: ['a'] }, { tags: [] }, { tags: ['a', 'b'] }]
    expect(aggregate('count', rows, (r) => r.tags)).toBe(2)
    const { bodyItems } = await import('../parts/group-row-model')
    const spec = specOf(c.tags('tags'))
    const items = bodyItems(
      rows.map((original, i) => ({ id: String(i), original })) as never,
      spec as never,
      undefined,
    )
    expect(items.filter((item) => item.type === 'group').length).toBe(3)
  })
})

describe('quiet text', () => {
  test('is muted, truncated and never wraps', () => {
    const column = c.text('preview', { quiet: true })
    expect(specOf(column).wrap).toBe(false)
    expect(cell(column).querySelector('[data-slot="table-quiet"]')?.className).toContain('truncate')
    expect(specOf(c.text('preview')).wrap).toBe(true)
  })
})
