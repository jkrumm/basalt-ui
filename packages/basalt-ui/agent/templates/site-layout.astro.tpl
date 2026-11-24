---
// The one layout of the site's pages, written by `basalt-ui init --profile site`; it is yours to edit.
// basaltAstro() in astro.config adds basalt's sheet and head scripts; this file adds the faces.
import BasaltFonts from 'basalt-ui/astro/BasaltFonts.astro'

interface Props {
  title: string
  description?: string
}

const { title, description } = Astro.props
---

<!doctype html>
<html lang="en" dir="ltr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    {description !== undefined && <meta name="description" content={description} />}
    <BasaltFonts />
    <title>{title}</title>
  </head>
  <body>
    <slot />
  </body>
</html>
