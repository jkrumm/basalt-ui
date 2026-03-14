import type { IconProps } from '@tabler/icons-react'
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
} from '@tabler/icons-react'
import type * as React from 'react'

import { cn } from '../utils'

type AlertIntent = 'default' | 'primary' | 'success' | 'warning' | 'danger'

const intentStyles: Record<AlertIntent, string> = {
  default: 'border-border bg-card',
  primary: 'border-blue/25 bg-blue/8',
  success: 'border-green/25 bg-green/8',
  warning: 'border-orange/25 bg-orange/8',
  danger: 'border-red/25 bg-red/8',
}

const intentIconStyles: Record<AlertIntent, string> = {
  default: 'text-foreground',
  primary: 'text-blue',
  success: 'text-green',
  warning: 'text-orange',
  danger: 'text-red',
}

const intentDefaultIcons: Partial<Record<AlertIntent, React.ComponentType<IconProps>>> = {
  primary: IconInfoCircle,
  success: IconCircleCheck,
  warning: IconAlertTriangle,
  danger: IconAlertCircle,
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
  const Icon = icon ?? intentDefaultIcons[intent]
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn('rounded-md border p-3 text-xs', intentStyles[intent], className)}
    >
      <div className="flex items-start gap-2">
        {Icon && <Icon className={cn('mt-px size-3.5 shrink-0', intentIconStyles[intent])} />}
        <div className="min-w-0 flex-1 space-y-0.5">
          {title && <AlertTitle intent={intent}>{title}</AlertTitle>}
          {children && <AlertDescription>{children}</AlertDescription>}
        </div>
      </div>
    </div>
  )
}

function AlertTitle({
  className,
  intent,
  children,
  ...props
}: React.ComponentProps<'p'> & { intent?: AlertIntent }) {
  return (
    <p
      data-slot="alert-title"
      className={cn(
        'text-xs font-semibold leading-none',
        intent && intentIconStyles[intent],
        className,
      )}
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
