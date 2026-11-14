// theme-allow-file raw-hex — board.html is a standalone artefact: no basalt tokens exist in it
// theme-allow-file inline-spacing — board.html is a standalone artefact: no spacing props
/** `board.html`: one self-contained page (inline CSS, relative image paths) over a metrics.json. */
import { PAGE_ANCHOR } from './types'
import type { AnchorMetrics, ShotMetrics, ShotRecord } from './types'

type Sheet = Pick<ShotMetrics, 'viewports' | 'states' | 'shots'>

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const CSS = `
:root{color-scheme:light dark;--bg:#fff;--fg:#18181b;--mut:#71717a;--line:#d4d4d8;--bad:#b91c1c}
@media(prefers-color-scheme:dark){:root{--bg:#09090b;--fg:#fafafa;--mut:#a1a1aa;--line:#3f3f46;--bad:#f87171}}
body{margin:0;padding:24px;background:var(--bg);color:var(--fg);font:13px/1.45 system-ui,sans-serif}
h1,h2,h3,h4{margin:0 0 8px}h2{margin-top:40px;border-bottom:1px solid var(--line)}section{margin:24px 0}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:16px}
figure{margin:0;border:1px solid var(--line);padding:6px;min-width:0}
figcaption,.mut{color:var(--mut);font-size:11px}img{max-width:100%;height:auto;display:block}
.empty{display:flex;align-items:center;justify-content:center;min-height:60px;color:var(--mut);border:1px dashed var(--line);text-align:center;padding:6px}
.empty.error,.bad{color:var(--bad);border-color:var(--bad)}
`

const cell = (shot: ShotRecord | undefined, label: string): string => {
  const caption = (extra = ''): string => `<figcaption>${esc(label)}${extra}</figcaption>`
  if (!shot) return `<figure><div class="empty">not captured</div>${caption()}</figure>`
  const note = [shot.note, shot.ignored && 'ignored the state'].filter(Boolean).join(' · ')
  if (shot.status === 'ok' && shot.file) {
    const alt = esc(`${shot.name} ${label}`)
    return `<figure><img src="${esc(shot.file)}" loading="lazy" alt="${alt}">${caption(note && ` · ${esc(note)}`)}</figure>`
  }
  const why = note ? `: ${esc(note)}` : ''
  return `<figure><div class="empty ${shot.status}">${shot.status}${why}</div>${caption()}</figure>`
}

/** Every state of one anchor: a grid of scheme × viewport per state. */
const grid = (m: Sheet, route: string, name: string, state: string): string => {
  const at = (s: ShotRecord, scheme: string, viewport: string): boolean =>
    s.route === route &&
    s.name === name &&
    s.state === state &&
    s.scheme === scheme &&
    s.viewport === viewport
  const cells = m.viewports.flatMap((viewport) =>
    ['light', 'dark'].map((scheme) =>
      cell(
        m.shots.find((s) => at(s, scheme, viewport)),
        `${scheme} · ${viewport}`,
      ),
    ),
  )
  return `<h4>${state}</h4><div class="grid">${cells.join('')}</div>`
}

/** An anchor's contact sheet: every state × scheme × viewport, labelled, on one standalone page. */
export function buildSheet(route: string, name: string, m: Sheet): string {
  const body = m.states.map((state) => grid(m, route, name, state)).join('')
  // Lazy images never load in a screenshot taken straight after `load`.
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${CSS}</style></head><body>` +
    `<h3>${esc(name)} <span class="mut">${esc(route)}</span></h3>${body}</body></html>`
  ).replaceAll(' loading="lazy"', '')
}

const metricsLine = (a: AnchorMetrics): string =>
  `${a.scheme}/${a.viewport} ${a.box.width}×${a.box.height} · radius ${a.radius} · font ${a.fontSizes.join(', ')} · empty ${a.emptyRatio}`

export function buildBoard(m: ShotMetrics): string {
  const sections = m.routes.map((route) => {
    const names = [
      ...new Set(
        m.shots.filter((s) => s.route === route && s.name !== PAGE_ANCHOR).map((s) => s.name),
      ),
    ]
    const anchors = names.map((name) => {
      const metrics = m.anchors.filter((a) => a.route === route && a.name === name).map(metricsLine)
      const states = m.states.map((state) => grid(m, route, name, state)).join('')
      return `<section><h3>${esc(name)}</h3>${states}<p class="mut">${metrics.map(esc).join('<br>') || 'no metrics (the anchor never rendered)'}</p></section>`
    })
    const wide = (m.pages ?? []).filter((p) => p.route === route && p.overflowX > 0)
    const overflow = wide.map(
      (p) =>
        `<p class="bad">${p.scheme}/${p.viewport}: document ${p.overflowX}px wider than the viewport</p>`,
    )
    const body = anchors.join('') || '<p class="mut">no anchors on this route</p>'
    return `<h2>${esc(route)}</h2><h3>full page</h3>${grid(m, route, PAGE_ANCHOR, 'rest')}${overflow.join('')}${body}`
  })
  const scale = m.scale[0]
  const steps = scale
    ? `<p class="mut">scale: spacing ${Object.values(scale.spacing).join(' ')} · radius ${Object.values(scale.radius).join(' ')} · font ${Object.values(scale.fontSizes).join(' ')}</p>`
    : ''
  const scaleError = m.scaleError
    ? `<p class="bad">scale unavailable: ${esc(m.scaleError)}</p>`
    : ''
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>basalt-ui shot</title><style>${CSS}</style></head><body>` +
    `<h1>basalt-ui shot</h1><p class="mut">${esc(m.base)} · ${esc(m.generatedAt)} · states: ${m.states.join(', ')}</p>${scaleError}${steps}${sections.join('')}</body></html>\n`
  )
}
