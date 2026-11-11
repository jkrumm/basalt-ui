---
name: Skeleton
use when: ''
never when: ''
subpath: basalt-ui/ui/skeleton
peers: ['@base-ui/react']
slots: [skeleton, spinner]
---

# Skeleton

A placeholder for one line of loading content. Match the content's text style on the skeleton or
its parent (`text-sm`, `text-lg`) and its height equals the content's; set the width with
`className`. Stack several for a paragraph. It is hidden from assistive tech: name the loading
region with `aria-busy` and a status, not each box.

## `skeletonVariants`

Part `skeleton`.

No variant axes.

## `spinnerVariants`

Part `spinner`.

No variant axes.

## Slots

- `skeleton`
- `spinner`
