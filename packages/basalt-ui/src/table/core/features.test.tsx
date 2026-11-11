/**
 * The engine composition: one closed 10-feature set, built once at module scope, imported by name,
 * acyclic. Natural sort through a kind column is the engine half of I19.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { FEATURE_NAMES, SORT_FNS, tableEngine, tableEngineFeatures } from './features'
import { col, engineColumn, specOf } from './kinds'

afterEach(cleanup)

describe('features', () => {
  test('the feature set is exactly the closed ten, nothing else registered', () => {
    const features = Object.keys(tableEngineFeatures).filter((k) => k.endsWith('Feature'))
    expect(features.toSorted()).toEqual([...FEATURE_NAMES].toSorted())
    expect(FEATURE_NAMES).toHaveLength(10)
    expect(Object.keys(SORT_FNS).toSorted()).toEqual(['alphanumeric', 'basic', 'datetime'])
  })

  test('the module is built once: a second import returns the same objects', async () => {
    const again = await import('./features')
    const third = await import('./features.ts')
    expect(again.tableEngine).toBe(tableEngine)
    expect(again.tableEngineFeatures).toBe(tableEngineFeatures)
    expect(third.tableEngine).toBe(tableEngine)
    expect(tableEngine.appFeatures).toBe(tableEngineFeatures)
  })

  test('the module imports the engine alone, by function name (acyclic, no bundles)', () => {
    const source = readFileSync(join(import.meta.dir, 'features.ts'), 'utf8')
    const specifiers = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1])
    expect(specifiers).toEqual(['@tanstack/react-table'])
    const imported = /import \{([^}]+)\} from/
      .exec(source)?.[1]
      ?.split(',')
      .map((s) => s.trim())
    expect(imported).not.toContain('sortFns')
    expect(imported).not.toContain('filterFns')
    expect(imported).not.toContain('stockFeatures')
    expect(imported).not.toContain('columnSizingFeature')
  })
})

type Row = { id: string; name: string; amount: number | null }

const ROWS: readonly Row[] = [
  { id: 'a', name: 'Project 10', amount: 12 },
  { id: 'b', name: 'Project 2', amount: null },
  { id: 'c', name: 'Project 1', amount: 7 },
]

function Sorted({ column }: { column: 'name' | 'amount' }): ReactNode {
  const c = col<Row>()
  const columns = [c.text('name'), c.money('amount', { currency: 'EUR' })].map((k) =>
    engineColumn(specOf(k)),
  )
  const table = tableEngine.useAppTable({
    columns,
    data: ROWS as Row[],
    getRowId: (r) => r.id,
  })
  return (
    <div>
      <button type="button" onClick={() => table.getColumn(column)?.toggleSorting(false)}>
        asc
      </button>
      <button type="button" onClick={() => table.getColumn(column)?.toggleSorting(true)}>
        desc
      </button>
      <ol>
        {table.getRowModel().rows.map((row) => (
          <li key={row.id}>{row.id}</li>
        ))}
      </ol>
    </div>
  )
}

const order = () => screen.getAllByRole('listitem').map((li) => li.textContent)

describe('engine sort through kinds', () => {
  test('text sorts naturally: Project 2 before Project 10', () => {
    render(<Sorted column="name" />)
    fireEvent.click(screen.getByRole('button', { name: 'asc' }))
    expect(order()).toEqual(['c', 'b', 'a'])
  })

  test('an absent value sorts last in both directions', () => {
    render(<Sorted column="amount" />)
    fireEvent.click(screen.getByRole('button', { name: 'asc' }))
    expect(order()).toEqual(['c', 'a', 'b'])
    fireEvent.click(screen.getByRole('button', { name: 'desc' }))
    expect(order()).toEqual(['a', 'c', 'b'])
  })
})
