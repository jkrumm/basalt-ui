// Spike (W1 ledger): basalt 1.41's hand-rolled `useDebouncedField` (controls/search-filter.tsx:95), verbatim.
import { useEffect, useRef, useState } from 'react'

const DEBOUNCE_MS = 200

export function useDebouncedFieldIncumbent(
  value: string,
  setValue: (next: string) => void,
): { value: string; set: (next: string) => void } {
  const [draft, setDraft] = useState(value)
  const seen = useRef(value)
  const commit = useRef(setValue)
  commit.current = setValue

  useEffect(() => {
    if (seen.current === value) return
    seen.current = value
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (draft === value) return
    const timer = setTimeout(() => {
      seen.current = draft
      commit.current(draft)
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [draft, value])

  return { value: draft, set: setDraft }
}
