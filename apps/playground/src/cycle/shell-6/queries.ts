/**
 * The fleet's queries, one factory per server call. `liveQuery` gives each its freshness class; the
 * routes' loaders read them through `queryClient.query`, the pages' mutations invalidate the `fleet6` root.
 * `retry: false`: a call armed to fail must reach the error screen, not be retried into success.
 */
import { queryOptions } from '@tanstack/react-query'
import { liveQuery } from 'basalt-ui/data'
import { server } from './server'
import type { Dial } from './server'

export const ROOT = 'fleet6'

export const overviewQuery = (days: number, dial: Dial) =>
  liveQuery(
    queryOptions({
      queryKey: [ROOT, 'overview', days, dial ?? null],
      queryFn: () => server.overview({ days, dial }),
      retry: false,
    }),
    'standard',
  )

export const servicesQuery = (dial: Dial) =>
  liveQuery(
    queryOptions({
      queryKey: [ROOT, 'services', dial ?? null],
      queryFn: () => server.services({ dial }),
      retry: false,
    }),
    'standard',
  )

export const deploysQuery = (serviceId: string, dial: Dial) =>
  liveQuery(
    queryOptions({
      queryKey: [ROOT, 'deploys', serviceId, dial ?? null],
      queryFn: () => server.deploys({ serviceId, dial }),
      retry: false,
    }),
    'standard',
  )

export const settingsQuery = (dial: Dial) =>
  liveQuery(
    queryOptions({
      queryKey: [ROOT, 'settings', dial ?? null],
      queryFn: () => server.settings({ dial }),
      retry: false,
    }),
    'static',
  )
