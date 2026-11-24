/**
 * palette-sources.ts: the playground's record search for the app's one `CommandPalette`.
 * Suppliers are searched by name, city, country and contact after a small fake latency that honors
 * the abort signal, the way a request would.
 */
import { linkOptions } from '@tanstack/react-router'
import { navTarget } from 'basalt-ui/router'
import type { PaletteSource } from 'basalt-ui/shell'
import { SUPPLIERS } from './ref-inventory'

const LATENCY_MS = 120

/** Resolves after the latency, or rejects with the signal's reason when it aborts first. */
function delay(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason)
    const timer = setTimeout(resolve, LATENCY_MS)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason)
      },
      { once: true },
    )
  })
}

export const SUPPLIER_SOURCE: PaletteSource = {
  id: 'suppliers',
  label: 'Suppliers',
  search: async (query, signal) => {
    await delay(signal)
    const needle = query.toLowerCase()
    return SUPPLIERS.filter((s) =>
      [s.name, s.city, s.country, s.contact].some((field) => field.toLowerCase().includes(needle)),
    ).map((s) => ({
      id: s.id,
      title: s.name,
      kind: 'Supplier',
      detail: `${s.city}, ${s.country}`,
      to: navTarget(linkOptions({ to: '/ref/suppliers/$id', params: { id: s.id } })),
    }))
  },
}

/** Hoisted: a fresh array per render would restart nothing, but the palette reads it by identity. */
export const PALETTE_SOURCES: readonly PaletteSource[] = [SUPPLIER_SOURCE]
