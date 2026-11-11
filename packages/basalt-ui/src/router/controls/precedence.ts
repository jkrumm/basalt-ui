/**
 * The widget precedence law, one pure function: `override > inherited > fallback`, per key. An
 * override is the page's `w.<widget>.<field>` URL value when it decodes; an inherited value is the
 * bound handle's (a global, or a page field); the fallback is the static constant. An invalid layer
 * is `undefined` and drops to the next one, never throws. An override equal to the inherited value
 * still wins (key presence is intent), which is why this takes the layers and not a comparison.
 */

export type WidgetSource = 'inherited' | 'override'

export type Resolved<V> = {
  readonly value: V
  readonly source: WidgetSource
  /** The value the widget would show with no override. */
  readonly inherited: V
}

export function resolveWidget<V>(
  override: V | undefined,
  inherited: V | undefined,
  fallback: V,
): Resolved<V> {
  const below = inherited ?? fallback
  if (override !== undefined) return { value: override, source: 'override', inherited: below }
  return { value: below, source: 'inherited', inherited: below }
}
