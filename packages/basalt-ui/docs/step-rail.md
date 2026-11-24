---
name: StepRail
use when: 'a pipeline, deploy, job run or trace summary shows its steps and their durations'
never when: 'the rows only happen at a time with no duration (use an event list) or are compared by several columns (use a table)'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: [step-rail]
---

# StepRail

A vertical list of steps, each with a bar scaled to the longest one: where the time went, at a
glance. A row is a glyph, the words, the bar with its duration and the time; a step with a
`detail` carries that line underneath. The picture is hidden from assistive technology and a
table behind it says the same, scale included. It has no frame and no phase: compose it in a
`DataPanel` or a section. It never animates.

## Signature

```ts
StepRail({ label, steps }: StepRailProps): ReactElement
  label: string  // Names the rail for assistive technology; the page already shows its heading
  steps: readonly StepRailRow[]  // Steps in display order: the rail never re-sorts
```

`StepRailProps`, `StepRailRow` import from `basalt-ui/cards`: `import type { StepRailProps, StepRailRow } from 'basalt-ui/cards'`.

## Example

```tsx
<StepRail
  label="Deploy steps"
  steps={[
    { id: 'build', label: 'Build image', durationMs: 42_000, at: Date.now() },
    { id: 'probe', label: 'Probe', durationMs: 800, at: Date.now(), tone: 'bad', detail: 'Timed out on /health' },
  ]}
/>
```
