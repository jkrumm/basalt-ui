import { describe, expect, test } from 'bun:test'
import { countStoreCopies, violations } from './store-dedupe'

const engine = (a: string) =>
  `function up({update:e}){return{link:${a},unlink:i,propagate:a,checkDirty:o,shallowPropagate:s};function r(){}}`
const store =
  'class{constructor(){this.get=this.get.bind(this),this.setState=this.setState.bind(this)}}'
const shim = 'var d={hasValue:!1,value:null};d.current=d'

describe('countStoreCopies', () => {
  test('counts one copy per marker and names its chunk', () => {
    const counts = countStoreCopies({ 'a.js': engine('r') + store, 'b.js': shim, 'c.js': 'x' })
    expect(counts.engine).toEqual({ copies: 1, chunks: ['a.js'] })
    expect(counts.storeClass).toEqual({ copies: 1, chunks: ['a.js'] })
    expect(counts.shim).toEqual({ copies: 1, chunks: ['b.js'] })
    expect(violations(counts)).toEqual([])
  })

  test('counts two copies in different chunks and in one chunk', () => {
    const apart = countStoreCopies({ 'a.js': engine('r'), 'b.js': engine('q') })
    expect(apart.engine).toEqual({ copies: 2, chunks: ['a.js', 'b.js'] })
    const together = countStoreCopies({ 'a.js': engine('r') + engine('q') })
    expect(together.engine).toEqual({ copies: 2, chunks: ['a.js'] })
    expect(violations(together)).toContain('engine')
  })

  test('is whitespace-tolerant for unminified output and flags a missing copy', () => {
    const counts = countStoreCopies({
      'a.js':
        'return {\n link: r,\n unlink: i,\n propagate: a,\n checkDirty: o,\n shallowPropagate: s\n}',
    })
    expect(counts.engine.copies).toBe(1)
    expect(violations(counts)).toEqual(['storeClass', 'shim'])
    expect(violations(counts, 0)).toEqual(['engine'])
  })
})
