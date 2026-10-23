/**
 * The error title a component names itself in: "Revenue" → "Could not load revenue". A leading
 * capital followed by another capital or a non-letter ("KPI", "MRR", "2024 sales") keeps its case;
 * a missing or blank label stays the bare "Could not load". Mantine-free: `charts/**` imports it.
 */
export function couldNotLoad(label?: string): string {
  const noun = label?.trim()
  if (!noun) return 'Could not load'
  const lead = noun.charAt(0)
  const second = noun.charAt(1)
  const lowers = second !== '' && second === second.toLowerCase() && second !== second.toUpperCase()
  return `Could not load ${lowers ? lead.toLowerCase() : lead}${noun.slice(1)}`
}
