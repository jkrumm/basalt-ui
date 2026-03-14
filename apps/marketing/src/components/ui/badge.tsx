import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex min-h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full px-2 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap leading-none transition-colors [&>svg]:pointer-events-none [&>svg]:size-2.5!',
  {
    variants: {
      variant: {
        // Blueprint default tag: gray-mid bg, white text
        default: 'bg-gray-mid-1 text-white',
        // Intent: solid fills matching button intent colors
        primary: 'bg-blue text-white',
        success: 'bg-green text-white',
        warning: 'bg-orange text-white',
        danger: 'bg-red text-white',
        // Minimal: low-opacity bg, colored text (Blueprint "minimal" tag)
        'primary-minimal': 'bg-blue/15 text-blue dark:bg-blue/20 dark:text-blue-4',
        'success-minimal': 'bg-green/15 text-green-1 dark:bg-green/20 dark:text-green-4',
        'warning-minimal': 'bg-orange/15 text-orange-1 dark:bg-orange/20 dark:text-orange-4',
        'danger-minimal': 'bg-red/15 text-red-1 dark:bg-red/20 dark:text-red-4',
        // Neutral/utility
        secondary: 'bg-muted text-muted-foreground dark:bg-muted/60',
        outline: 'border border-border bg-transparent text-foreground',
        ghost: 'bg-transparent text-muted-foreground hover:bg-muted',
        // Legacy ShadCN alias
        destructive: 'bg-red text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant = 'default',
  render,
  ...props
}: useRender.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: 'badge',
      variant,
    },
  })
}

export { Badge, badgeVariants }
