// console's base-nova Button, edited: a shadcn file that shares no ancestry with basalt's seed.
import { Button as BaseButton } from '@base-ui/react/button'
import type { ComponentProps, ReactElement } from 'react'

type ButtonProps = ComponentProps<typeof BaseButton> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'link'
  size?: 'md' | 'icon'
}

export function Button({
  variant = 'secondary',
  size = 'md',
  ...props
}: ButtonProps): ReactElement {
  return <BaseButton data-slot="button" data-variant={variant} data-size={size} {...props} />
}
