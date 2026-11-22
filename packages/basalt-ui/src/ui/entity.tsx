import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps, ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { AppLink } from '../core/link'
import type { IconComponent, NavTarget } from '../core/ports'
import { Avatar } from './avatar'
import { buttonVariants, pressableVariants } from './button'

/**
 * The `EntityTitle` cva table: avatar, title, optional subtitle and trailing tags on one row. `size`
 * pairs the avatar with its type: 20 px beside a 13 px line, 28 px beside a name and a role, 48 px
 * beside a 16 px name and a 12 px muted line.
 *
 * @example
 * entityTitleVariants({ size: 'lg' }) // class string for a non-`EntityTitle` element
 */
export const entityTitleVariants = cva('min-w-0 max-w-full items-center', {
  variants: {
    size: {
      sm: 'gap-1.5',
      md: 'gap-2',
      lg: 'gap-3',
    },
  },
  defaultVariants: { size: 'md' },
})

/**
 * The `EntityChip` cva table: a 28 px pill of a face and a label. The remove button appears on
 * hover, on focus inside and always under a coarse pointer.
 *
 * @example
 * entityChipVariants()
 */
export const entityChipVariants = cva(
  'group/chip relative inline-flex h-7 max-w-full min-w-0 items-center rounded-full border border-border bg-card text-sm text-foreground transition-colors hover:bg-accent',
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const entityParts = ['entity-title', 'entity-chip'] as const

/** The face of an entity: an image, or a glyph, in a circle or a rounded square. */
export type EntityAvatar = {
  src?: string
  icon?: IconComponent
  shape?: 'person' | 'object'
}

const AVATAR_SIZE = { sm: 'sm', md: 'md', lg: 'lg' } as const
const TITLE = {
  sm: 'text-sm',
  md: 'text-sm font-medium',
  lg: 'text-base font-medium',
} as const
const SUBTITLE = { sm: 'text-xs', md: 'text-xs', lg: 'text-xs' } as const

export type EntityTitleProps = Omit<ComponentProps<'div'>, 'className' | 'children' | 'title'> &
  VariantProps<typeof entityTitleVariants> & {
    /** Layout only (`min-w-0`, `ml-auto`). */
    className?: string
    title: string
    /** One muted line under the title: a role, a domain, a type. */
    subtitle?: string
    /** A face before the title. Absent draws none; `{}` draws the title's initials. */
    avatar?: EntityAvatar
    /** Trailing tags: Lozenges, a Status. Never shrink below their content. */
    tags?: ReactNode
    /** Draws the title as a heading of this level. Absent, the title is inline text. */
    level?: 1 | 2 | 3 | 4 | 5 | 6
    /** Makes the title a link through the installed `LinkComponent`. */
    href?: string | NavTarget
  }

/**
 * An entity's identity on one row: a face, a title, a subtitle and trailing tags. The title
 * truncates; the face and the tags do not. A `level` makes the title a heading, so a record
 * header names the page once.
 *
 * @useWhen a record, a person or a company is named with a face, a type line or tags: a record header, a person cell, a list row
 * @neverWhen only a label in a pill is needed (use EntityChip), or the name is page chrome (name the page in the nav label)
 * @example
 * <EntityTitle level={1} size="lg" title="Acme" subtitle="acme.com" avatar={{ shape: 'object' }} tags={<Lozenge tone="good">Customer</Lozenge>} />
 */
export function EntityTitle({
  title,
  subtitle,
  avatar,
  tags,
  level,
  href,
  size,
  className,
  ...props
}: EntityTitleProps): ReactElement {
  const current = size ?? 'md'
  const Heading = `h${level ?? 2}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  const name =
    href === undefined ? (
      title
    ) : (
      <AppLink
        href={href}
        className="-my-0.5 block truncate rounded-chip py-0.5 focus-ring hover:underline pointer-coarse:-my-3 pointer-coarse:py-3"
      >
        {title}
      </AppLink>
    )
  // A link truncates itself: its focus ring would be clipped by a truncating parent.
  const titleClass = cn(
    'block min-w-0 text-foreground',
    href === undefined && 'truncate',
    TITLE[current],
  )
  return (
    <div
      {...props}
      data-slot="entity-title"
      className={cn(entityTitleVariants({ size }), level ? 'flex' : 'inline-flex', className)}
    >
      {avatar && <Avatar name={title} size={AVATAR_SIZE[current]} aria-hidden="true" {...avatar} />}
      <span className="flex min-w-0 flex-col">
        {level ? (
          <Heading className={titleClass}>{name}</Heading>
        ) : (
          <span className={titleClass}>{name}</span>
        )}
        {subtitle !== undefined && (
          <span className={cn('block truncate text-muted-foreground', SUBTITLE[current])}>
            {subtitle}
          </span>
        )}
      </span>
      {tags !== undefined && <span className="flex shrink-0 items-center gap-1">{tags}</span>}
    </div>
  )
}

export type EntityChipProps = Omit<ComponentProps<'span'>, 'className' | 'children'> &
  VariantProps<typeof entityChipVariants> & {
    /** Layout only (`max-w-48`). */
    className?: string
    /** The record's name. */
    label: string
    avatar?: EntityAvatar
    /** Makes the chip a link to the record, through the installed `LinkComponent`. */
    href?: string | NavTarget
    /** Adds a remove button, revealed on hover and on focus inside; always shown on touch. */
    onRemove?: () => void
    /** Names the remove button. Default `Remove <label>`. */
    removeLabel?: string
  }

/**
 * A record as a pill: a face and a label, optionally a link to the record and a remove button. The
 * link and the button are siblings, never nested.
 *
 * @useWhen a record is linked from another record or a field (an owner, a company, a related deal), alone or in a list that can be edited
 * @neverWhen the value is a state or a tag (use Lozenge), or a group of people (use AvatarStack)
 * @example
 * <EntityChip label="Acme" href="/companies/acme" avatar={{ shape: 'object' }} onRemove={unlink} />
 */
export function EntityChip({
  label,
  avatar,
  href,
  onRemove,
  removeLabel,
  className,
  ...props
}: EntityChipProps): ReactElement {
  const face = avatar && <Avatar name={label} size="sm" aria-hidden="true" {...avatar} />
  const inner = (
    <>
      {face}
      <span className="min-w-0 truncate">{label}</span>
    </>
  )
  const innerClass = cn(
    'flex h-full min-w-0 items-center gap-1.5 rounded-full',
    avatar ? 'pl-1' : 'pl-2.5',
    onRemove ? 'pr-1' : 'pr-2.5',
  )
  return (
    <span {...props} data-slot="entity-chip" className={cn(entityChipVariants(), className)}>
      {href === undefined ? (
        <span className={innerClass}>{inner}</span>
      ) : (
        <AppLink href={href} className={cn(innerClass, pressableVariants())}>
          {inner}
        </AppLink>
      )}
      {onRemove && (
        <button
          type="button"
          aria-label={removeLabel ?? `Remove ${label}`}
          onClick={onRemove}
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm', shape: 'icon' }),
            'mr-1 rounded-full text-muted-foreground opacity-0 group-focus-within/chip:opacity-100 group-hover/chip:opacity-100 hover:text-foreground focus-visible:opacity-100 pointer-coarse:opacity-100',
          )}
        >
          <svg viewBox="0 0 16 16" className="size-3" fill="none" aria-hidden="true">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </span>
  )
}
