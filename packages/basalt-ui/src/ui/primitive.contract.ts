/**
 * The primitive contract (docs/v3/ARCHITECTURE.md section 3): every `src/ui/<name>.tsx` module
 * renders with no provider, puts a `data-slot` equal to the kebab-case of its export on every part
 * and lists that slot in `SLOTS`, and survives `renderToString` + `hydrateRoot` without a
 * recoverable hydration error.
 *
 * Modules enlist by existing: `primitiveModules()` globs `src/ui/*.tsx`, so a new primitive needs
 * no edit here. The checker is data in, violations out (no test framework), so a fixture offender
 * can be judged by the same code as a shipped module.
 */
import { act, cleanup, render } from '@testing-library/react'
import { Field as BaseField } from '@base-ui/react/field'
import { Fieldset as BaseFieldset } from '@base-ui/react/fieldset'
import { readdirSync } from 'node:fs'
import { createElement } from 'react'
import type { ComponentType, ReactElement, ReactNode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'

type PartComponent = ComponentType<Record<string, unknown>>

export type PrimitiveModule = {
  name: string
  exports: Record<string, unknown>
  /** The module's entry in `SLOTS`; undefined when it is missing there. */
  slots: readonly string[] | undefined
}

/** Every primitive module name: `src/ui/*.tsx` that is not a test. */
export const primitiveModules = (dir: string = import.meta.dirname): string[] =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'))
    .map((f) => f.replace(/\.tsx$/, ''))
    .toSorted()

/** `CardBand` -> `card-band`. */
export const kebab = (exportName: string): string =>
  exportName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

/**
 * Parts Base UI refuses outside their parent render inside that parent's unstyled root, which has
 * no `data-slot` of its own. Keyed by slot; an unlisted part renders bare.
 */
const PARENTS: Record<string, ComponentType<{ children?: ReactNode }>> = {
  'field-label': (p) => createElement(BaseField.Root, p),
  'field-description': (p) => createElement(BaseField.Root, p),
  'field-error': (p) => createElement(BaseField.Root, p),
  'fieldset-legend': (p) => createElement(BaseFieldset.Root, p),
}

/** Props a part needs to render at all. Keyed by slot; an unlisted part renders with none. */
const PART_PROPS: Record<string, Record<string, unknown>> = {
  'field-error': { match: true },
  'card-info': { label: 'About' },
  'count-badge': { count: 1 },
  'delta-badge': { value: 1, polarity: 'neutral' },
}

const componentEntries = (exports: Record<string, unknown>): [string, PartComponent][] =>
  Object.entries(exports).flatMap(([name, value]) =>
    /^[A-Z]/.test(name) && typeof value === 'function' ? [[name, value as PartComponent]] : [],
  )

/** One part as an element: children `x`, wrapped in its parent when Base UI needs one. */
function partElement(Part: PartComponent, slot: string, bare: boolean): ReactElement {
  const props = PART_PROPS[slot] ?? {}
  const node = bare ? createElement(Part, props) : createElement(Part, props, 'x')
  const Parent = PARENTS[slot]
  return Parent === undefined ? node : createElement(Parent, null, node)
}

/** A part on a void element (`<input>`) refuses children, so it renders bare. */
function renderPart(Part: PartComponent, slot: string): { container: HTMLElement; bare: boolean } {
  try {
    return { container: render(partElement(Part, slot, false)).container, bare: false }
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('void element')) throw error
    cleanup()
    return { container: render(partElement(Part, slot, true)).container, bare: true }
  }
}

/** The recoverable hydration errors React reports hydrating `element` over its own server HTML. */
export async function hydrationErrors(element: () => ReactElement): Promise<number> {
  const container = document.createElement('div')
  container.innerHTML = renderToString(element())
  document.body.append(container)
  let errors = 0
  let root: ReturnType<typeof hydrateRoot> | undefined
  await act(async () => {
    root = hydrateRoot(container, element(), { onRecoverableError: () => (errors += 1) })
  })
  await act(async () => root?.unmount())
  container.remove()
  return errors
}

/** Every contract violation of one module, empty when it conforms. */
export async function checkPrimitive(mod: PrimitiveModule): Promise<string[]> {
  const violations: string[] = []
  const parts = componentEntries(mod.exports)
  if (parts.length === 0) return [`${mod.name}: exports no component`]
  if (mod.slots === undefined) violations.push(`${mod.name}: missing from SLOTS`)
  for (const [exportName, Part] of parts) {
    const slot = kebab(exportName)
    const label = `${mod.name}.${exportName}`
    try {
      const { container, bare } = renderPart(Part, slot)
      if (container.querySelector(`[data-slot="${slot}"]`) === null) {
        violations.push(`${label}: renders no element with data-slot="${slot}"`)
      }
      if (mod.slots !== undefined && !mod.slots.includes(slot)) {
        violations.push(`${label}: data-slot "${slot}" is not listed in SLOTS.${mod.name}`)
      }
      cleanup()
      const errors = await hydrationErrors(() => partElement(Part, slot, bare))
      if (errors > 0) violations.push(`${label}: ${errors} recoverable hydration error(s)`)
    } catch (error) {
      cleanup()
      violations.push(`${label}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return violations
}
