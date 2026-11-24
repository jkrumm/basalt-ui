---
name: Skeleton
use when: 'a one-line placeholder holds the place of loading text in a hand-built layout'
never when: 'a basalt part already draws its own loading state (give it `phase`), or the wait is an action (use a Spinner or a Button `loading`)'
subpath: basalt-ui/ui/skeleton
peers: []
slots: [skeleton, spinner]
---

# Skeleton

A placeholder for one line of loading content. Match the content's text style on the skeleton or
its parent (`text-sm`, `text-lg`) and its height equals the content's; set the width with
`className`. Stack several for a paragraph. It is hidden from assistive tech: name the loading
region with `aria-busy` and a status, not each box.

## Props

### `Skeleton`

A placeholder for one line of loading content. Match the content's text style on the skeleton or
its parent (`text-sm`, `text-lg`) and its height equals the content's; set the width with
`className`. Stack several for a paragraph. It is hidden from assistive tech: name the loading
region with `aria-busy` and a status, not each box.

```ts
Skeleton({ className, ...props }: SkeletonProps): ReactElement
  className?: string  // Layout only (`w-32`, `w-2/3`)
```

### `Spinner`

A loading ring, announced as a status named `Loading` (the `base.spinner.loading` message).
Works with no provider.

```ts
Spinner({ className, ...props }: SpinnerProps): ReactElement
  className?: string  // Layout only (`ml-2`, `text-brand`)
```

## `skeletonVariants`

Part `skeleton`.

No variant axes.

## `spinnerVariants`

Part `spinner`.

No variant axes.

## Slots

- `skeleton`
- `spinner`
