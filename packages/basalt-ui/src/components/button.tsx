import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../utils'

const buttonVariants = cva(
  "inline-flex cursor-default items-center justify-center gap-1 whitespace-nowrap rounded text-xs font-normal transition-[background-color,box-shadow] select-none outline-none disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        // Blueprint default: neutral gray background, dark text
        default:
          'bg-light-2 text-dark-2 shadow-btn hover:bg-light-3 active:bg-light-4 dark:bg-dark-3 dark:text-light-3 dark:hover:bg-dark-4 dark:active:bg-dark-5',
        // Blueprint primary intent: saturated blue
        primary:
          'bg-blue text-white shadow-btn-intent hover:bg-blue-2 active:bg-blue-1 dark:hover:bg-blue-2',
        // Blueprint success intent: green
        success: 'bg-green text-white shadow-btn-intent hover:bg-green-2 active:bg-green-1',
        // Blueprint warning intent: orange (dark enough for white text)
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
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
