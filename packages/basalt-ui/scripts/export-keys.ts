/**
 * The exports map lists each eject path (`./core/<module>`) as its own key, and a `null` key hides a
 * module a wildcard would otherwise publish (`./ui/*.guard`). Every reader that treats a key as a
 * subpath (llms.txt, the coverage and budget gates, the generated docs) goes through here: the eject
 * paths are one family, `./core/*` in SURFACES and llms.txt, and a `null` key publishes nothing.
 */

export const EJECT_FAMILY = './core/*'

export const isEjectPath = (key: string): boolean => key.startsWith('./core/')

/** The keys that publish something, each eject path folded into `./core/*`, in map order. */
export function subpathFamilies(exports: Readonly<Record<string, unknown>>): string[] {
  const out = new Set<string>()
  for (const [key, target] of Object.entries(exports)) {
    if (target === null) continue
    out.add(isEjectPath(key) ? EJECT_FAMILY : key)
  }
  return [...out]
}
