import type { BasaltMessages } from './index'

/** The strings the shared primitives (`basalt-ui/ui/*`) print themselves; `base.spinner.loading` names a `Spinner`. */
export type BaseMessages = Record<'base.spinner.loading', string>

export const base = {
  'base.spinner.loading': 'Loading',
} satisfies Partial<BasaltMessages>
