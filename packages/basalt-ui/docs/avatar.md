---
name: Avatar
use when: 'a person or a company needs a face in a table cell, a record header, a row or a card: round for a person, a rounded square for an object'
never when: 'the image is content (use an `<img>` with its own alt), or a status is the message (use Status)'
subpath: basalt-ui/ui/avatar
peers: []
slots: [avatar, avatar-stack]
---

# Avatar

A face for a person or an object: an image over a fallback of initials or an icon, tinted from the
name. The box is fixed, so a late or failed image changes nothing around it. It is named for
assistive tech by `name`; pass `aria-hidden` when the name is printed beside it.

## Props

### `Avatar`

```ts
Avatar({ name, src, icon: Icon, size, shape, className, ...props }: AvatarProps): ReactElement
  size?: "xs" | "sm" | "md" | "lg" | null
  shape?: "object" | "person" | null
  name: string
  src?: string  // An image URL
  icon?: IconComponent  // A glyph for the fallback, in place of the initials: a company or an object with no logo
  className?: string  // Layout only (`ml-auto`, `ring-2`)
```

### `AvatarStack`

Faces side by side, overlapping, with a `+N` for the rest. The overflow chip is named `N more`.

```ts
AvatarStack({ label, people, max, size, shape, ground, className, ...props }: AvatarStackProps): ReactElement
  size?: "xs" | "sm" | "md" | "lg" | null
  ground?: "popover" | "surface" | "card" | null
  className?: string  // Layout only (`ml-auto`)
  label: string  // Names the group for assistive tech: `Assignees`, `Viewing now`
  people: readonly AvatarEntry[]
  max?: number  // How many faces show before the `+N`
  shape?: AvatarShape
```

## `avatarVariants`

Part `avatar`.

- `size`: `xs`, `sm`, `md`, `lg` (default `md`)
- `shape`: `person`, `object` (default `person`)

## `avatarStackVariants`

Part `avatar-stack`.

- `size`: `xs`, `sm`, `md`, `lg` (default `sm`)
- `ground`: `surface`, `card`, `popover` (default `surface`)

## Slots

- `avatar`
- `avatar-stack`
