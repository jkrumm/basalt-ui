import type { MantineThemeComponent } from '@mantine/core'

/** The input type of a Mantine component's `.extend()` — `defaultProps`/`classNames`/`styles`/`vars`
 * typed against THAT component, taken from the component type alone. */
type ExtendInput<C> = C extends { extend: (input: infer I) => unknown } ? I : never

/**
 * Typed identity standing in for `Component.extend({...})`. Mantine's `extend` is `identity` at
 * runtime (it exists for typing), but calling it is a VALUE use of the component, which drags the
 * whole component module into every bundle that imports the theme. Pass the component as a type
 * argument (`ext<typeof Card>({...})`, imported with `import type`) and the same compile-time
 * checking applies with nothing emitted.
 */
export function ext<C>(input: ExtendInput<C>): MantineThemeComponent {
  return input as MantineThemeComponent
}
