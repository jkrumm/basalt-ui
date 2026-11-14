# State

Where a value lives, decided in this order. Props are in the generated docs: [externalField](docs/external-field.md), [defineControls](docs/define-controls.md); the lane law is `basalt-state.md`.

## Where the value lives

- A link should reproduce it (a filter, a range, a tab, a selection): a URL field of the page's `defineControls` store. A shared link opens the same view.
- Only this device should remember it (a rail state, a density, an unfinished draft): `persisted`, one keyed store with a frozen envelope. Read [persisted](docs/persisted.md) before defining a key.
- Live client state another module owns (a timer, a Zustand slice, a selection): [externalField](docs/external-field.md) binds it as a handle; the recipe is `docs/recipes/memory-state.md`, region `recipe:memory-state` in `apps/playground/src/recipes/memory-state.ts`.
- A server value is a query, not state. Server data and a draft of it stay separate.

## Page state against global memory

- Page state belongs to the page store and resets when the page is left. Global memory is a device preference that outlives the page; it is a preference, not a link.
- A remembered value rides on the nav target and resolves at click time, so Back never re-applies today's preference and a deep link wins. The recipe is `docs/recipes/remembered-values.md`.
- An override on a card names its source: the cue and the reset action come from the renderer, so a local value shows itself.

## Persisted or URL

- Ask "would I send this to a colleague?" Yes is the URL; no is `persisted`.
- A control reads and writes through its handle only, so one field can move lane without a rewrite. An external store handle has no lane and never reaches the URL or storage.

## Server rendering

- The server renders `initial`; a stored value shows after hydration. Create a store per request and keep it in router context, with the store off the module scope.

not guarded:

- Never write `localStorage` or `window.location` directly; a raw key escapes the envelope, the version and `clearOwner`.
- Never read storage inside `validateSearch`; a link must stay reproducible.
- Never keep a filter in `useState`; a reload loses it and a link cannot carry it.
