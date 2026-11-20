/**
 * The hydrating side of `static-measured.layout.test.ts`: hydrates the server-rendered `#root` with
 * the same parts and flags `window.staticMeasuredHydrated` once React has committed them.
 */
import { hydrateRoot } from 'react-dom/client'
import { Parts } from './static-measured-parts'

const root = document.getElementById('root')
if (!root) throw new Error('fixture host is missing #root')
hydrateRoot(root, <Parts />, {
  onRecoverableError: (error) => {
    ;(window as unknown as { staticMeasuredErrors: string[] }).staticMeasuredErrors.push(
      String(error),
    )
  },
})
requestAnimationFrame(() =>
  requestAnimationFrame(() => {
    ;(window as unknown as { staticMeasuredHydrated: boolean }).staticMeasuredHydrated = true
  }),
)
