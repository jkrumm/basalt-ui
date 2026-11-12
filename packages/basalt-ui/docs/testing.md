# Testing a basalt-ui app

`basalt-ui/testing` is test-time tooling. Import it from test files and test preloads only; it never
belongs in an app bundle.

```ts
import { installDomShims, settled, SLOTS } from 'basalt-ui/testing'
```

## The kit

| Export              | Does                                                                                                                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `installDomShims()` | Adds `ResizeObserver`, `IntersectionObserver`, `matchMedia`, `scrollTo` and `PointerEvent` where jsdom or happy-dom lack them. Idempotent: a second call changes nothing. Throws under any other runtime. |
| `settled(options?)` | Resolves when the Base UI mount tick has passed and the router and query client you pass are idle.                                                                                                        |
| `SLOTS`             | Every `data-slot` each `ui/*` module renders. Select parts with it, never by class.                                                                                                                       |

Call `installDomShims()` once, from the test preload, before the first render. Pass the router and
the client to `settled` when the test has them: `await settled({ router, queryClient })`. With no
options it is the mount tick alone.

## Rules the kit teaches

- **A popup needs `findBy*`.** Dialog, Popover, Select, Menu and Tooltip mount on a later frame, so
  `getBy*` right after the press finds nothing. Press, then `await screen.findByRole(...)`, then
  `await settled()` before asserting on what else changed.
- **A Tooltip needs `delay={0}`.** The default waits 600 ms of hover. A test that hovers and
  asserts passes `delay={0}` on the Tooltip (or fakes the wait, which `settled` does not).
- **`Select.Value` shows the raw value unless `items` is passed.** The `options` form of `Select`
  passes them; the parts form must give `Select` an `items` array, or the trigger reads `b`, not
  `Beta`.
- **An open modal hides the rest of the page.** Base UI sets `aria-hidden` on everything behind a
  Dialog or Sheet, so `getByRole('button', { name: 'Open' })` no longer finds the trigger. Use
  `{ hidden: true }` for anything outside the dialog.
- **Geometry is a browser-lane assertion.** Neither jsdom nor happy-dom lays anything out: every
  rect is zero and a floating popup has no position. Overflow, placement, focus-not-obscured and
  print belong to the real-browser lane; a DOM test asserts structure, roles and state.
- **Press with the whole event sequence.** Base UI opens a Menu on pointer down and a Dialog on
  click. Fire `pointerDown`, `mouseDown`, `pointerUp`, `mouseUp` and `click` on the trigger.
- ScrollArea, Slider and virtual lists are not meaningfully testable in a DOM runner; test the
  state they feed, and check the rest in the browser.

## One test, two runners

The kit's own tests run under happy-dom (the plain `bun test`) and under jsdom. A process holds one
DOM, so the jsdom run is a second `bun test` started with a config that preloads jsdom instead of
happy-dom: `bun --config=<your bunfig> test <files>` (`bun test -c` does not take a config).

## Server rendering

The repo runs an internal hydration harness over `tokens` and the root subpath: `vite build --ssr`,
`renderToString` in a process with no DOM, then `hydrateRoot` in jsdom, failing on any recoverable
error or `console.error`. A positive control (`Math.random()` in a value) must raise
`Hydration failed`, so a harness that passes everything cannot go unnoticed. It is not exported; it
becomes a public `expectHydrates` when the first consumer calls it.

The law it holds every path to: no `Date.now()`, `Math.random()`, `window`, `localStorage`,
`matchMedia`, `navigator.language` or measured size in render. `locale` and `timeZone` are props
that read the same on both sides, and `lang` is written in an effect.
