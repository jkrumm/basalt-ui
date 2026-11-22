import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import { useState } from 'react'
import type { ComponentProps, ReactElement } from 'react'
import { cn } from '../core/cn'
import type { IconComponent } from '../core/ports'

/**
 * The `Avatar` cva table: a fixed box that never changes size when its image arrives or fails.
 * `size` is the ladder from a 16 px table cell to a 48 px record header; `shape` is a circle for a
 * person and a rounded square for a company or an object (5 px up to 28 px, 8 px at 48).
 *
 * @example
 * avatarVariants({ size: 'lg', shape: 'object' }) // class string for a non-`Avatar` element
 */
export const avatarVariants = cva(
  'relative isolate inline-flex shrink-0 items-center justify-center overflow-hidden font-medium text-foreground select-none forced-colors:border forced-colors:border-current',
  {
    variants: {
      size: {
        xs: 'size-4 text-micro',
        sm: 'size-5 text-micro',
        md: 'size-7 text-xs',
        lg: 'size-12 text-base',
      },
      shape: {
        person: 'rounded-full',
        object: 'rounded-chip',
      },
    },
    compoundVariants: [{ size: 'lg', shape: 'object', class: 'rounded-ctrl' }],
    defaultVariants: { size: 'md', shape: 'person' },
  },
)

/**
 * The `AvatarStack` cva table: overlapping avatars, each ringed in the ground they sit on so the
 * overlap reads as a cut, not a blend. `ground` names that surface.
 *
 * @example
 * avatarStackVariants({ size: 'sm', ground: 'card' })
 */
export const avatarStackVariants = cva('inline-flex shrink-0 items-center', {
  variants: {
    size: {
      xs: '[&>*]:ring-1 [&>*+*]:-ml-0.5',
      sm: '[&>*]:ring-1 [&>*+*]:-ml-1',
      md: '[&>*]:ring-2 [&>*+*]:-ml-1.5',
      lg: '[&>*]:ring-2 [&>*+*]:-ml-2.5',
    },
    ground: {
      surface: '[&>*]:ring-surface',
      card: '[&>*]:ring-card',
      popover: '[&>*]:ring-popover',
    },
  },
  defaultVariants: { size: 'sm', ground: 'surface' },
})

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const avatarParts = ['avatar', 'avatar-stack'] as const

/** The fallback tints: five of the chart hues at the theme's wash, picked from the name. */
const TINTS = ['bg-chart-1/15', 'bg-chart-2/15', 'bg-chart-3/15', 'bg-chart-4/15', 'bg-chart-5/15']

/** A stable index from a name: the same name is the same tint in every list and every session. */
function tintOf(name: string): string {
  let hash = 5381
  for (const char of name.trim().toLowerCase())
    hash = (hash * 33 + (char.codePointAt(0) ?? 0)) >>> 0
  return TINTS[hash % TINTS.length] ?? TINTS[0]!
}

/** One letter of the first word and one of the last: `Ada Lovelace` is `AL`, `Acme` is `A`. */
function initialsOf(name: string, max: 1 | 2): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const first = words[0]
  const last = words.length > 1 ? words.at(-1) : undefined
  const letters = [first, last].flatMap((w) => (w ? [Array.from(w)[0] ?? ''] : []))
  return letters.slice(0, max).join('').toUpperCase()
}

const ICON_SIZE = { xs: 'size-3', sm: 'size-3', md: 'size-4', lg: 'size-6' } as const

type AvatarShape = NonNullable<VariantProps<typeof avatarVariants>['shape']>
type ImageState = { src: string; state: 'loaded' | 'failed' }

/** What an avatar shows when it has a face to draw; `name` is the person's or the object's name. */
export type AvatarEntry = {
  name: string
  /** An image URL. Until it loads, and if it fails, the initials or the icon stay in the box. */
  src?: string
  /** A glyph for the fallback, in place of the initials: a company or an object with no logo. */
  icon?: IconComponent
}

export type AvatarProps = Omit<
  ComponentProps<'span'>,
  'className' | 'children' | 'color' | 'style' | 'role'
> &
  VariantProps<typeof avatarVariants> &
  AvatarEntry & {
    /** Layout only (`ml-auto`, `ring-2`). */
    className?: string
  }

/**
 * A face for a person or an object: an image over a fallback of initials or an icon, tinted from the
 * name. The box is fixed, so a late or failed image changes nothing around it. It is named for
 * assistive tech by `name`; pass `aria-hidden` when the name is printed beside it.
 *
 * @useWhen a person or a company needs a face in a table cell, a record header, a row or a card: round for a person, a rounded square for an object
 * @neverWhen the image is content (use an `<img>` with its own alt), or a status is the message (use Status)
 * @example
 * <Avatar name="Ada Lovelace" src={user.photo} />
 * <Avatar name="Acme" shape="object" size="lg" icon={Building2} />
 */
export function Avatar({
  name,
  src,
  icon: Icon,
  size,
  shape,
  className,
  ...props
}: AvatarProps): ReactElement {
  const [seen, setSeen] = useState<ImageState | undefined>()
  const state = seen !== undefined && seen.src === src ? seen.state : undefined
  const current = size ?? 'md'
  const showsImage = src !== undefined && state !== 'failed'
  return (
    <span
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a face drawn from initials or an icon has no `<img>` to name; the image on top repeats the name inside a role img
      role="img"
      aria-label={name}
      {...props}
      data-slot="avatar"
      data-image={state === 'loaded' ? '' : undefined}
      className={cn(avatarVariants({ size, shape }), 'bg-card', className)}
    >
      <span aria-hidden="true" data-tint="" className={cn('absolute inset-0', tintOf(name))} />
      {Icon ? (
        <Icon className={cn('relative', ICON_SIZE[current])} aria-hidden="true" />
      ) : (
        <span aria-hidden="true" className="relative">
          {initialsOf(name, current === 'xs' ? 1 : 2)}
        </span>
      )}
      {showsImage && (
        <img
          key={src}
          src={src}
          alt={name}
          decoding="async"
          draggable={false}
          ref={(img) => {
            if (img && img.naturalWidth > 0 && state === undefined) {
              setSeen({ src, state: 'loaded' })
            }
          }}
          onLoad={() => setSeen({ src, state: 'loaded' })}
          onError={() => setSeen({ src, state: 'failed' })}
          className={cn(
            'absolute inset-0 size-full object-cover',
            state === 'loaded' ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
    </span>
  )
}

export type AvatarStackProps = Omit<ComponentProps<'div'>, 'className' | 'children' | 'role'> &
  VariantProps<typeof avatarStackVariants> & {
    /** Layout only (`ml-auto`). */
    className?: string
    /** Names the group for assistive tech: `Assignees`, `Viewing now`. */
    label: string
    people: readonly AvatarEntry[]
    /** How many faces show before the `+N`. Default 4. */
    max?: number
    shape?: AvatarShape
  }

/**
 * Faces side by side, overlapping, with a `+N` for the rest. The overflow chip is named `N more`.
 *
 * @useWhen several people share one record, a row or a header (assignees, members, who is viewing)
 * @neverWhen the people need their names read (use one `EntityChip` each), or there is one (use Avatar)
 * @example
 * <AvatarStack label="Assignees" people={[{ name: 'Ada Lovelace' }, { name: 'Alan Turing' }]} />
 */
export function AvatarStack({
  label,
  people,
  max = 4,
  size,
  shape,
  ground,
  className,
  ...props
}: AvatarStackProps): ReactElement {
  const shown = Math.max(1, max)
  const rest = people.length - shown
  const current = size ?? 'sm'
  return (
    <div
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a `fieldset` is a form group; this is a named set of faces
      role="group"
      aria-label={label}
      {...props}
      data-slot="avatar-stack"
      className={cn(avatarStackVariants({ size, ground }), className)}
    >
      {people.slice(0, shown).map((person, i) => (
        <Avatar key={`${person.name}-${i}`} {...person} size={current} shape={shape} />
      ))}
      {rest > 0 && (
        <span
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- the count is text on a box, named `N more`; there is no `<img>`
          role="img"
          aria-label={`${rest} more`}
          className={cn(avatarVariants({ size: current, shape }), 'bg-card tabular-nums')}
        >
          <span aria-hidden="true" className="absolute inset-0 bg-selected" />
          <span aria-hidden="true" className="relative">
            {`+${rest}`}
          </span>
        </span>
      )}
    </div>
  )
}
