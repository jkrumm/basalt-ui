import { Button } from '@mantine/core'
import type { ReactElement } from 'react'
import { RetryButton } from '../../../src/common/retry-button'

/**
 * The Mantine `Button size="xs" variant="default"` the shared Retry stands in for, and the shared
 * `RetryButton` itself, side by side (`data-testid="retry-mantine"` / `"retry-shared"`).
 */
export function RetryParityFixture(): ReactElement {
  return (
    <div style={{ display: 'flex', gap: 16, padding: 16 }}>
      <span data-testid="retry-mantine">
        <Button size="xs" variant="default">
          Retry
        </Button>
      </span>
      <span data-testid="retry-shared">
        <RetryButton onClick={() => {}} />
      </span>
    </div>
  )
}
