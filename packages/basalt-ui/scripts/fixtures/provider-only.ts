// The provider-only app `check-budgets.ts` measures: the mandatory root entry and nothing else
// (weatherorb's `/map` shape). Resolved against the BUILT `dist`, so it grades what ships.
import { BasaltProvider, createBasaltTheme } from 'basalt-ui'

export const theme = createBasaltTheme()
export { BasaltProvider }
