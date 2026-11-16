import { describe, expect, it } from 'bun:test'

import { generateRouteTree, swapStockBuild, typechecksBeforeTree } from './route-tree'

describe('typechecksBeforeTree', () => {
  it.each(['tsc -b && vite build', 'tsc', 'tsc -b; vite build', 'npx tsc -b && vite build'])(
    'flags %s',
    (script) => expect(typechecksBeforeTree(script)).toBe(true),
  )

  it.each([
    'vite build && tsc -b',
    'vite && tsc',
    'tsr generate && tsc -b',
    'vite build',
    'echo hi',
    'tsc-alias && vite build',
  ])('passes %s', (script) => expect(typechecksBeforeTree(script)).toBe(false))
})

describe('swapStockBuild', () => {
  it('swaps the stock shape and keeps each side flags', () => {
    expect(swapStockBuild('tsc -b && vite build')).toBe('vite build && tsc -b')
    expect(swapStockBuild('tsc -b --force && vite build --mode x')).toBe(
      'vite build --mode x && tsc -b --force',
    )
  })

  it('leaves any other shape alone', () => {
    expect(swapStockBuild('tsc -b && vite build && node post.js')).toBeNull()
    expect(swapStockBuild('lint && tsc -b && vite build')).toBeNull()
    expect(swapStockBuild('vite build')).toBeNull()
  })
})

describe('generateRouteTree', () => {
  it('names why when the router plugin does not resolve from the app', async () => {
    expect(await generateRouteTree('/nonexistent-basalt-app')).toContain('router-plugin')
  })
})
