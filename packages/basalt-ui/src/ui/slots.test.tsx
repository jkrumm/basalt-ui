import { cleanup, render } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'bun:test'
import { Field as BaseField } from '@base-ui/react/field'
import { Fieldset as BaseFieldset } from '@base-ui/react/fieldset'
import type { ComponentType, ReactNode } from 'react'
import { disclosureAncestry, overlayAncestry } from './primitive.contract'
import { SLOTS } from './slots'

afterEach(cleanup)

const pascal = (name: string): string =>
  name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')

const camel = (name: string): string => pascal(name).replace(/^./, (c) => c.toLowerCase())

type Part = ComponentType<{ children?: ReactNode }>

/**
 * A part that Base UI refuses outside its parent renders inside that parent's unstyled Base UI
 * root, which carries no `data-slot` of its own, so only the part's slot is counted.
 */
const PARENTS: Record<string, ComponentType<{ children?: ReactNode }>> = {
  'field-label': (p) => <BaseField.Root {...p} />,
  'field-description': (p) => <BaseField.Root {...p} />,
  'field-error': (p) => <BaseField.Root {...p} />,
  'fieldset-legend': (p) => <BaseFieldset.Root {...p} />,
  'table-header': (p) => <table {...p} />,
  'table-body': (p) => <table {...p} />,
  'table-row': (p) => (
    <table>
      <tbody {...p} />
    </table>
  ),
  'table-head': (p) => (
    <table>
      <thead>
        <tr {...p} />
      </thead>
    </table>
  ),
  'table-cell': (p) => (
    <table>
      <tbody>
        <tr {...p} />
      </tbody>
    </table>
  ),
  'table-caption': (p) => <table {...p} />,
  ...disclosureAncestry(),
  ...overlayAncestry(true),
}

/** Props a part needs to render at all: `FieldError` shows only on a failed validity or `match`. */
const PART_PROPS: Record<string, Record<string, unknown>> = {
  'field-error': { match: true },
  'card-info': { label: 'About' },
  'count-badge': { count: 1 },
  'delta-badge': { value: 1, polarity: 'neutral' },
  'tabs-trigger': { value: 'a' },
  'tabs-content': { value: 'a' },
  toast: { toast: { id: 'a', title: 't' } },
}

/** With children `x`; a part on a void element (`<input>`) refuses children, so it renders bare. */
function renderPart(Part: Part, name: string): RenderResult {
  const Parent = PARENTS[name]
  const props = PART_PROPS[name] ?? {}
  const Rendered = Part as ComponentType<Record<string, unknown>>
  const wrap = (node: ReactNode): ReactNode =>
    Parent === undefined ? node : <Parent>{node}</Parent>
  try {
    return render(wrap(<Rendered {...props}>x</Rendered>))
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('void element')) throw error
    cleanup()
    return render(wrap(<Rendered {...props} />))
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

  for (const [module, parts] of Object.entries(SLOTS)) {
    test(`${module}: rendering each part yields exactly its data-slot set`, async () => {
      const exports = (await import(`./${module}`)) as Record<string, unknown>
      const seen = new Set<string>()
      for (const part of parts) {
        const Part = exports[pascal(part)] as Part
        expect(Part).toBeDefined()
        const { container, unmount } = renderPart(Part, part)
        // A popup is portalled out of the container, so the lookup spans the document.
        for (const el of container.ownerDocument.querySelectorAll('[data-slot]')) {
          seen.add(el.getAttribute('data-slot') ?? '')
        }
        unmount()
      }
      expect([...seen].toSorted()).toEqual([...parts].toSorted())
    })
  }
})
