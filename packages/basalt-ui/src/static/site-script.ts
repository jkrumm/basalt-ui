/**
 * `siteScript()`: the one inline script the site parts share, for the document head after
 * `themeScript()`. Delegated listeners only, so it runs before the body exists and works for markup
 * added later. Two duties: a `[data-basalt-scheme]` button applies and stores the scheme (the
 * `setScheme` contract: `data-theme` on `<html>`, the `basalt:scheme` key) and every switch's
 * `aria-pressed` follows, honouring the same `key`, `attribute` and `cookie` options as `themeScript()`; a `[data-basalt-copy]` button copies the text of its block's `pre` and
 * announces its `data-copied-label`; the header's menus get the arrow keys (Left, Right, mirrored under `dir="rtl"`, Home, End between
 * the items, Down into a panel) and, where the browser has no interest invokers, hover with a short delay; a `[role=tab]` button inside `[data-basalt-tabs]` shows its panel
 * (click, arrow keys, Home, End) and the head marks the document `data-basalt-js`, so the tabs hide
 * their panels only where a script can show them. Logic is its own copy of `setScheme`; parity is tested.
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
 * About 1.4 kB gzip; a unit test holds it and `themeScript()` under 2 kB together.
 * A TanStack Start or Vite content site inlines `themeScript()` then `siteScript()` in its head with the same scheme options.
 *
 * @useWhen a content site outside Astro (TanStack Start, Vite) needs the theme switch, the copy button and the tabs without the astro integration
 * @neverWhen the site is Astro: `basaltAstro()` inlines both head scripts itself
 */
export function siteScript(options: SiteScriptOptions = {}): string {
  const key = JSON.stringify(options.key ?? SCHEME_KEY)
  const attr = JSON.stringify(options.attribute ?? SCHEME_ATTRIBUTE)
  const cookie = JSON.stringify(options.cookie ?? null)
  return [
    `(function(){var d=document,r=d.documentElement,k=${key},a=${attr},n=${cookie};`,
    `r.setAttribute("data-basalt-js","");`,
    `function cur(){return r.getAttribute(a)||"auto"}`,
    `function sync(){var v=cur(),b=d.querySelectorAll("[data-basalt-scheme]");for(var i=0;i<b.length;i++)b[i].setAttribute("aria-pressed",String(b[i].getAttribute("data-basalt-scheme")===v))}`,
    `function pick(b,f){var g=b.closest("[data-basalt-tabs]");if(!g)return;var l=b.getAttribute("data-tab"),ts=g.querySelectorAll("[role=tab]"),ps=g.querySelectorAll("[role=tabpanel]"),i;`,
    `for(i=0;i<ts.length;i++){var o=ts[i]===b;ts[i].setAttribute("aria-selected",String(o));ts[i].tabIndex=o?0:-1}`,
    `for(i=0;i<ps.length;i++){if(ps[i].getAttribute("data-label")===l)ps[i].setAttribute("data-on","");else ps[i].removeAttribute("data-on")}`,
    `g.setAttribute("data-picked","");if(f)b.focus()}`,
    `function link(){var gs=d.querySelectorAll("[data-basalt-tabs]");for(var j=0;j<gs.length;j++){var ts=gs[j].querySelectorAll("[role=tab]"),ps=gs[j].querySelectorAll("[role=tabpanel]");`,
    `for(var i=0;i<ts.length;i++)for(var m=0;m<ps.length;m++)if(ps[m].getAttribute("data-label")===ts[i].getAttribute("data-tab")){var k="bt"+j+"-"+i;ts[i].id=k+"t";ps[m].id=k+"p";ts[i].setAttribute("aria-controls",k+"p");ps[m].setAttribute("aria-labelledby",k+"t")}}}`,
    `d.addEventListener("keydown",function(e){var t=e.target instanceof Element?e.target.closest("[role=tab]"):null;if(!t)return;var g=t.closest("[data-basalt-tabs]");if(!g)return;`,
    `var ts=g.querySelectorAll("[role=tab]"),i=[].indexOf.call(ts,t),k=e.key,rt=getComputedStyle(g).direction==="rtl",nx=rt?"ArrowLeft":"ArrowRight",pv=rt?"ArrowRight":"ArrowLeft",n=k===nx?i+1:k===pv?i-1:k==="Home"?0:k==="End"?ts.length-1:-9;if(n===-9)return;e.preventDefault();pick(ts[(n+ts.length)%ts.length],1)});`,
    `d.addEventListener("click",function(e){var t=e.target instanceof Element?e.target:null;if(!t)return;`,
    `var tb=t.closest("[role=tab]");if(tb){pick(tb,0);return}`,
    `var s=t.closest("[data-basalt-scheme]");if(s){var v=s.getAttribute("data-basalt-scheme");`,
    `if(v==="auto")r.removeAttribute(a);else if(v==="light"||v==="dark")r.setAttribute(a,v);else return;`,
    `try{localStorage.setItem(k,v)}catch(x){}`,
    `if(n)try{d.cookie=n+"="+v+"; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax"}catch(x){}sync();return}`,
    `var c=t.closest("[data-basalt-copy]");if(!c)return;var f=c.closest("[data-basalt-code]"),p=f&&f.querySelector("pre");`,
    `if(!p||!navigator.clipboard)return;navigator.clipboard.writeText(p.innerText).then(function(){`,
    `var o=f.querySelector("[data-basalt-copy-status]");c.setAttribute("data-copied","");if(o)o.textContent=c.getAttribute("data-copied-label")||"";`,
    `setTimeout(function(){c.removeAttribute("data-copied");if(o)o.textContent=""},1500)},function(){})});`,
    `function pp(b){return d.getElementById(b.getAttribute("popovertarget"))}`,
    `d.addEventListener("keydown",function(e){var t=e.target instanceof Element?e.target.closest("[data-basalt-top]"):null;if(!t)return;`,
    `var l=[].slice.call(t.closest("[data-basalt-nav]").querySelectorAll("[data-basalt-top]")),i=l.indexOf(t),k=e.key,p=t.hasAttribute("popovertarget")?pp(t):null;`,
    `if(k==="ArrowDown"&&p&&p.showPopover){e.preventDefault();p.showPopover();var a=p.querySelector("a");if(a)a.focus();return}`,
    `var rt=getComputedStyle(t).direction==="rtl",nx=rt?"ArrowLeft":"ArrowRight",pv=rt?"ArrowRight":"ArrowLeft",n=k===nx?i+1:k===pv?i-1:k==="Home"?0:k==="End"?l.length-1:-9;if(n===-9)return;e.preventDefault();`,
    `var o=l[(n+l.length)%l.length],q=o.hasAttribute("popovertarget")?pp(o):null;o.focus();if(p&&q&&p.showPopover&&p.matches(":popover-open"))q.showPopover()});`,
    `if(!("interestForElement" in HTMLButtonElement.prototype)){var tm=0;`,
    `d.addEventListener("mouseover",function(e){var t=e.target instanceof Element?e.target:null;if(!t)return;clearTimeout(tm);var b=t.closest("[data-basalt-top][popovertarget]");`,
    `if(b){var p=pp(b);if(p&&p.showPopover&&!p.matches(":popover-open"))tm=setTimeout(function(){p.showPopover()},d.querySelector("[data-slot=site-menu-panel]:popover-open")?0:120);return}`,
    `if(t.closest("[data-slot=site-menu-panel]"))return;`,
    `tm=setTimeout(function(){var o=d.querySelector("[data-slot=site-menu-panel]:popover-open");if(o)o.hidePopover()},200)})}`,
    `function init(){sync();link()}if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init);else init()})()`,
  ].join('')
}
