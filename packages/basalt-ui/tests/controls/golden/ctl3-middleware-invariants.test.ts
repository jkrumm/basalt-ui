/** Router-trap invariants flipped by ctl-3: write semantics and middleware order (concept 7). */
import { describe, expect, test } from 'bun:test'
import { api, handle } from './api'
import { mountRouter } from './harness'

const { defineControls, field } = api

describe('middleware and write invariants (ctl-3)', () => {
  test.failing(
    'a no-op write keeps the resets: writing the current value leaves page alone',
    async () => {
      const store = defineControls({
        id: 'list',
        scope: 'page',
        resets: ['page'],
        fields: { tab: field.enum(['all', 'errors'], 'all'), page: field.number({ fallback: 0 }) },
      })
      let write: (v: never) => void = () => {}
      const { router } = await mountRouter({
        root: defineControls({ id: 'g', scope: 'global', fields: {} }),
        pages: { '/a': store },
        url: '/a?tab=errors&page=3',
        probe: () => {
          write = handle(store, 'tab').use()[1] as never
        },
      })
      write('errors' as never)
      await router.load()
      expect(router.state.location.search).toMatchObject({ tab: 'errors', page: 3 })
      write('all' as never)
      await router.load()
      expect(router.state.location.search).not.toHaveProperty('page')
    },
  )

  test.failing(
    'middlewares run [strip, retain]: defaults stay out of links, retained keys survive',
    async () => {
      const globals = defineControls({
        id: 'globals',
        scope: 'global',
        fields: {
          range: field.enum(['1h', '24h', '7d'], '24h'),
          regions: field.multi(['eu', 'us'], []),
        },
      })
      expect(globals.middlewares).toHaveLength(2)
      const { router, go, href } = await mountRouter({
        root: globals,
        pages: { '/a': undefined as never, '/b': undefined as never },
        url: '/a?range=7d',
      })
      await go('/b')
      expect(router.state.location.search).toMatchObject({ range: '7d' })
      expect(href()).not.toContain('regions')
      expect(href()).not.toContain('%5B%5D')
      await go('/a', { range: '24h' })
      expect(href()).not.toContain('range')
    },
  )
})
