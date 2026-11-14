// The table parts the GA `basalt-ui/table` barrel carries and the built package has not exported
// yet: typed here from the build so the saved-views recipe compiles in its published form. Delete
// this file when `./table` exports them (a duplicate declaration then fails the typecheck).
import type { tableCodec as codec } from '../../../../packages/basalt-ui/dist/table/core/codec'
import type { TableToolbar as toolbar } from '../../../../packages/basalt-ui/dist/table/parts/toolbar'

declare module 'basalt-ui/table' {
  export const TableToolbar: typeof toolbar
  export const tableCodec: typeof codec
}
