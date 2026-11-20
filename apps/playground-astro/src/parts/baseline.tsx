import type { ReactElement } from 'react'

/** The smallest React island: what the framework runtime alone costs a page (the baseline of every further island). */
export function Demo(): ReactElement {
  return <span>baseline island</span>
}
