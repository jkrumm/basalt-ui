/**
 * `basalt-ui/theme-script`: the pre-paint colour-scheme script as a string, for the document head.
 * Tooling, frozen per major; reads the stored scheme and stamps `data-theme` only when it is absent.
 */
import { LEGACY_SCHEME_KEY, parseScheme, SCHEME_ATTRIBUTE, SCHEME_KEY } from '../core/scheme'
import type { Scheme } from '../core/scheme'

export interface ThemeScriptOptions {
  key?: string | undefined
  attribute?: string | undefined
  default?: Scheme | undefined
  cookie?: string | undefined
}

/**
 * Boot script for `<head>`. Four duties: read (key, legacy key, cookie, default), validate, stamp
 * `attribute` for light or dark when none exists yet, tolerate throwing storage. `auto` stamps
 * nothing. Logic is its own copy of `readScheme`; parity is tested, not shared.
 */
export function themeScript(options: ThemeScriptOptions = {}): string {
  const key = JSON.stringify(options.key ?? SCHEME_KEY)
  const legacy = JSON.stringify(LEGACY_SCHEME_KEY)
  const attribute = JSON.stringify(options.attribute ?? SCHEME_ATTRIBUTE)
  const cookie = JSON.stringify(options.cookie ?? null)
  const fallback = JSON.stringify(parseScheme(options.default) ?? 'auto')
  return [
    `(function(){var d=document.documentElement,a=${attribute},c=${cookie},v;if(d.hasAttribute(a))return`,
    `function t(f){try{var x=f();if(x==="light"||x==="dark"||x==="auto")return x}catch(e){}}`,
    `function s(k){return t(function(){return localStorage.getItem(k)})}`,
    `v=s(${key})||s(${legacy})||t(function(){return c&&document.cookie.split(/;\\s*/).reduce(function(r,p){`,
    `return p.indexOf(c+"=")===0?p.slice(c.length+1):r},"")})||${fallback}`,
    `if(v==="light"||v==="dark")d.setAttribute(a,v)})()`,
  ].join('\n')
}
