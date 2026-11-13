---
name: mdxComponents
use when: 'authored MDX is compiled by the app''s toolchain and should render in the basalt look'
never when: 'the text came from a model (MDX is code; use `Markdown` with `contentTrust="untrusted"`)'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: []
---

# mdxComponents

The fixed MDX component map: anchored `h2`-`h4`, `a` through the url policy, `table`,
`blockquote` on `Alert`, and `Callout`, `Steps`, `Step`, `Tabs`, `Tab`, `Figure` and `Kbd` for
the tags an author writes. Pass it as the `components` of the compiled module. It needs no
markdown peer and no compiler; the page is wrapped in `Prose`. A heading id the compiler already
set (rehype-slug) is kept; otherwise it is the slug of the heading text, so two identical
headings need distinct ids from the compiler. `pre` is not in the map: the recipe adapts it.

## Signature

```ts
mdxComponents: Readonly<Record<string, ComponentType<never>>>
```
