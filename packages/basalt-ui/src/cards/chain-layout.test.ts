/**
 * The chain layout: blockers left of what waits on them, a fan-out and a fan-in on fixed ports,
 * an edge that spans columns kept clear of the nodes it passes, and a cycle dropped once.
 */
import { describe, expect, test } from 'bun:test'
import { CHAIN_SIZE, chainLayout } from './chain-layout'

const n = (id: string, ...waitsOn: string[]) => ({ id, waitsOn })

const GRAPH = [n('a'), n('b', 'a'), n('c', 'a'), n('d', 'a'), n('e', 'b', 'c'), n('f', 'e', 'a')]

describe('chainLayout', () => {
  const g = chainLayout(GRAPH)
  const at = (id: string) => g.nodes.get(id)!

  test('a node sits one column right of its rightmost blocker', () => {
    expect([at('a').rank, at('b').rank, at('e').rank, at('f').rank]).toEqual([0, 1, 2, 3])
    expect(at('b').x).toBe(CHAIN_SIZE.width + CHAIN_SIZE.gapX)
  })

  test('nodes of one column never overlap', () => {
    const column = ['b', 'c', 'd'].map((id) => at(id).y).toSorted((x, y) => x - y)
    for (let i = 1; i < column.length; i++) {
      expect(column[i]! - column[i - 1]!).toBeGreaterThanOrEqual(
        CHAIN_SIZE.height + CHAIN_SIZE.gapY,
      )
    }
  })

  test('a fan-out leaves the right-middle port and a fan-in meets at the left-middle port', () => {
    const out = g.edges.filter((e) => e.from === 'a')
    expect(out.length).toBe(4)
    const start = `M ${at('a').x + CHAIN_SIZE.width} ${at('a').y + CHAIN_SIZE.height / 2} `
    for (const e of out) expect(e.path.startsWith(start)).toBe(true)
    const into = g.edges.filter((e) => e.to === 'e')
    expect(into.length).toBe(2)
    for (const e of into) {
      expect(e.end).toEqual({ x: at('e').x, y: at('e').y + CHAIN_SIZE.height / 2 })
      expect(e.path.endsWith(` ${e.end.x} ${e.end.y}`)).toBe(true)
    }
  })

  test('an edge that spans columns passes no node of the columns it crosses', () => {
    const long = g.edges.find((e) => e.from === 'a' && e.to === 'f')!
    // Every horizontal run inside a crossed column is at a height no node of that column covers.
    const runs = [...long.path.matchAll(/L ([\d.]+) ([\d.]+)/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ])
    for (const id of ['b', 'c', 'd', 'e']) {
      const box = at(id)
      for (const [x, y] of runs) {
        const inside =
          x! > box.x &&
          x! < box.x + CHAIN_SIZE.width &&
          y! > box.y &&
          y! < box.y + CHAIN_SIZE.height
        expect(inside).toBe(false)
      }
    }
  })

  test('a chain of one blocker each is one straight line', () => {
    const line = chainLayout([n('p'), n('q', 'p'), n('r', 'q')])
    const ys = ['p', 'q', 'r'].map((id) => line.nodes.get(id)!.y)
    expect(new Set(ys).size).toBe(1)
    for (const e of line.edges) expect(e.path).not.toContain('C')
  })

  test('a cycle drops its closing edge and draws every node once', () => {
    const cycle = chainLayout([n('x', 'z'), n('y', 'x'), n('z', 'y')])
    expect(cycle.dropped).toBe(1)
    expect(cycle.nodes.size).toBe(3)
    expect(cycle.edges.length).toBe(2)
  })

  test('unknown blockers and an empty chain draw nothing extra', () => {
    expect(chainLayout([n('solo', 'ghost')]).edges).toEqual([])
    expect(chainLayout([])).toMatchObject({ width: 0, height: 0, dropped: 0 })
  })
})
