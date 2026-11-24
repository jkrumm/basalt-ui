# A static site on the tokens

A static page needs no React, no Tailwind and no peers. `basalt-ui` ships the token layer as four
CSS entries, one head script and one CLI verb. They read the same `--basalt-*` variables an app built
on the component layer reads, so a landing page and the product look like one thing.

```sh
bun add basalt-ui
```

The install resolves `basalt-ui`, `clsx`, `class-variance-authority`, `eventsource-parser` and the three
variable fonts. None of them runs on a static page. The four entries total about 17.7 KB.

## The four CSS entries

Import them in this order from your CSS bundler (Astro, Vite) or copy the files next to the page. `fonts.css` names
its six woff2 files relative to itself (`./files/`), so copy `dist/css/files` beside it too.

```css
@import 'basalt-ui/fonts.css'; /* @font-face only: the woff2 files sit in dist/css/files, resolved by a bundler or copied with the sheet */
@import 'basalt-ui/tokens.css'; /* unlayered on purpose: :root[data-theme] must out-rank :root */
@import 'basalt-ui/typography.css'; /* @layer basalt.type: the 7-rung type ladder and the base rules */
@import 'basalt-ui/prose.css'; /* @layer basalt.prose: .basalt-prose, every selector inside :where() */
```

| Entry            | Holds                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| `tokens.css`     | the `--basalt-*` roles for light and dark, radii, density, the `prefers-color-scheme` fallback |
| `typography.css` | `--basalt-text-*` rungs, `:where(:root)` base, focus ring, reduced-motion reset                |
| `prose.css`      | `.basalt-prose` for h2-h4, paragraphs, lists, code, tables                                     |
| `fonts.css`      | the `@font-face` rules for the three faces plus Head Digits                                    |

Your own rules beat `.basalt-prose` without `!important`. Read color, spacing and type through
`var(--basalt-*)`, never a literal.

## Diagrams (archify)

A fifth, opt-in entry themes an [archify](https://github.com/tt-a1i/archify) diagram: load
`basalt-ui/archify.css` after `tokens.css` and set `data-preset="basalt"` on the inline `<svg>` or its
wrapper. The one `[data-preset='basalt']` block maps all 32 archify variables to `--basalt-*` tokens, so the
diagram follows the page's light and dark scheme with no second palette. The diagram's background reads
`--basalt-surface` (the canvas); on a card, set `--basalt-surface: var(--basalt-card)` on the card, or
`data-surface='card'` where `tailwind.css` is loaded (it owns that attribute rule). The file is unlayered on purpose (archify's
own theme blocks are, and an unlayered rule out-ranks a layered one); it needs `tokens.css` loaded, since
it carries no fallback colors.

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
or call `themeScript({ appearance: false })` from `basalt-ui/theme-script` at build time. A static page
has no appearance setter, so the literal below is the scheme half only; a test keeps it byte-equal to
`themeScript({ appearance: false })`.

<!-- prettier-ignore -->
```html
<script>
(function(){var d=document.documentElement,a="data-theme",c=null,v;if(d.hasAttribute(a))return
function t(f){try{var x=f();if(x==="light"||x==="dark"||x==="auto")return x}catch(e){}}
function s(k){return t(function(){return localStorage.getItem(k)})}
v=s("basalt:scheme")||t(function(){return c&&document.cookie.split(/;\s*/).reduce(function(r,p){
return r||(p.indexOf(c+"=")===0?p.slice(c.length+1):r)},"")})||"auto"
if(v==="light"||v==="dark")d.setAttribute(a,v)})()
</script>
```

It reads `localStorage['basalt:scheme']` (a raw `light`, `dark` or `auto` string), then the cookie
if you name one, then the default. It stamps
`data-theme` only for `light` or `dark`, never overrides an attribute already present, and survives
storage that throws.

| Option      | Default         | Effect                                                                       |
| ----------- | --------------- | ---------------------------------------------------------------------------- |
| `key`       | `basalt:scheme` | the storage key                                                              |
| `default`   | `auto`          | the scheme when nothing is stored; `'dark'` stamps dark whatever the OS says |
| `cookie`    | none            | a cookie to read after both keys                                             |
| `attribute` | `data-theme`    | the attribute to stamp                                                       |

## React islands

A React island on a static page (an Astro component with a `client:*` directive) mounts its own React
root. It can use the `basalt-ui/ui/*` primitives with no router, no query client and no shell: no
primitive needs `BasaltProvider`, and none needs a router. Each one renders and hydrates with no
provider and inside a provider with no `link`; `primitive.contract.test.tsx` runs both for every
`ui` module. Declare the islands' directory as a `parts` root in `.basalt/manifest.json`.

Wrap an island in `<BasaltProvider locale="de-DE">` only for what it changes:

| Prop     | Read by                                                                                                     | Without it                                |
| -------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `locale` | the numbers and dates of `Num`, `Meter`, `Progress`, `Slider` and `DatePicker`, and counts in built-in text | English                                   |
| `scheme` | the page: `data-theme` on `<html>` and the stored choice                                                    | the head script's choice, else the system |
| `link`   | `Card`'s `href` and the composites' link props                                                              | a plain `<a>`                             |

Omit `scheme` in an island: the head script owns the first paint, and two islands that each set it
would write the stored choice twice. The provider costs about 0.4 KB gzip on top of React, and the
smallest island (a provider and one `Button`) about 9 KB, nearly all of it the button's class table;
`check-budgets` holds both (rows `provider-v3` and `island-button`).

## What a static page does not get

Components, the Tailwind bridge, charts and the shell are other profiles. They read the same tokens,
so moving up later changes no color. Firefox and Safari are not covered by the browser tests.
