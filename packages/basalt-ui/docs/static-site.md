# A static site on the tokens

A static page needs no React, no Tailwind and no peers. `basalt-ui` ships the token layer as four
CSS entries, one head script and one CLI verb. They read the same `--vx-*` variables an app built
on the component layer reads, so a landing page and the product look like one thing.

```sh
bun add basalt-ui
```

The install resolves `basalt-ui`, `clsx`, `class-variance-authority`, `eventsource-parser` and the three
variable fonts. None of them runs on a static page. The four entries total about 17.7 KB.

## The four CSS entries

Import them in this order from your CSS bundler (Astro, Vite) or copy the files next to the page.

```css
@import 'basalt-ui/fonts.css'; /* @font-face only: needs a bundler or a copy step for the woff2 files */
@import 'basalt-ui/tokens.css'; /* unlayered on purpose: :root[data-theme] must out-rank :root */
@import 'basalt-ui/typography.css'; /* @layer basalt.type: the 7-rung type ladder and the base rules */
@import 'basalt-ui/prose.css'; /* @layer basalt.prose: .vx-prose, every selector inside :where() */
```

| Entry            | Holds                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `tokens.css`     | the `--vx-*` roles for light and dark, radii, density, the `prefers-color-scheme` fallback |
| `typography.css` | `--vx-text-*` rungs, `:where(:root)` base, focus ring, reduced-motion reset                |
| `prose.css`      | `.vx-prose` for h2-h4, paragraphs, lists, code, tables                                     |
| `fonts.css`      | the `@font-face` rules for the three faces plus Head Digits                                |

Your own rules beat `.vx-prose` without `!important`. Read colour, spacing and type through
`var(--vx-*)`, never a literal.

## Retune the tokens

`tokens.css` is replaced, never stacked on. Emit your own with `tokens:css` and commit the file:

```sh
bunx basalt-ui tokens:css --accent <hex> --vibrancy 2 --out src/styles/tokens.css
bunx basalt-ui tokens:css --accent <hex> --vibrancy 2 --format json --out src/tokens.json
```

The JSON carries the resolved hex per opaque role and scheme, for `theme-color` metas and email.
Add `--check` to either command in CI: it writes nothing and exits 1 when the committed file differs.

## The theme script

`auto` needs no JavaScript: `tokens.css` follows `prefers-color-scheme` while `<html>` carries no
`data-theme`. The script adds the stored choice before first paint. Copy it into `<head>` verbatim,
or call `themeScript()` from `basalt-ui/theme-script` at build time. The literal below is the
default output; a test keeps it byte-equal to `themeScript()`.

<!-- prettier-ignore -->
```html
<script>
(function(){var d=document.documentElement,a="data-theme",c=null,v;if(d.hasAttribute(a))return
function t(f){try{var x=f();if(x==="light"||x==="dark"||x==="auto")return x}catch(e){}}
function s(k){return t(function(){return localStorage.getItem(k)})}
v=s("basalt:scheme")||s("mantine-color-scheme-value")||t(function(){return c&&document.cookie.split(/;\s*/).reduce(function(r,p){
return r||(p.indexOf(c+"=")===0?p.slice(c.length+1):r)},"")})||"auto"
if(v==="light"||v==="dark")d.setAttribute(a,v)})()
</script>
```

It reads `localStorage['basalt:scheme']` (a raw `light`, `dark` or `auto` string), then the legacy
`mantine-color-scheme-value` key, then the cookie if you name one, then the default. It stamps
`data-theme` only for `light` or `dark`, never overrides an attribute already present, and survives
storage that throws.

| Option      | Default         | Effect                                                                       |
| ----------- | --------------- | ---------------------------------------------------------------------------- |
| `key`       | `basalt:scheme` | the storage key                                                              |
| `default`   | `auto`          | the scheme when nothing is stored; `'dark'` stamps dark whatever the OS says |
| `cookie`    | none            | a cookie to read after both keys                                             |
| `attribute` | `data-theme`    | the attribute to stamp                                                       |

## What a static page does not get

Components, the Tailwind bridge, charts and the shell are other profiles. They read the same tokens,
so moving up later changes no colour. Firefox and Safari are not covered by the browser tests.
