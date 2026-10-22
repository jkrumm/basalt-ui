import { afterEach, describe, expect, test } from 'bun:test'

import { hiddenScrollPx } from './capture'

/** happy-dom has no layout: give an element the box a browser would measure. */
function box(el: HTMLElement, client: number, scroll: number, overflow = 'auto'): HTMLElement {
  Object.defineProperty(el, 'clientHeight', { value: client, configurable: true })
  Object.defineProperty(el, 'scrollHeight', { value: scroll, configurable: true })
  el.style.overflowY = overflow
  return el
}

function div(parent: HTMLElement): HTMLElement {
  const el = document.createElement('div')
  parent.append(el)
  return el
}

describe('hiddenScrollPx', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  test('counts only the scrollport, not a tall scroll box nested in it', () => {
    window.innerHeight = 844
    const port = box(div(document.body), 800, 1900)
    port.setAttribute('data-basalt-scrollport', '')
    box(div(port), 440, 2000)
    expect(hiddenScrollPx()).toBe(1100)
  })

  test('without a scrollport attribute the outermost scroll box counts', () => {
    window.innerHeight = 844
    const outer = box(div(document.body), 800, 1500)
    box(div(outer), 600, 5000)
    expect(hiddenScrollPx()).toBe(700)
  })

  test('a scroll box nested in a non-scrolling wrapper is still outermost', () => {
    window.innerHeight = 844
    box(div(div(document.body)), 800, 1200)
    expect(hiddenScrollPx()).toBe(400)
  })

  test('a small box and a non-scrolling box hide nothing', () => {
    window.innerHeight = 844
    box(div(document.body), 100, 900)
    box(div(document.body), 800, 800, 'visible')
    expect(hiddenScrollPx()).toBe(0)
  })
})
