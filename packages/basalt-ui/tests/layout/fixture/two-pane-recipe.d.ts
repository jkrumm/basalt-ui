/** The playground's two-pane recipe, as the `two-pane` fixture sees it (see `two-pane-fixture.tsx`). */
declare module '@recipe/two-pane' {
  import type { ReactElement } from 'react'
  type Bar = { day: Date; close: number; momentum: number }
  export function seedBars(): Bar[]
  export function TwoPane(props: { bars: Bar[] }): ReactElement
}
