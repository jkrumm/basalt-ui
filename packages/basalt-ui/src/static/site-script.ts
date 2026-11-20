/**
 * `siteScript()`: the one inline script the site parts share, for the document head after
 * `themeScript()`. Delegated listeners only, so it runs before the body exists and works for markup
 * added later. Two duties: a `[data-basalt-scheme]` button applies and stores the scheme (the
 * `setScheme` contract: `data-theme` on `<html>`, the `basalt:scheme` key) and every switch's
 * `aria-pressed` follows, honouring the same `key`, `attribute` and `cookie` options as `themeScript()`; a `[data-basalt-copy]` button copies the text of its block's `pre` and
 * announces its `data-copied-label`. Logic is its own copy of `setScheme`; parity is tested.
 */
import { SCHEME_ATTRIBUTE, SCHEME_KEY } from '../core/scheme'
import type { ThemeScriptOptions } from '../css/theme-script'

/** The scheme options both head scripts read; pass `themeScript()` the same ones. */
export type SiteScriptOptions = Pick<ThemeScriptOptions, 'key' | 'attribute' | 'cookie'>

/** One year, as `setScheme` mirrors its cookie. */
const COOKIE_MAX_AGE = 31536000

/**
 * The inline script the static parts share: `ThemeSwitch` applies and stores the scheme, `SiteCodeBlock`
 * copies its block. `basaltAstro()` inlines it after `themeScript()` with the same scheme options.
 * About 0.6 kB gzip; a unit test holds it and `themeScript()` under 2 kB together.
 *
 * Internal to the site profile until a host outside Astro needs it exported.
 */
export function siteScript(options: SiteScriptOptions = {}): string {
  const key = JSON.stringify(options.key ?? SCHEME_KEY)
  const attr = JSON.stringify(options.attribute ?? SCHEME_ATTRIBUTE)
  const cookie = JSON.stringify(options.cookie ?? null)
  return [
    `(function(){var d=document,r=d.documentElement,k=${key},a=${attr},n=${cookie};`,
    `function cur(){return r.getAttribute(a)||"auto"}`,
    `function sync(){var v=cur(),b=d.querySelectorAll("[data-basalt-scheme]");for(var i=0;i<b.length;i++)b[i].setAttribute("aria-pressed",String(b[i].getAttribute("data-basalt-scheme")===v))}`,
    `d.addEventListener("click",function(e){var t=e.target instanceof Element?e.target:null;if(!t)return;`,
    `var s=t.closest("[data-basalt-scheme]");if(s){var v=s.getAttribute("data-basalt-scheme");`,
    `if(v==="auto")r.removeAttribute(a);else if(v==="light"||v==="dark")r.setAttribute(a,v);else return;`,
    `try{localStorage.setItem(k,v)}catch(x){}`,
    `if(n)try{d.cookie=n+"="+v+"; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax"}catch(x){}sync();return}`,
    `var c=t.closest("[data-basalt-copy]");if(!c)return;var f=c.closest("[data-basalt-code]"),p=f&&f.querySelector("pre");`,
    `if(!p||!navigator.clipboard)return;navigator.clipboard.writeText(p.innerText).then(function(){`,
    `var o=f.querySelector("[data-basalt-copy-status]");c.setAttribute("data-copied","");if(o)o.textContent=c.getAttribute("data-copied-label")||"";`,
    `setTimeout(function(){c.removeAttribute("data-copied");if(o)o.textContent=""},1500)},function(){})});`,
    `if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",sync);else sync()})()`,
  ].join('')
}
