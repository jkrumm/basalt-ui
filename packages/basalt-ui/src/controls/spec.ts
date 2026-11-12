/**
 * `spec(handle, label, options)`: the data a control renders from. A spec is plain data, so the
 * home that hosts it (a page bar, a card header, a sheet) picks the surface and a page author never
 * writes markup.
 *
 * The scope is read off the handle, and it is the type that keeps a card slot honest: a widget
 * handle makes a `'widget'` spec, any other handle a `'global' | 'page'` one, and a slot typed
 * `FilterSpec<unknown, 'widget'>` rejects the second kind at compile time.
 */
import type { ControlHandle } from '../core/ports'
import type { FilterScope, FilterSpec, SpecOptions } from './contract'

/** The scopes a spec built from a non-widget handle can have. */
export type StoreScope = Exclude<FilterScope, 'widget'>

/** What `spec` needs of a handle: the frozen `ControlHandle`, which a widget handle also carries. */
type WidgetHandle<T> = ControlHandle<T> & { readonly scope: 'widget' }

/**
 * The data a control is drawn from: a handle, its label and how to offer it (`options`, `facets`,
 * `clearable`, `placeholder`, `as`). A widget handle makes a spec a card slot accepts; a global or page
 * field makes one it refuses.
 *
 * @useWhen you bind a global, page or widget field to a filter slot
 * @neverWhen you need a control the kinds do not cover (use `filterSlot.custom`)
 *
 * @example
 * spec(overview.widget.latency.range, 'Range', { as: 'segmented' }) // for a card slot
 * spec(globals.field.range, 'Range') // for a page bar or the shell
 */
export function spec<T>(
  handle: WidgetHandle<T>,
  label: string,
  options?: SpecOptions<T>,
): FilterSpec<T, 'widget'>
export function spec<T>(
  handle: ControlHandle<T>,
  label: string,
  options?: SpecOptions<T>,
): FilterSpec<T, StoreScope>
export function spec<T>(
  handle: ControlHandle<T>,
  label: string,
  options: SpecOptions<T> = {},
): FilterSpec<T> {
  const scope = (handle as { scope?: unknown }).scope === 'widget' ? 'widget' : 'page'
  return { handle, label, scope, ...options }
}
