/**
 * The Spotlight mount: `@mantine/spotlight` plus the generated nav + command actions. Registered by
 * `defineNav` and `defineCommands` (never imported by the provider), so an app defining neither ships
 * none of it.
 */
import { Spotlight } from '@mantine/spotlight'
import type { SpotlightActionData } from '@mantine/spotlight'
import { useCallback, useEffect, useState } from 'react'
import { buildSpotlightActions } from './spotlight-actions'
import type { SlotProps } from './slots'

export function SpotlightMount({ router, navCommandLabel, openDevTool }: SlotProps) {
  // Rebuilt on mount and again at every open, so a command's `when()` is read when the palette
  // appears, not frozen at mount — and `detectMac` (inside the builder) never runs during render.
  const [actions, setActions] = useState<SpotlightActionData[]>([])
  const refreshActions = useCallback(
    () => setActions(buildSpotlightActions(router, openDevTool, navCommandLabel)),
    [router, openDevTool, navCommandLabel],
  )
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- reads `navigator` and `when()`: never during render
    refreshActions()
  }, [refreshActions])

  return (
    <Spotlight
      actions={actions}
      onSpotlightOpen={refreshActions}
      shortcut="mod + K"
      maxHeight={420}
    />
  )
}
