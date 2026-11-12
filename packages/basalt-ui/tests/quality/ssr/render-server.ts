/**
 * The server half of the hydration harness, run as its own `bun` process so it has NO DOM: no
 * `window`, no `document`, no test preload. Anything a fixture reads from either during render
 * throws here and nowhere else, which is the point of rendering it this way.
 *
 * argv: <built bundle path> <JSON {locale,timeZone}>. stdout: the JSON-encoded HTML, nothing else.
 * stderr is whatever React or the page logged; the harness fails the row on any of it.
 */
import { createElement } from 'react'
import type { ComponentType } from 'react'
import { renderToString } from 'react-dom/server'

const [bundle, optionsJson] = process.argv.slice(2)
if (bundle === undefined || optionsJson === undefined) {
  throw new Error('usage: render-server.ts <bundle> <json options>')
}
if (typeof window !== 'undefined' || typeof document !== 'undefined') {
  throw new Error('render-server.ts must run with no DOM globals')
}

const mod = (await import(bundle)) as { Page?: ComponentType<Record<string, unknown>> }
if (typeof mod.Page !== 'function') throw new Error(`${bundle} does not export Page`)

const html = renderToString(createElement(mod.Page, JSON.parse(optionsJson)))
process.stdout.write(JSON.stringify(html))
