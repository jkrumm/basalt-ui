/**
 * Compile-time guards of `layouts`: a built-in is named by its id, an app's layout is a full
 * `TableLayoutSpec` over the table's own row type. One `@ts-expect-error` per bad line; tsc is the
 * test, the runtime body only keeps bun from skipping.
 */
import { describe, expect, test } from 'bun:test'
import type { IconComponent } from '../../core/ports'
import type { TableLayoutSpec, UseDataTable } from '../contract'

type Deal = { id: string; name: string; closes: string }
type Layouts = NonNullable<UseDataTable<Deal>['layouts']>

const Icon: IconComponent = () => null

const timeline: TableLayoutSpec<Deal> = {
  id: 'timeline',
  label: 'Timeline',
  icon: Icon,
  render: (view) => view.rows.map((deal) => deal.closes).join(','),
}

export const ok: Layouts = ['table', 'board', timeline]

// @ts-expect-error an id that is no built-in is a spec, never a bare string
export const bareId: Layouts = ['table', 'timeline']

// @ts-expect-error a spec draws through render
export const noRender: Layouts = [{ id: 'map', label: 'Map', icon: Icon }]

// @ts-expect-error a spec names its glyph
export const noIcon: Layouts = [{ id: 'map', label: 'Map', render: () => null }]

export const wrongRow: TableLayoutSpec<Deal> = {
  id: 'map',
  label: 'Map',
  icon: Icon,
  // @ts-expect-error a layout reads the table's row type: Deal has no `lat`
  render: (view) => view.rows.map((deal) => deal.lat),
}

describe('layout spec type guard', () => {
  test('compiles only full specs and built-in ids', () => {
    expect(ok).toHaveLength(3)
  })
})
