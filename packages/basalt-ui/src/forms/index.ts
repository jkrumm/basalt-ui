/**
 * ./forms — the Mantine form layer.
 *
 * Subpath-ONLY, deliberately: the root barrel re-exports nothing from here (`src/index.ts`), so a
 * consumer without `@mantine/form` installed never pulls an unresolvable import in by importing
 * `basalt-ui`. Same reason `./charts` and `./tokens` stay off the root barrel, one optional peer
 * over. Import everything below from `basalt-ui/forms`.
 *
 * One piece: the form (`useBasaltForm` + `inputProps`/`fieldKey`). The layout (FormRow /
 * FormGroup) lives in `basalt-ui/controls` (it needs no `@mantine/form`); the form hook and
 * schema resolvers come from `@mantine/form` directly.
 *
 * Optional peer: @mantine/form ^9.3.0 — install with: bun add @mantine/form
 */

export { useBasaltForm } from './create-form'
export { inputProps, fieldKey } from './field'
export type { InputProps } from './field'
