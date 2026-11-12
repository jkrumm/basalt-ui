/**
 * The positive control: a page that puts `Math.random()` in a value, so the server and the client
 * print different text. `expectHydrates` must reject it with `Hydration failed`; a detector that
 * passes this fixture detects nothing.
 */
export function Page() {
  // oxlint-disable-next-line react/purity -- the impurity is the point of the positive control
  return <p data-slot="fixture">{Math.random()}</p>
}
