import type { Collection, Photo, Verdict } from './kit-photos'

/** The day the Kit's data is read on, so a relative range gives the same rows in every shot. */
const TODAY = Date.UTC(2026, 10, 14)

const daysBefore = (days: number): string =>
  new Date(TODAY - days * 86_400_000).toISOString().slice(0, 10)

/** What the Kit's filter fields hold: the search text, a collection, a verdict and a taken range. */
export type PhotoFilters = {
  search: string
  collection: 'all' | Collection
  verdict: 'all' | Verdict
  taken: { preset: string; from?: string | undefined; to?: string | undefined }
}

function inRange(day: string, taken: PhotoFilters['taken']): boolean {
  if (taken.preset === '30d') return day >= daysBefore(30)
  if (taken.preset === '90d') return day >= daysBefore(90)
  if (taken.preset === 'custom')
    return day >= (taken.from ?? '') && day <= (taken.to ?? '9999-12-31')
  return true
}

/** The photos the filters keep; the endpoint's work, done in the page because the data is a fixture. */
export function filterPhotos(photos: readonly Photo[], filters: PhotoFilters): Photo[] {
  const q = filters.search.trim().toLowerCase()
  return photos.filter(
    (photo) =>
      (q === '' || `${photo.title} ${photo.camera} ${photo.lens}`.toLowerCase().includes(q)) &&
      (filters.collection === 'all' || photo.collection === filters.collection) &&
      (filters.verdict === 'all' || photo.verdict === filters.verdict) &&
      inRange(photo.taken, filters.taken),
  )
}
