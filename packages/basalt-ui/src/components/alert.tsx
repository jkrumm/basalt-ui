import type { IconProps } from '@tabler/icons-react'
import type * as React from 'react'

import { cn } from '../utils'

type AlertIntent = 'default' | 'primary' | 'success' | 'warning' | 'danger'

const intentStyles: Record<AlertIntent, string> = {
  default: 'border-border bg-muted/50',
  primary: 'border-blue bg-blue/10',
  success: 'border-green bg-green/10',
  warning: 'border-orange bg-orange/10',
  danger: 'border-red bg-red/10',
}

const intentIconStyles: Record<AlertIntent, string> = {
  default: 'text-muted-foreground',
  primary: 'text-blue',
  success: 'text-green',
  warning: 'text-orange',
  danger: 'text-red',
}

function Alert({
  intent = 'default',
  icon,
  title,
  children,
  className,
}: {
  intent?: AlertIntent
  icon?: React.ComponentType<IconProps>
  title?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  const Icon = icon
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn('flex gap-3 rounded-r border-l-4 p-4', intentStyles[intent], className)}
    >
      {Icon && <Icon className={cn('mt-0.5 size-4 shrink-0', intentIconStyles[intent])} />}
      <div className="flex-1 space-y-1">
        {title && <AlertTitle>{title}</AlertTitle>}
        {children && <AlertDescription>{children}</AlertDescription>}
      </div>
    </div>
  )
}

function AlertTitle({ className, children, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="alert-title"
      className={cn('text-xs font-semibold leading-none', className)}
      {...props}
    >
      {children}
    </p>
  )
}

function AlertDescription({ className, children, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="alert-description"
      className={cn('text-xs text-muted-foreground', className)}
      {...props}
    >
      {children}
    </p>
  )
}

export { Alert, AlertTitle, AlertDescription }
