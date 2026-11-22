import type { EntityChipProps, EntityTitleProps } from './entity'

/**
 * Hand-authored guard for `entity` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. `title` and `label` are required: the name is the entity.
 */

// basalt:guard requires
type CalledTitle = {
  title: string
  subtitle?: string
  size?: 'sm' | 'md' | 'lg'
  level?: 1 | 2 | 3 | 4 | 5 | 6
}

type CalledChip = {
  label: string
  href?: string
  onRemove?: () => void
}

export const requires = (
  c: CalledTitle,
): Pick<EntityTitleProps, 'title' | 'subtitle' | 'size' | 'level'> => c

export const requiresChip = (c: CalledChip): Pick<EntityChipProps, 'label' | 'href' | 'onRemove'> =>
  c

// basalt:guard closed
// @ts-expect-error size is a closed union, not a free string
export const closedSize: Pick<EntityTitleProps, 'size'> = { size: 'xl' }

// @ts-expect-error level is 1 to 6
export const closedLevel: Pick<EntityTitleProps, 'level'> = { level: 7 }

// @ts-expect-error title has no default
export const requiredTitle: Pick<EntityTitleProps, 'title'> = {}

// @ts-expect-error label has no default
export const requiredLabel: Pick<EntityChipProps, 'label'> = {}
