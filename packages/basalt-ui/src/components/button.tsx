import { Button as ButtonPrimitive } from '@base-ui/react/button'
import type { IconProps } from '@tabler/icons-react'
import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '../utils'

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded text-xs font-normal transition-[background-color,box-shadow] select-none outline-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring/75 focus-visible:ring-offset-1 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        // Blueprint default: neutral gray background, dark text
        default:
          'bg-light-2 text-dark-2 shadow-btn hover:bg-light-3 active:bg-gray-light-2 dark:bg-dark-3 dark:text-light-3 dark:hover:bg-dark-4 dark:active:bg-dark-5',
        // Blueprint primary intent: saturated blue
        primary:
          'bg-blue text-white shadow-btn-intent hover:bg-blue-2 active:bg-blue-1 dark:hover:bg-blue-2',
        // Blueprint success intent: green
        success: 'bg-green text-white shadow-btn-intent hover:bg-green-2 active:bg-green-1',
        // Warning intent: orange with white text for visual consistency with other intents
        warning: 'bg-orange text-white shadow-btn-intent hover:bg-orange-2 active:bg-orange-1',
        // Blueprint danger intent: red
        danger: 'bg-red text-white shadow-btn-intent hover:bg-red-2 active:bg-red-1',
        // Minimal / ghost: transparent, hover muted
        ghost:
          'bg-transparent text-foreground hover:bg-muted active:bg-muted/80 dark:hover:bg-muted/50',
        // Outline: explicit border, same as default but transparent bg
        outline:
          'border border-border bg-transparent text-foreground hover:bg-muted dark:border-border dark:hover:bg-muted/50',
        // Legacy ShadCN alias
        secondary:
          'bg-secondary text-secondary-foreground shadow-btn hover:bg-secondary/80 dark:hover:bg-secondary/70',
        // Link
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        xs: 'h-5 px-1.5 text-[0.625rem]',
        sm: 'h-6 px-2.5',
        default: 'h-[1.875rem] px-3',
        lg: 'h-9 px-4 text-sm',
        icon: 'size-[1.875rem]',
        'icon-sm': 'size-6',
        'icon-xs': 'size-5 text-[0.625rem]',
        'icon-lg': 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  fill,
  leftIcon,
  rightIcon,
  loading,
  disabled,
  children,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    leftIcon?: React.ComponentType<IconProps>
    rightIcon?: React.ComponentType<IconProps>
    loading?: boolean
    fill?: boolean
  }) {
  const LeftIcon = leftIcon
  const RightIcon = rightIcon
  return (
    <ButtonPrimitive
      data-slot="button"
      disabled={loading || disabled}
      className={cn(buttonVariants({ variant, size, className }), fill && 'w-full')}
      {...props}
    >
      {LeftIcon && <LeftIcon className="size-3.5" />}
      {children}
      {loading ? (
        <svg
          className="size-3.5 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : (
        RightIcon && <RightIcon className="size-3.5" />
      )}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
