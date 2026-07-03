/**
 * ConnectivityProvider — aggregates browser online/offline, React Query onlineManager, SSE
 * EventSource, and health-check pings into a single ConnectivityStatus with per-signal detail.
 *
 * Auto-mounted by BasaltProvider with zero consumer setup for basic browser detection.
 * React Query, SSE, and health ping are automatically detected or opt-in via props.
 */
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { onlineManager } from '@tanstack/react-query'
import type { ConnectivitySnapshot, ConnectivityProviderProps } from './types'

// ── SSR-safe default ────────────────────────────────────────────────────────────────────────────────

const SSR_SNAPSHOT: ConnectivitySnapshot = {
  status: 'online',
  details: {
    browserOnline: true,
    queryOnline: null,
    sseOpen: null,
    healthPassing: null,
  },
}

// ── Context ─────────────────────────────────────────────────────────────────────────────────────────

export const ConnectivityContext = createContext<ConnectivitySnapshot | null>(null)

// ── Aggregation helper ──────────────────────────────────────────────────────────────────────────────

function computeStatus(details: ConnectivitySnapshot['details']): ConnectivitySnapshot['status'] {
  if (!details.browserOnline) return 'offline'
  // Any non-null signal that is explicitly false → degraded
  if (details.queryOnline === false) return 'degraded'
  if (details.sseOpen === false) return 'degraded'
  if (details.healthPassing === false) return 'degraded'
  return 'online'
}

// ── Snapshot helpers ────────────────────────────────────────────────────────────────────────────────

function getBrowserOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

function getQueryOnline(): boolean {
  return onlineManager.isOnline()
}

// ── Provider ────────────────────────────────────────────────────────────────────────────────────────

export function ConnectivityProvider({
  children,
  sseUrl,
  healthUrl,
  healthIntervalMs = 30_000,
  override,
}: ConnectivityProviderProps & { children: ReactNode }) {
  // SSR guard — return the optimistic snapshot before hydration
  const [isClient, setIsClient] = useState(false)
  useEffect(() => {
    setIsClient(true)
  }, [])

  // ── Browser online/offline ────────────────────────────────────────────────────────────────────────

  const [browserOnline, setBrowserOnline] = useState(getBrowserOnline)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = (): void => setBrowserOnline(true)
    const handleOffline = (): void => setBrowserOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // ── React Query onlineManager ─────────────────────────────────────────────────────────────────────

  const [queryOnline, setQueryOnline] = useState<boolean>(getQueryOnline)

  useEffect(() => {
    const unsubscribe = onlineManager.subscribe(() => {
      setQueryOnline(onlineManager.isOnline())
    })
    return unsubscribe
  }, [])

  // ── SSE ───────────────────────────────────────────────────────────────────────────────────────────

  const [sseOpen, setSseOpen] = useState<boolean | null>(null)
  const sseRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!sseUrl || typeof window === 'undefined') {
      setSseOpen(null)
      return
    }

    setSseOpen(false) // connecting

    const es = new EventSource(sseUrl)
    sseRef.current = es

    const handleOpen = (): void => setSseOpen(true)
    const handleError = (): void => {
      // readyState: 0=CONNECTING, 1=OPEN, 2=CLOSED
      setSseOpen(es.readyState === EventSource.OPEN)
    }

    es.addEventListener('open', handleOpen)
    es.addEventListener('error', handleError)

    return () => {
      es.removeEventListener('open', handleOpen)
      es.removeEventListener('error', handleError)
      es.close()
      sseRef.current = null
    }
  }, [sseUrl])

  // ── Health ping ───────────────────────────────────────────────────────────────────────────────────

  const [healthPassing, setHealthPassing] = useState<boolean | null>(null)
  const healthRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const pingHealth = useCallback(async () => {
    if (!healthUrl) return
    try {
      const res = await fetch(healthUrl)
      setHealthPassing(res.ok)
    } catch {
      setHealthPassing(false)
    }
  }, [healthUrl])

  useEffect(() => {
    if (!healthUrl || typeof window === 'undefined') {
      setHealthPassing(null)
      return
    }

    // Initial ping
    pingHealth()

    // Periodic pings
    healthRef.current = setInterval(pingHealth, healthIntervalMs)

    return () => {
      if (healthRef.current !== null) {
        clearInterval(healthRef.current)
        healthRef.current = null
      }
    }
  }, [healthUrl, healthIntervalMs, pingHealth])

  // ── Aggregated snapshot ───────────────────────────────────────────────────────────────────────────

  const snapshot: ConnectivitySnapshot = useMemo(() => {
    const details = {
      browserOnline: override?.browserOnline ?? browserOnline,
      queryOnline: override?.queryOnline !== undefined ? override.queryOnline : queryOnline,
      sseOpen: override?.sseOpen !== undefined ? override.sseOpen : sseOpen,
      healthPassing: override?.healthPassing !== undefined ? override.healthPassing : healthPassing,
    }
    return {
      status: computeStatus(details),
      details,
    }
  }, [browserOnline, queryOnline, sseOpen, healthPassing, override])

  // SSR → optimistic snapshot
  if (!isClient) {
    return (
      <ConnectivityContext.Provider value={SSR_SNAPSHOT}>{children}</ConnectivityContext.Provider>
    )
  }

  return <ConnectivityContext.Provider value={snapshot}>{children}</ConnectivityContext.Provider>
}
