import { BasaltProvider, createBasaltTheme } from 'basalt-ui'

// S0 smoke surface: proves the `workspace:*` link to basalt-ui resolves and the
// provider/theme exports type-check end to end. Real preview routes (charts,
// shell, theme-lab) are added as the package gains surface in S2–S4.
const theme = createBasaltTheme()

export function App() {
  return (
    <BasaltProvider theme={theme}>
      <main style={{ padding: 32 }}>
        <h1>Basalt UI Playground</h1>
        <p>S0 skeleton — package resolves via workspace:*.</p>
      </main>
    </BasaltProvider>
  )
}
