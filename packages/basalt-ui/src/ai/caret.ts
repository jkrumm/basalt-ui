/**
 * Where a caret sits in a textarea, in viewport pixels: a mirror box copies the textarea's text
 * metrics, holds the text up to the index and a marker after it, and the marker's box is the caret's.
 */

const COPIED = [
  'boxSizing',
  'width',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'letterSpacing',
  'lineHeight',
  'textTransform',
  'wordSpacing',
  'tabSize',
] as const

/** The caret's box at `index`, one line tall; the textarea's own box where nothing lays out. */
export function caretRect(area: HTMLTextAreaElement, index: number): DOMRect {
  const box = area.getBoundingClientRect()
  const style = getComputedStyle(area)
  const mirror = document.createElement('div')
  for (const key of COPIED) mirror.style[key] = style[key]
  mirror.style.position = 'absolute'
  mirror.style.visibility = 'hidden'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.overflowWrap = 'break-word'
  mirror.style.top = '0'
  mirror.style.left = '-9999px'
  mirror.textContent = area.value.slice(0, index)
  const marker = document.createElement('span')
  marker.textContent = '\u200b'
  mirror.append(marker)
  document.body.append(mirror)
  const top = marker.offsetTop - area.scrollTop
  const left = marker.offsetLeft - area.scrollLeft
  const height = marker.offsetHeight
  mirror.remove()
  if (height === 0) return box
  return new DOMRect(box.left + left, box.top + top, 1, height)
}
