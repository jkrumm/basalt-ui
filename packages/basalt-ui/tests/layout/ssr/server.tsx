/**
 * Server half of the SSR layout test. Bundled with the SAME bundler as `entry.tsx` and imported
 * from the bundle: a CSS-module class name is the bundler's, and server markup built by another
 * pipeline would hydrate with different class names (a false mismatch).
 */
import { renderToString } from 'react-dom/server'
import { App } from './app'

export const renderApp = (): string => renderToString(<App />)
