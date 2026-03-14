import type { IconProps } from '@tabler/icons-react'
import type * as React from 'react'

import { cn } from '../utils'

function InputGroup({
  children,
  className,
  hasLeftAddon,
  hasRightAddon,
}: {
  children: React.ReactNode
  className?: string
  hasLeftAddon?: boolean
  hasRightAddon?: boolean
}) {
  return (
    <div
      data-slot="input-group"
      className={cn(
        'relative flex items-center',
        hasLeftAddon && '[&>[data-slot=input]]:pl-8',
        hasRightAddon && '[&>[data-slot=input]]:pr-8',
        className,
      )}
    >
      {children}
    </div>
  )
}

function InputGroupAddon({
  icon,
  children,
  side,
  className,
}: {
  icon?: React.ComponentType<IconProps>
  children?: React.ReactNode
  side: 'left' | 'right'
  className?: string
}) {
  const Icon = icon
  return (
    <span
      data-slot="input-group-addon"
      className={cn(
        'pointer-events-none absolute inset-y-0 flex items-center text-muted-foreground [&_svg]:size-3.5',
        side === 'left' ? 'left-2.5' : 'right-2.5',
        className,
      )}
    >
      {Icon ? <Icon className="size-3.5" /> : children}
    </span>
  )
}

export { InputGroup, InputGroupAddon }
