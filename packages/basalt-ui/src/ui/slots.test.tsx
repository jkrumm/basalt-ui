import { cleanup, render } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ComponentType, ReactNode } from 'react'
import { SLOTS } from './slots'

afterEach(cleanup)

const pascal = (name: string): string =>
  name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')

const camel = (name: string): string => pascal(name).replace(/^./, (c) => c.toLowerCase())

type Part = ComponentType<{ children?: ReactNode }>

/** With children `x`; a part on a void element (`<input>`) refuses children, so it renders bare. */
function renderPart(Part: Part): RenderResult {
  try {
    return render(<Part>x</Part>)
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('void element')) throw error
    cleanup()
    return render(<Part />)
  }
}

describe('SLOTS', () => {
  test('lists every src/ui module that exports <name>Parts', () => {
    const dir = import.meta.dirname
    const onDisk = readdirSync(dir)
      .filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx') && !f.includes('.guard.'))
      .map((f) => f.replace(/\.tsx$/, ''))
      .filter((name) =>
        new RegExp(`export const ${camel(name)}Parts\\b`).test(
          readFileSync(join(dir, `${name}.tsx`), 'utf8'),
        ),
      )
      .toSorted()
    expect(Object.keys(SLOTS).toSorted()).toEqual(onDisk)
  })

  // A compound part that needs its parent to render will need a later convention here.
  for (const [module, parts] of Object.entries(SLOTS)) {
    test(`${module}: rendering each part yields exactly its data-slot set`, async () => {
      const exports = (await import(`./${module}`)) as Record<string, unknown>
      const seen = new Set<string>()
      for (const part of parts) {
        const Part = exports[pascal(part)] as Part
        expect(Part).toBeDefined()
        const { container, unmount } = renderPart(Part)
        for (const el of container.querySelectorAll('[data-slot]')) {
          seen.add(el.getAttribute('data-slot') ?? '')
        }
        unmount()
      }
      expect([...seen].toSorted()).toEqual([...parts].toSorted())
    })
  }
})
