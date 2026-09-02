/**
 * `scrollParentOf` under happy-dom.
 *
 * happy-dom has no layout engine, so `scrollHeight`/`clientHeight` are both 0 and the
 * "overflow says auto AND it actually overflows" half cannot be observed here — it is exercised for
 * real in `tests/layout/`. What IS observable, and is the half that matters at every call site, is
 * the WALK: the declared `data-basalt-scrollport` handle wins, the element itself is never the
 * answer, and `<body>`/`<html>` resolve to `null` (the document scrolls) rather than to a node no
 * caller could attach a useful scroll listener to.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { SCROLLPORT_ATTRIBUTE, scrollParentOf } from './scroll-parent'

afterEach(() => {
  document.body.innerHTML = ''
})

/** `<div id="port" data-basalt-scrollport><div id="mid"><span id="leaf"/></div></div>` */
function mountShell(): { port: HTMLElement; mid: HTMLElement; leaf: HTMLElement } {
  document.body.innerHTML = `<div id="port" ${SCROLLPORT_ATTRIBUTE}><div id="mid"><span id="leaf"></span></div></div>`
  return {
    port: document.getElementById('port') as HTMLElement,
    mid: document.getElementById('mid') as HTMLElement,
    leaf: document.getElementById('leaf') as HTMLElement,
  }
}

describe('scrollParentOf', () => {
  test('resolves the declared scrollport from a deep descendant', () => {
    const { port, leaf } = mountShell()
    expect(scrollParentOf(leaf)).toBe(port)
  })

  test('resolves the NEAREST declared scrollport, not the outermost', () => {
    document.body.innerHTML =
      `<div id="outer" ${SCROLLPORT_ATTRIBUTE}><div id="inner" ${SCROLLPORT_ATTRIBUTE}>` +
      `<span id="leaf"></span></div></div>`
    expect(scrollParentOf(document.getElementById('leaf'))).toBe(document.getElementById('inner'))
  })

  test('never answers with the element itself — the question is which box scrolls it', () => {
    const { port } = mountShell()
    expect(scrollParentOf(port)).toBeNull()
  })

  test('null for a shell-less tree: the document is the scroller', () => {
    document.body.innerHTML = '<div id="mid"><span id="leaf"></span></div>'
    expect(scrollParentOf(document.getElementById('leaf'))).toBeNull()
  })

  test('null for null, and for a detached node', () => {
    expect(scrollParentOf(null)).toBeNull()
    expect(scrollParentOf(document.createElement('div'))).toBeNull()
  })

  test('an `overflow: visible` ancestor is not a scrollport, declared or not', () => {
    document.body.innerHTML =
      '<div id="mid" style="overflow-y: visible"><span id="leaf"></span></div>'
    expect(scrollParentOf(document.getElementById('leaf'))).toBeNull()
  })
})
