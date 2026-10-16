// The embedded-provider app `check-budgets.ts` measures: `<BasaltProvider spotlight={false}>` around
// children, with no defineNav / defineCommands / defineOverlays anywhere (weatherorb's `/map` shape).
// Resolved against the BUILT `dist`, so it grades what ships.
import { BasaltProvider, createBasaltTheme } from 'basalt-ui'
import type { ReactNode } from 'react'

export const theme = createBasaltTheme()

export function App({ children }: { children: ReactNode }) {
  return <BasaltProvider spotlight={false}>{children}</BasaltProvider>
}
