/**
 * `basalt-ui/form` — basalt's form parts bound to TanStack Form through `createFormHook`.
 * Peers: `@tanstack/react-form` (optional). An app without it composes the same parts from
 * `basalt-ui/controls` by hand.
 */

export { useAppForm, withForm } from './hook'
export type { BoundFormFieldProps, FooterProps, FormProps } from './parts'
