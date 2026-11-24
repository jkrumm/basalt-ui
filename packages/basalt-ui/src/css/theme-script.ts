/**
 * `basalt-ui/theme-script`: the pre-paint color-scheme script as a string, for the document head.
 * Tooling, frozen per major; reads the stored scheme and appearance and stamps each attribute
 * (`data-theme`, `data-density`, `data-frame`, `data-accent`) only when it is absent.
 */
import { APPEARANCE_KEY, DENSITIES, FRAMES } from '../core/appearance'
import { parseScheme, SCHEME_ATTRIBUTE, SCHEME_KEY } from '../core/scheme'
import { ACCENT_NAMES } from '../tokens/accents'
import type { Scheme } from '../core/scheme'

export interface ThemeScriptOptions {
  key?: string | undefined
  attribute?: string | undefined
  default?: Scheme | undefined
  cookie?: string | undefined
  /** `false` stamps only the scheme; by default the appearance `setAppearance` stored is stamped too. */
  appearance?: false | undefined
}

/**
 * Boot script for `<head>`. Four duties: read (key, cookie, default), validate, stamp
 * `attribute` for light or dark when none exists yet, tolerate throwing storage. `auto` stamps
 * nothing. Logic is its own copy of `readScheme`; parity is tested, not shared. A second statement
 * does the same for the appearance object: each valid `density`, `frame` and `accent` becomes its
 * `data-*` attribute unless the page already has one (its copy of `readAppearance`, tested alike).
 */
export function themeScript(options: ThemeScriptOptions = {}): string {
  const key = JSON.stringify(options.key ?? SCHEME_KEY)
  const attribute = JSON.stringify(options.attribute ?? SCHEME_ATTRIBUTE)
  const cookie = JSON.stringify(options.cookie ?? null)
  const fallback = JSON.stringify(parseScheme(options.default) ?? 'auto')
  return [
    `(function(){var d=document.documentElement,a=${attribute},c=${cookie},v;if(d.hasAttribute(a))return`,
    `function t(f){try{var x=f();if(x==="light"||x==="dark"||x==="auto")return x}catch(e){}}`,
    `function s(k){return t(function(){return localStorage.getItem(k)})}`,
    `v=s(${key})||t(function(){return c&&document.cookie.split(/;\\s*/).reduce(function(r,p){`,
    `return r||(p.indexOf(c+"=")===0?p.slice(c.length+1):r)},"")})||${fallback}`,
    `if(v==="light"||v==="dark")d.setAttribute(a,v)})()`,
    ...(options.appearance === false ? [] : [appearanceStatement()]),
  ].join('\n')
}

/** The appearance half: stamps each stored, valid attribute the page does not have yet. */
function appearanceStatement(): string {
  const lists = JSON.stringify({ density: DENSITIES, frame: FRAMES, accent: ACCENT_NAMES })
  return (
    `;(function(){var d=document.documentElement,l=${lists},o,k,v;` +
    `try{o=JSON.parse(localStorage.getItem(${JSON.stringify(APPEARANCE_KEY)}))}catch(e){}` +
    `if(o&&typeof o==="object")for(k in l){v=o[k];` +
    `if(l[k].indexOf(v)>-1&&!d.hasAttribute("data-"+k))d.setAttribute("data-"+k,v)}})()`
  )
}
