/**
 * The playground's board recipe, as the `cards-kanban` fixture sees it. The layout test bundles the
 * fixture with a resolver that maps `@recipe/<name>` to `apps/playground/src/recipes/<name>.tsx`:
 * the package's `tsc` has `rootDir` at the package, so a relative import of the playground would
 * fail it. Only the two names the fixture reads are declared.
 */
declare module '@recipe/board-demo' {
  import type { ReactElement } from 'react'
  type Col = 'todo' | 'doing' | 'done'
  type Cards = Record<Col, { id: string; title: string; age: string }[]>
  export function seedCards(counts: Record<Col, number>): Cards
  export function BoardDemo(props: { initial: Cards; active?: Col }): ReactElement
}
