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
import { Accordion as BaseAccordion } from '@base-ui/react/accordion'
import { AlertDialog as BaseAlertDialog } from '@base-ui/react/alert-dialog'
import { Collapsible as BaseCollapsible } from '@base-ui/react/collapsible'
import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { Drawer as BaseDrawer } from '@base-ui/react/drawer'
import { Toast as BaseToast } from '@base-ui/react/toast'
import { Menu as BaseMenu } from '@base-ui/react/menu'
import { Popover as BasePopover } from '@base-ui/react/popover'
import { Autocomplete as BaseAutocomplete } from '@base-ui/react/autocomplete'
import { Combobox as BaseCombobox } from '@base-ui/react/combobox'
import { Select as BaseSelect } from '@base-ui/react/select'
import { Tabs as BaseTabs } from '@base-ui/react/tabs'
import { Toolbar as BaseToolbar } from '@base-ui/react/toolbar'
import { readdirSync } from 'node:fs'
import { cloneElement, createElement } from 'react'
import type { ComponentType, ReactElement, ReactNode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { AutocompleteContent, ComboboxContent } from './combobox'
import { MenuContent, MenuRadioGroup } from './menu'
import { SelectContent } from './select'

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
  ...disclosureAncestry(),
  ...overlayAncestry(true),
  ...pickerAncestry(),
  ...toolbarAncestry(),
  ...tableAncestry({
    'table-header': ['table'],
    'table-body': ['table'],
    'table-caption': ['table'],
    'table-row': ['table', 'tbody'],
    'table-head': ['table', 'thead', 'tr'],
    'table-cell': ['table', 'tbody', 'tr'],
  }),
}

/**
 * The Base UI roots a disclosure part needs, open on the part's own item so a panel renders:
 * a tab and its panel under `Tabs.Root` on value `a`, an accordion item and its panel under an
 * `Accordion.Root` with item `a` open, a collapsible trigger and panel under an open root.
 */
export function disclosureAncestry(): Record<string, ComponentType<{ children?: ReactNode }>> {
  const tabs = (p: { children?: ReactNode }): ReactElement =>
    createElement(BaseTabs.Root, { defaultValue: 'a' }, p.children)
  const accordion = (p: { children?: ReactNode }): ReactElement =>
    createElement(BaseAccordion.Root, { defaultValue: ['a'] }, p.children)
  const item = (p: { children?: ReactNode }): ReactElement =>
    accordion({
      children: createElement(BaseAccordion.Item, { value: 'a' }, p.children),
    })
  const collapsible = (p: { children?: ReactNode }): ReactElement =>
    createElement(BaseCollapsible.Root, { defaultOpen: true }, p.children)
  return {
    'tabs-list': tabs,
    'tabs-trigger': (p) => tabs({ children: createElement(BaseTabs.List, null, p.children) }),
    'tabs-content': tabs,
    'accordion-item': accordion,
    'accordion-trigger': item,
    'accordion-content': item,
    'collapsible-trigger': collapsible,
    'collapsible-content': collapsible,
  }
}

/**
 * The Base UI roots an overlay part needs. `open` renders the popup (portalled to `document.body`);
 * closed it renders no element, which is the state the SSR/hydration check also covers.
 */
export function overlayAncestry(
  open: boolean,
): Record<string, ComponentType<{ children?: ReactNode }>> {
  const dialog = (p: { children?: ReactNode }): ReactElement =>
    createElement(BaseDialog.Root, { defaultOpen: open }, p.children)
  const alert = (p: { children?: ReactNode }): ReactElement =>
    createElement(BaseAlertDialog.Root, { defaultOpen: open }, p.children)
  const drawer = (p: { children?: ReactNode }): ReactElement =>
    createElement(BaseDrawer.Root, { defaultOpen: open }, p.children)
  const toastProvider = (p: { children?: ReactNode }): ReactElement =>
    createElement(BaseToast.Provider, null, p.children)
  const toast = (p: { children?: ReactNode }): ReactElement =>
    toastProvider({
      children: createElement(BaseToast.Root, { toast: { id: 'a', title: 't' } }, p.children),
    })
  return {
    ...popupAncestry(open),
    'dialog-trigger': dialog,
    'dialog-content': dialog,
    'dialog-title': dialog,
    'dialog-description': dialog,
    'dialog-close': dialog,
    'alert-dialog-trigger': alert,
    'alert-dialog-content': alert,
    'sheet-trigger': drawer,
    'sheet-content': drawer,
    'sheet-title': drawer,
    'sheet-close': drawer,
    'toast-viewport': toastProvider,
    toast: toastProvider,
    'toast-title': toast,
    'toast-description': toast,
    'toast-close': toast,
  }
}

/**
 * The Base UI roots a popup part needs: a popover or menu root, open when `open`, and for a menu row
 * the portalled menu popup it lives in. A tooltip is its own root, so its wrapper sets `defaultOpen`
 * and a trigger child on the element it wraps.
 */
export function popupAncestry(
  open: boolean,
): Record<string, ComponentType<{ children?: ReactNode }>> {
  type Wrap = ComponentType<{ children?: ReactNode }>
  const popover: Wrap = (p) => createElement(BasePopover.Root, { defaultOpen: open }, p.children)
  const menu: Wrap = (p) => createElement(BaseMenu.Root, { defaultOpen: open }, p.children)
  const inMenu: Wrap = (p) => menu({ children: createElement(MenuContent, null, p.children) })
  return {
    'popover-trigger': popover,
    'popover-content': popover,
    tooltip: (p) =>
      cloneElement(p.children as ReactElement<Record<string, unknown>>, {
        defaultOpen: open,
        children: createElement('button', null, 'x'),
      }),
    'menu-trigger': menu,
    'menu-content': menu,
    'menu-item': inMenu,
    'menu-group': inMenu,
    'menu-checkbox-item': inMenu,
    'menu-radio-group': inMenu,
    'menu-radio-item': (p) => inMenu({ children: createElement(MenuRadioGroup, null, p.children) }),
    'menu-sub': inMenu,
    'menu-separator': inMenu,
  }
}

/** The Base UI `Toolbar.Root` every toolbar part throws without. */
export function toolbarAncestry(): Record<string, ComponentType<{ children?: ReactNode }>> {
  const root = (p: { children?: ReactNode }): ReactElement => createElement(BaseToolbar.Root, p)
  return { 'toolbar-group': root, 'toolbar-button': root, 'toolbar-separator': root }
}

/** Roots that render no element of their own: they carry no slot and are not listed in `SLOTS`. */
export const ROOTLESS = new Set(['dialog', 'alert-dialog', 'sheet', 'popover', 'menu'])

/**
 * The Base UI roots a picker part needs. A popup part renders inside an open root (the popup is
 * portalled, so the checker reads `baseElement`): a select trigger, value and group under a root,
 * a select content under an open root, an item under that root's own content; the same for the
 * combobox and autocomplete, and a chip under a `multiple` combobox.
 */
export function pickerAncestry(): Record<string, ComponentType<{ children?: ReactNode }>> {
  type Wrap = ComponentType<{ children?: ReactNode }>
  const select: Wrap = (p) => createElement(BaseSelect.Root, { defaultValue: 'a' }, p.children)
  const openSelect: Wrap = (p) => createElement(BaseSelect.Root, { defaultOpen: true }, p.children)
  const combobox: Wrap = (p) => createElement(BaseCombobox.Root, { defaultOpen: true }, p.children)
  const multiple: Wrap = (p) =>
    createElement(BaseCombobox.Root, { multiple: true, defaultOpen: true }, p.children)
  const autocomplete: Wrap = (p) =>
    createElement(BaseAutocomplete.Root, { defaultOpen: true }, p.children)
  return {
    'select-trigger': select,
    'select-value': select,
    'select-group': openSelect,
    'select-content': openSelect,
    'select-item': (p) => openSelect({ children: createElement(SelectContent, null, p.children) }),
    'combobox-input': combobox,
    'combobox-content': combobox,
    'combobox-item': (p) =>
      combobox({ children: createElement(ComboboxContent, null, p.children) }),
    'combobox-chips': multiple,
    'combobox-chip': (p) =>
      multiple({
        children: createElement(BaseCombobox.Chips, null, p.children),
      }),
    'autocomplete-input': autocomplete,
    'autocomplete-content': autocomplete,
    'autocomplete-item': (p) =>
      autocomplete({
        children: createElement(AutocompleteContent, null, p.children),
      }),
  }
}

/** Parts whose element holds no text: they render without the `x` child. */
const NO_TEXT = new Set(['table', 'table-header', 'table-body', 'table-row', 'tooltip'])

/** Wrappers that give a table part the native elements HTML requires around it. */
function tableAncestry(
  chains: Record<string, string[]>,
): Record<string, ComponentType<{ children?: ReactNode }>> {
  return Object.fromEntries(
    Object.entries(chains).map(([slot, tags]) => [
      slot,
      (p: { children?: ReactNode }) =>
        tags
          .toReversed()
          .reduce<ReactNode>((inner, tag) => createElement(tag, null, inner), p.children),
    ]),
  )
}

/** Props a part needs to render at all. Keyed by slot; an unlisted part renders with none. */
const PART_PROPS: Record<string, Record<string, unknown>> = {
  'field-error': { match: true },
  'card-info': { label: 'About' },
  'count-badge': { count: 1 },
  'delta-badge': { value: 1, polarity: 'neutral' },
  'tabs-trigger': { value: 'a' },
  'tabs-content': { value: 'a' },
  toast: { toast: { id: 'a', title: 't' } },
  tooltip: { label: 'x' },
  'menu-group': { label: 'x' },
  'menu-sub': { label: 'x' },
  'menu-radio-item': { value: 'a' },
  num: { value: 1 },
  'virtual-list': { count: 0, estimateSize: () => 32, getItemKey: (i: number) => i },
}

const componentEntries = (exports: Record<string, unknown>): [string, PartComponent][] =>
  Object.entries(exports).flatMap(([name, value]) =>
    /^[A-Z]/.test(name) && typeof value === 'function' ? [[name, value as PartComponent]] : [],
  )

/** One part as an element: children `x`, wrapped in its parent when Base UI needs one. */
function partElement(
  Part: PartComponent,
  slot: string,
  bare: boolean,
  closed = false,
): ReactElement {
  const props = PART_PROPS[slot] ?? {}
  const node =
    bare || NO_TEXT.has(slot) ? createElement(Part, props) : createElement(Part, props, 'x')
  const Parent = closed ? (overlayAncestry(false)[slot] ?? PARENTS[slot]) : PARENTS[slot]
  return Parent === undefined ? node : createElement(Parent, null, node)
}

/**
 * A part on a void element (`<input>`) refuses children, so it renders bare. The returned element
 * is the document body, so a portalled popup is found too.
 */
function renderPart(Part: PartComponent, slot: string): { container: HTMLElement; bare: boolean } {
  try {
    return {
      container: render(partElement(Part, slot, false)).baseElement,
      bare: false,
    }
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('void element')) throw error
    cleanup()
    return {
      container: render(partElement(Part, slot, true)).baseElement,
      bare: true,
    }
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
    root = hydrateRoot(container, element(), {
      onRecoverableError: () => (errors += 1),
    })
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
      // A popup is portalled out of the container, so the lookup spans the document.
      const rendered = container.ownerDocument.querySelector(`[data-slot="${slot}"]`)
      if (!ROOTLESS.has(slot)) {
        if (rendered === null)
          violations.push(`${label}: renders no element with data-slot="${slot}"`)
        if (mod.slots !== undefined && !mod.slots.includes(slot)) {
          violations.push(`${label}: data-slot "${slot}" is not listed in SLOTS.${mod.name}`)
        }
      }
      cleanup()
      const errors = await hydrationErrors(() => partElement(Part, slot, bare))
      if (errors > 0) violations.push(`${label}: ${errors} recoverable hydration error(s)`)
      if (slot in overlayAncestry(false)) {
        const closedErrors = await hydrationErrors(() => partElement(Part, slot, bare, true))
        if (closedErrors > 0) {
          violations.push(`${label}: ${closedErrors} recoverable hydration error(s) closed`)
        }
      }
    } catch (error) {
      cleanup()
      violations.push(`${label}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return violations
}
