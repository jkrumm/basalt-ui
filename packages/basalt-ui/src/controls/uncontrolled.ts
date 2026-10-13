import type { BasaltProps } from '../common/props'

/**
 * Law C2 as named slots: a basalt filter or tab owns its value through `field`, so `value`,
 * `onChange` and `size` are typed `never` — the compile error names the mistake instead of
 * reporting an unknown prop (`docs/V2-SPEC.md` §3).
 */
export type UncontrolledProps = BasaltProps & {
  value?: never
  onChange?: never
  size?: never
}
