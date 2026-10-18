/**
 * The page's format config, passed to `BasaltProvider` once in `main.tsx`: every `basalt-ui/format`
 * formatter and chart date label then reads en-GB ("16 Oct"). The fixtures are UTC instants, so the
 * zone is UTC too: a viewer west of Greenwich would otherwise read the previous day.
 */
export const PAGE_FORMAT = { locale: 'en-GB', timeZone: 'UTC' } as const
