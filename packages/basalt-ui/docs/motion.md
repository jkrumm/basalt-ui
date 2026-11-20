---
name: Motion guide
use when: 'an element enters, leaves or moves: picking a duration, easing, spring, stagger or an enter/exit preset, in React or CSS only'
never when: 'a basalt part already animates (dialog, sheet, popover, menu, tooltip, toast), or a page or view transition (the router owns it)'
peers: [motion]
slots: []
---

# Motion

Time every animation from the basalt scale, enter and exit with a preset, and let reduced motion collapse it for you. A duration, delay, spring or easing written as a number or a class like `duration-300` is a `basalt/motion-literal` or `tw-off-law` finding.

## The scale

| Role                              | CSS variable             | Tailwind        | JS (`basalt-ui/tokens`)             | Value                             |
| --------------------------------- | ------------------------ | --------------- | ----------------------------------- | --------------------------------- |
| Hover, press, small overlays      | `--basalt-dur-fast`      | `duration-fast` | `MOTION_DURATION.fast`              | 150 ms                            |
| Enter, exit, reveal               | `--basalt-dur-base`      | `duration-base` | `MOTION_DURATION.base`              | 250 ms                            |
| Large surfaces: sheet, dock, peek | `--basalt-dur-slow`      | `duration-slow` | `MOTION_DURATION.slow`              | 400 ms                            |
| A change in place                 | `--basalt-ease`          | `ease-standard` | `MOTION_EASE_STANDARD`              | cubic-bezier(0.4, 0, 0.2, 1)      |
| An element arriving               | `--basalt-ease-enter`    | `ease-enter`    | `MOTION_EASE_ENTER`                 | cubic-bezier(0, 0, 0.2, 1)        |
| An element leaving                | `--basalt-ease-exit`     | `ease-exit`     | `MOTION_EASE_EXIT`                  | cubic-bezier(0.4, 0, 1, 1)        |
| Spring, no overshoot              | `--basalt-spring`        | none            | `MOTION_SPRING.standard`            | settles in 500 ms                 |
| Spring, light overshoot           | `--basalt-spring-bouncy` | none            | `MOTION_SPRING.bouncy`              | settles in 700 ms, 3 % over       |
| Stagger step                      | `--basalt-stagger`       | `stagger`       | `MOTION_STAGGER`, `staggerDelay(i)` | 30 ms per item, never past 400 ms |

JS durations are seconds, the unit `motion` takes. A CSS spring variable holds a duration and a curve, so `transition: transform var(--basalt-spring)` is complete. Pick the shortest step that reads: a hover is `fast`, a row arriving is `base`, only a surface that crosses the screen is `slow`. Use `bouncy` for a thing the user just caused to land (a dealt card, a chip added), never for data arriving.

## The presets

| Preset    | Use for                                             | Enter                                             | Exit              |
| --------- | --------------------------------------------------- | ------------------------------------------------- | ----------------- |
| `overlay` | a popover, menu or panel you build yourself         | fade, scale from 0.96, fast                       | the reverse, fast |
| `item`    | a row or list item arriving, staggered by its index | fade, rise 4 px, base                             | fade, fast        |
| `card`    | a card or tile arriving                             | fade, rise 8 px, scale from 0.98, standard spring | fade, fast        |

basalt's own dialog, sheet, popover, menu, tooltip and toast already animate; never wrap them in a preset.

React, with `motion` installed (`basalt-ui/motion` needs it):

```tsx
import { AnimatePresence, motion } from 'motion/react'
import { useMotionPreset } from 'basalt-ui/motion'

function Row({ row, index }: { row: Row; index: number }) {
  const enter = useMotionPreset('item', { index })
  return <motion.li {...enter}>{row.name}</motion.li>
}
// <AnimatePresence>{rows.map((row, i) => <Row key={row.id} row={row} index={i} />)}</AnimatePresence>
```

A hand-made transition takes the constants: `transition={{ duration: MOTION_DURATION.base, ease: MOTION_EASE_ENTER }}`, `transition={MOTION_SPRING.standard}`, `transition={{ delay: staggerDelay(i) }}`.

CSS only (an Astro or static page, no React): load `basalt-ui/tokens.css` and `basalt-ui/typography.css`, then

```html
<li class="animate-enter-item stagger" style="--i: 3">…</li>
<!-- Tailwind -->
<li
  style="animation: basalt-enter-item var(--basalt-dur-base) var(--basalt-ease-enter) both; animation-delay: calc(3 * var(--basalt-stagger))"
>
  …
</li>
```

The keyframes are `basalt-enter-overlay`, `basalt-enter-item` and `basalt-enter-card` (the card runs on `var(--basalt-spring)`). An exit works in CSS only while the element stays in the DOM until it ends (a `<dialog>` with `transition-behavior: allow-discrete`, a Base UI part). Removing a list item with an exit, layout and reorder animation, drag, and a spring that keeps its speed when interrupted need `motion`.

## Reduced motion

Under `prefers-reduced-motion: reduce` every preset lands on its end state at once: no movement, no scale, no fade, no stagger. You never ask for it:

- every motion variable is `0ms` in `tokens.css`, so a `duration-*` class and your own `var(--basalt-dur-base)` end at once;
- the `basalt-enter-*` keyframes exist only while motion is allowed, so an `animate-enter-*` class or your own `animation: basalt-enter-item …` attaches no animation and the element renders in its end state;
- `useMotionPreset` reads `useReducedMotionConfig()`, so the OS setting and an app's `<MotionConfig reducedMotion="always">` both collapse it.

A transition you build from the constants yourself does not collapse on its own: build it with `motionPreset(name, { reduced })` or read `useReducedMotion()` from `motion/react` and pass `{ duration: 0 }`. Never flash anything more than three times a second, whatever the setting.

## Out of scope

Page and view transitions belong to the router (`basalt-ui/router`); scroll-driven animation and gestures have no preset. Build those with `motion` on the scale above.
