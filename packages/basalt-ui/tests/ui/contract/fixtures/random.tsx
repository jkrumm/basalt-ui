// A deliberate offender: output differs between the server render and the hydrating render.
export function Random() {
  // oxlint-disable-next-line react/purity -- the negative control needs an impure render
  return <span data-slot="random">{Math.random()}</span>
}
