import { useSyncExternalStore } from 'react'
import { chartCursor } from 'basalt-ui/charts'
import type { Model, View } from './fixture'

/** The scatter's own cursor group: the beaten list reads the same one, so focus is one state. */
export const CURSOR_GROUP = 'n05'

/** The model under the pointer or the keyboard focus in the scatter; undefined at rest. */
export function useFocusedModel(view: View): Model | undefined {
  const cursor = chartCursor(CURSOR_GROUP)
  const state = useSyncExternalStore(cursor.subscribe, cursor.getState, () => null)
  const x = state?.value?.x
  return x === undefined ? undefined : view.models.find((m) => m.x === x)
}
