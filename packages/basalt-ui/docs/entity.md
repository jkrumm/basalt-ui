---
name: Entity
use when: 'a record, a person or a company is named with a face, a type line or tags: a record header, a person cell, a list row'
never when: 'only a label in a pill is needed (use EntityChip), or the name is page chrome (name the page in the nav label)'
subpath: basalt-ui/ui/entity
peers: ['@base-ui/react']
slots: [entity-title, entity-chip]
---

# Entity

An entity's identity on one row: a face, a title, a subtitle and trailing tags. The title
truncates; the face and the tags do not. A `level` makes the title a heading, so a record
header names the page once.

## Props

### `EntityTitle`

```ts
EntityTitle({ title, subtitle, avatar, tags, level, href, size, className, ...props }: EntityTitleProps): ReactElement
  size?: "sm" | "md" | "lg" | null
  className?: string  // Layout only (`min-w-0`, `ml-auto`)
  title: string
  subtitle?: string  // One muted line under the title: a role, a domain, a type
  avatar?: EntityAvatar  // A face before the title
  tags?: ReactNode  // Trailing tags: Lozenges, a Status
  level?: 1 | 2 | 3 | 4 | 5 | 6  // Draws the title as a heading of this level
  href?: string | NavTarget  // Makes the title a link through the installed `LinkComponent`
```

### `EntityChip`

A record as a pill: a face and a label, optionally a link to the record and a remove button. The
link and the button are siblings, never nested.

```ts
EntityChip({ label, avatar, href, onRemove, removeLabel, className, ...props }: EntityChipProps): ReactElement
  className?: string  // Layout only (`max-w-48`)
  label: string  // The record's name
  avatar?: EntityAvatar
  href?: string | NavTarget  // Makes the chip a link to the record, through the installed `LinkComponent`
  onRemove?: () => void  // Adds a remove button, revealed on hover and on focus inside; always shown on touch
  removeLabel?: string  // Names the remove button
```

## `entityTitleVariants`

Part `entity-title`.

- `size`: `sm`, `md`, `lg` (default `md`)

## `entityChipVariants`

Part `entity-chip`.

No variant axes.

## Slots

- `entity-title`
- `entity-chip`
