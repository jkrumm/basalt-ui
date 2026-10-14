/** Client half of the SSR layout test: adopts the server HTML. Loaded only when the test says so. */
import '../../../src/styles.css'
import { hydrateRoot } from 'react-dom/client'
import { App } from './app'

declare global {
  interface Window {
    basaltHydrated?: boolean
    basaltHydrationErrors?: string[]
  }
}

const container = document.getElementById('root')
if (!container) throw new Error('ssr host is missing #root')
window.basaltHydrationErrors = []
const errors = window.basaltHydrationErrors
// oxlint-disable-next-line no-console -- the hydration warnings are the signal this probe collects
const originalError = console.error
// oxlint-disable-next-line no-console -- same
console.error = (...args: unknown[]) => {
  errors.push(args.map(String).join(' '))
  originalError(...args)
}
hydrateRoot(container, <App />, {
  onRecoverableError: (error) => errors.push(String(error)),
})
requestAnimationFrame(() =>
  requestAnimationFrame(() => {
    window.basaltHydrated = true
  }),
)
