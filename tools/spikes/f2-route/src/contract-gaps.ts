import type { spec } from 'basalt-ui/controls'

/** `ControlHandle<V>` has no published specifier (NEED n2), so it is read off `spec`'s last overload. */
type Handle<V> = Parameters<typeof spec<V>>[0]

/**
 * NEED n1 (see docs/v3/spikes/f2-route.md): `ControlHandle<T>.options` is typed `{ value: T }[]`,
 * but a `multi` handle (T = `readonly V[]`) and a `range` handle (T = `RangeValue`) list their
 * members (`V`, a preset), so `spec(handle, ...)` does not type-check for either. The port cannot
 * continue without a cast; this is the only one, so the scan finds it.
 */
export function asControl<V>(
  handle: Omit<Handle<V>, 'options'> & { readonly options: readonly unknown[] },
): Handle<V> {
  return handle as unknown as Handle<V>
}
