/**
 * File routes with codegen (spike S1) at runtime: the brand survives the generated `Route.update`,
 * the middlewares reach the route options, and a child inheriting the layout's validator renders
 * the store's values from the URL. Types: `ctl2-file-routes/types.check.tsx`.
 */
import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { brandOf } from '../../../src/router/controls/brand'
import { makeRouter } from './ctl2-file-routes/router'
import { fin } from './ctl2-file-routes/stores'

type Routes = Record<
  string,
  { options: { validateSearch?: unknown; search?: { middlewares?: unknown[] } } }
>

describe('controls on file routes (ctl-2, S1)', () => {
  test('the brand and the middlewares survive codegen', () => {
    const router = makeRouter(createMemoryHistory({ initialEntries: ['/'] }))
    const routes = router.routesById as unknown as Routes
    expect(brandOf(routes['__root__']?.options.validateSearch)).toEqual({
      id: 'files-globals',
      scope: 'global',
    })
    expect(brandOf(routes['/finance']?.options.validateSearch)?.id).toBe('files-finance')
    expect(brandOf(routes['/gym']?.options.validateSearch)?.id).toBe('files-gym')
    expect(routes['/finance']?.options.search?.middlewares).toBe(fin.middlewares)
    expect(routes['/finance/spending']?.options.validateSearch).toBeUndefined()
  })

  test('an inheriting child renders the store values from the URL', async () => {
    const render = async (url: string) => {
      const router = makeRouter(createMemoryHistory({ initialEntries: [url] }))
      await router.load()
      return renderToString(createElement(RouterProvider as never, { router }))
    }
    const html = await render('/finance/spending?month=2025-02&merchant=acme')
    expect(html).toContain('&quot;month&quot;:&quot;2025-02&quot;')
    expect(html).toContain('&quot;merchant&quot;:&quot;acme&quot;')
    expect(await render('/finance/spending')).not.toContain('acme')
  })
})
