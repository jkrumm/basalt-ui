import { Component } from 'react'
import type { ReactNode } from 'react'

export type PhaseBoundaryProps = {
  children: ReactNode
  /** The error arm. `reset` clears the caught error and renders `children` again. */
  fallback: (caught: { error: unknown; reset: () => void }) => ReactNode
}

type State = { caught: { error: unknown } | null }

/**
 * Catches a throw from a box slot so the frame renders its error arm and its neighbours keep
 * rendering. Retry is `reset`. Client only: a server-render throw reaches the router.
 *
 * @example
 * <PhaseBoundary fallback={({ reset }) => <button onClick={reset}>Retry</button>}>{slot(box)}</PhaseBoundary>
 */
export class PhaseBoundary extends Component<PhaseBoundaryProps, State> {
  override state: State = { caught: null }

  static getDerivedStateFromError(error: unknown): State {
    return { caught: { error } }
  }

  reset = (): void => {
    this.setState({ caught: null })
  }

  override render(): ReactNode {
    const { caught } = this.state
    if (caught === null) return this.props.children
    return this.props.fallback({ error: caught.error, reset: this.reset })
  }
}
