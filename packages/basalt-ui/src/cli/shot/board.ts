// theme-allow-file raw-hex — board.html is a standalone artefact: no basalt tokens exist in it
// theme-allow-file inline-spacing — board.html is a standalone artefact: no Mantine spacing props
/** `board.html`: one self-contained page (inline CSS, relative image paths) over a metrics.json. */
import { SCHEMES, VIEWPORTS } from './types'
import type { AnchorMetrics, ShotMetrics, ShotRecord, ShotState, Sides } from './types'

export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const CSS = `
:root{color-scheme:light dark;--bg:#fff;--fg:#18181b;--mut:#71717a;--line:#d4d4d8;--bad:#b91c1c}
@media(prefers-color-scheme:dark){:root{--bg:#09090b;--fg:#fafafa;--mut:#a1a1aa;--line:#3f3f46;--bad:#f87171}}
body{margin:0;padding:24px;background:var(--bg);color:var(--fg);font:13px/1.45 system-ui,sans-serif}
h1,h2,h3,h4{margin:0 0 8px}h2{margin-top:40px;border-bottom:1px solid var(--line);padding-bottom:4px}
section{margin:24px 0}.row{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:24px;align-items:start}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:16px}
figure{margin:0;border:1px solid var(--line);padding:6px;min-width:0}
figcaption,.mut{color:var(--mut);font-size:11px}img{max-width:100%;height:auto;display:block}
.empty{display:flex;align-items:center;justify-content:center;min-height:60px;color:var(--mut);border:1px dashed var(--line);text-align:center;padding:6px}
.empty.error{color:var(--bad);border-color:var(--bad)}
table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid var(--line);padding:3px 6px;text-align:left;vertical-align:top}
.bad{color:var(--bad)}aside{position:sticky;top:12px}
`

const sides = (s: Sides): string => `${s.top} ${s.right} ${s.bottom} ${s.left}`

const cell = (shot: ShotRecord | undefined, label: string): string => {
  const caption = `<figcaption>${esc(label)}</figcaption>`
  if (!shot) return `<figure><div class="empty">not captured</div>${caption}</figure>`
  if (shot.status === 'ok' && shot.file) {
    return `<figure><img src="${esc(shot.file)}" loading="lazy" alt="${esc(`${shot.name} ${label}`)}">${caption}</figure>`
  }
  const note = shot.note ? `: ${esc(shot.note)}` : ''
  return `<figure><div class="empty ${shot.status}">${shot.status}${note}</div>${caption}</figure>`
}

const metricsRow = (a: AnchorMetrics): string => {
  const fails = a.contrast.failures.length
  return (
    `<tr><td>${a.scheme}/${a.viewport}</td><td>${a.box.width}×${a.box.height}</td>` +
    `<td>${sides(a.padding)}</td><td>${a.gap.row}/${a.gap.column}</td><td>${a.radius}</td>` +
    `<td>${a.borderWidth}</td><td>${a.fontSizes.join(', ')}</td><td>${a.emptyRatio}</td>` +
    `<td class="${fails ? 'bad' : ''}">${a.contrast.min ?? '–'} (${fails} fail)</td></tr>`
  )
}

const metricsTable = (rows: AnchorMetrics[]): string => {
  if (rows.length === 0) return '<p class="mut">no metrics (the anchor never rendered)</p>'
  const failures = rows.flatMap((a) =>
    a.contrast.failures.map(
      (f) =>
        `<li>${a.scheme}/${a.viewport} “${esc(f.text)}” ${f.ratio} (${esc(f.fg)} on ${esc(f.bg)}, ${f.fontSize}px)</li>`,
    ),
  )
  const nested = rows[0]?.nested ?? []
  return (
    `<table><tr><th></th><th>box</th><th>padding</th><th>gap r/c</th><th>radius</th><th>border</th>` +
    `<th>font px</th><th>empty</th><th>contrast min</th></tr>${rows.map(metricsRow).join('')}</table>` +
    (failures.length ? `<h4>Contrast failures</h4><ul class="bad">${failures.join('')}</ul>` : '') +
    (nested.length
      ? `<h4>Nested surfaces</h4><ul>${nested.map((n) => `<li>${esc(n.path)} r${n.radius} p ${sides(n.padding)}</li>`).join('')}</ul>`
      : '')
  )
}

const grid = (shots: ShotRecord[], route: string, name: string, state: ShotState): string => {
  const cells = VIEWPORTS.flatMap((viewport) =>
    SCHEMES.map((scheme) =>
      cell(
        shots.find(
          (s) =>
            s.route === route &&
            s.name === name &&
            s.state === state &&
            s.scheme === scheme &&
            s.viewport === viewport,
        ),
        `${scheme} · ${viewport}`,
      ),
    ),
  )
  return `<h4>${state}</h4><div class="grid">${cells.join('')}</div>`
}

export function buildBoard(m: ShotMetrics): string {
  const sections = m.routes.map((route) => {
    const names = [
      ...new Set(m.shots.filter((s) => s.route === route && s.name !== '_page').map((s) => s.name)),
    ]
    const page = `<h3>full page</h3>${grid(m.shots, route, '_page', 'rest')}`
    const anchors = names.length
      ? names
          .map(
            (name) =>
              `<section><h3>${esc(name)}</h3><div class="row"><div>${m.states
                .map((state) => grid(m.shots, route, name, state))
                .join(
                  '',
                )}</div><aside>${metricsTable(m.anchors.filter((a) => a.route === route && a.name === name))}</aside></div></section>`,
          )
          .join('')
      : '<p class="mut">no data-shot anchors on this route</p>'
    return `<h2>${esc(route)}</h2>${page}${anchors}`
  })
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>basalt-ui shot</title><style>${CSS}</style></head><body>` +
    `<h1>basalt-ui shot</h1><p class="mut">${esc(m.base)} · ${esc(m.generatedAt)} · states: ${m.states.join(', ')}</p>${sections.join('')}</body></html>\n`
  )
}
