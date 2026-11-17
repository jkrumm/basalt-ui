import { createContext } from 'react'

/**
 * The title of the host region a `QueryState` sits in (`Section` sets it), so the error default
 * names it — "Could not load practice record" — instead of the bare "Could not load". An explicit
 * `errorTitle` still wins; outside any host it is `undefined` and nothing changes.
 */
export const HostTitleContext = createContext<string | undefined>(undefined)

/**
 * The error title a component names itself in: "Revenue" → "Could not load revenue". Only a first
 * word that is a plain capitalised word ("Revenue", "Weekly") lowercases; "KPI", "MRR", "2024
 * sales", "Wi-Fi", "iPhone" and "eBay" keep their case. A missing or blank label stays the bare
 * "Could not load". `charts/**`, `cards/**`, `table/parts/phases`, `core/messages/table` and the
 * `ui/card` seed import it; it lives in `core/` because a seed may import only `../core/*`.
 */
export function couldNotLoad(label?: string): string {
  const noun = label?.trim()
  if (!noun) return 'Could not load'
  const [first = ''] = noun.split(/\s/)
  const plain = /^\p{Lu}\p{Ll}+[,.:;]?$/u.test(first)
  return `Could not load ${plain ? noun.charAt(0).toLowerCase() : noun.charAt(0)}${noun.slice(1)}`
}
