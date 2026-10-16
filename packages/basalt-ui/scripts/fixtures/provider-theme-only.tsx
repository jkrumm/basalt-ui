// The theme-only app `check-budgets.ts` measures: `createBasaltTheme` and nothing else. The theme
// configures ~45 Mantine components by name; it must not value-import any of them (a bundle that
// never renders `Pagination` must not ship it). Resolved against the BUILT `dist`.
import { createBasaltTheme } from 'basalt-ui'

export const theme = createBasaltTheme()
