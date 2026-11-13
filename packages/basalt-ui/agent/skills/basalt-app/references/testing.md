# Testing: the kit rules

`basalt-ui/testing` is for test files and test preloads, never an app bundle. The kit is `installDomShims()`, `settled(options?)` and `SLOTS`; the full table is in `node_modules/basalt-ui/docs/testing.md`.

## Setup

- Call `installDomShims()` once from the test preload, before the first render. It adds `ResizeObserver`, `IntersectionObserver`, `matchMedia`, `scrollTo` and `PointerEvent` where jsdom or happy-dom lack them.
- Pass the router and the query client when the test has them: `await settled({ router, queryClient })`. With no options it is the Base UI mount tick alone.
- Select parts with `SLOTS` (`data-slot`), never by class.

## Rules

- A popup needs `findBy*`. Dialog, Popover, Select, Menu and Tooltip mount on a later frame: press, `await screen.findByRole(...)`, then `await settled()` before you assert on anything else.
- Press with the whole sequence. Base UI opens a Menu on pointer down and a Dialog on click: fire `pointerDown`, `mouseDown`, `pointerUp`, `mouseUp`, `click` on the trigger.
- A Tooltip needs `delay={0}` in a test, or the hover waits 600 ms.
- `Select.Value` shows the raw value unless `items` is passed. The `options` form passes them; the parts form must.
- An open modal hides the rest of the page (`aria-hidden`). Find anything outside it with `{ hidden: true }`.
- Geometry is a browser assertion. jsdom and happy-dom lay nothing out: every rect is zero. Overflow, placement, focus-not-obscured and print belong to a real-browser run; a DOM test asserts structure, roles and state.
- ScrollArea, Slider and virtual lists are not testable in a DOM runner. Test the state they feed and check the rest in the browser.
- Under `bun test`, Testing Library's auto-cleanup does not run. Unmount in `afterEach`.

## Counting commits

A render-count regression is a test, not a stopwatch. Wrap the subtree in `<Profiler id onRender>`, count the calls while an event runs under `act`, and assert a whole-number ceiling. Drive a ticking source from a fake clock and write the cache with `queryClient.setQueryData`, so the count is the same on every run. Bars per route and the compiler check: `performance.md`.
