// Spike (W1 ledger): the same field draft on @tanstack/react-pacer.
import { useDebouncedCallback } from '@tanstack/react-pacer'
import { useEffect, useRef, useState } from 'react'

export function useDebouncedFieldPacer(
  value: string,
  setValue: (next: string) => void,
): { value: string; set: (next: string) => void } {
  const [draft, setDraft] = useState(value)
  const seen = useRef(value)
  const commit = useDebouncedCallback(
    (next: string) => {
      seen.current = next
      setValue(next)
    },
    { wait: 200 },
  )
  useEffect(() => {
    if (seen.current === value) return
    seen.current = value
    setDraft(value)
  }, [value])
  return {
    value: draft,
    set: (next) => {
      setDraft(next)
      commit(next)
    },
  }
}
