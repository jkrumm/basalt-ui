---
name: Stepper
use when: 'a form is split into three or more steps taken in order'
never when: 'the steps can be taken in any order (Tabs or sections), or the count changes as the user answers'
subpath: basalt-ui/controls
peers: ['@base-ui/react']
slots: [stepper, stepper-bar, stepper-compact, stepper-list, stepper-segment, stepper-step]
---

# Stepper

The step list of a multi-step form: numbered steps joined by a line, the current one marked, done
ones checked and, with `onStepChange`, reachable. Folds into a one-line count and a segmented bar
when its container is narrow.

## Signature

```ts
Stepper({ steps, current, onStepChange, "aria-label": ariaLabel, variant, className, }: StepperProps): ReactElement
  steps: readonly StepperStep[]  // The steps in order; three or more (a two-step form needs no stepper)
  current: number  // The index of the current step, from 0
  onStepChange?: (index: number) => void  // Makes each done step a button that goes back to it
  aria-label?: string
  variant?: "bar" | "list"  // `list` (default) is the numbered row that folds into a count when narrow; `bar` is the segmented strip alone, named for assistive technology by each step's label and status
  className?: string  // Layout only (`w-full`, `max-w-3xl`)
```

`StepperProps`, `StepperStep` import from `basalt-ui/controls`: `import type { StepperProps, StepperStep } from 'basalt-ui/controls'`.

## Example

```tsx
<Stepper steps={[{ label: 'Basics' }, { label: 'Schedule' }, { label: 'Review' }]} current={step} onStepChange={setStep} />
```
