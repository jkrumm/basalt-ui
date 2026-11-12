/**
 * Shared doubles for the `Page`, `PageBar`, `PageAside` and `Section` suites: a controllable
 * `ResizeObserver` and container width (happy-dom lays nothing out), a `PageHost` that records its
 * claims, and a `ControlsSlot`. Not a test file; nothing here ships.
 */
import { act } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { ControlsSlot, PageHost, PageRegion } from '../core/ports'

type Observed = { callback: () => void; target: Element }

const observers = new Set<Observed>()
let width = 1440

class ControllableResizeObserver {
  private readonly callback: () => void
  private readonly mine = new Set<Observed>()
  constructor(callback: () => void) {
    this.callback = callback
  }
  observe(target: Element): void {
    const entry = { callback: this.callback, target }
    this.mine.add(entry)
    observers.add(entry)
  }
  unobserve(): void {}
  disconnect(): void {
    for (const entry of this.mine) observers.delete(entry)
    this.mine.clear()
  }
}

const original = {
  global: globalThis.ResizeObserver,
  clientWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth'),
}

/** Swaps in the controllable observer and a `clientWidth` that reads the width set below. */
export function installLayoutDoubles(): void {
  globalThis.ResizeObserver = ControllableResizeObserver as unknown as typeof ResizeObserver
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => width,
  })
}

export function restoreLayoutDoubles(): void {
  globalThis.ResizeObserver = original.global
  if (original.clientWidth !== undefined)
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', original.clientWidth)
  else Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth')
  observers.clear()
  width = 1440
}

/** Sets the container width every element reads, and notifies every live observer. */
export function resizeTo(next: number): void {
  width = next
  act(() => {
    for (const entry of Array.from(observers)) entry.callback()
  })
}

/** Sets the width without notifying: the value the next render reads. */
export function setWidth(next: number): void {
  width = next
}

export type Claim = { region: PageRegion; node: ReactNode; id: string }

export type FakeHost = {
  host: PageHost
  claims: Claim[]
  heights: number[]
  of(region: PageRegion): Claim[]
}

/** A `PageHost` that records live claims and the bar heights it was told. */
export function fakeHost(): FakeHost {
  const claims: Claim[] = []
  const heights: number[] = []
  const host: PageHost = {
    claim(region, node, id) {
      const claim = { region, node, id }
      claims.push(claim)
      return () => {
        const at = claims.indexOf(claim)
        if (at >= 0) claims.splice(at, 1)
      }
    },
    setBarHeight: (px) => void heights.push(px),
  }
  return { host, claims, heights, of: (region) => claims.filter((c) => c.region === region) }
}

/** A `ControlsSlot` whose `render()` is a button named `label`. */
export function slotOf(label: string, count = 1): ControlsSlot {
  return {
    kind: 'controls-slot',
    count,
    render: () => <button type="button">{label}</button>,
  }
}
