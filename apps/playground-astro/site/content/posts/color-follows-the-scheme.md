---
title: Code colors follow the scheme
description: Shiki writes both themes; basalt picks one by the scheme attribute.
date: 2026-11-18
author: Ada Example
tags: [astro, shiki]
---

Fenced code is highlighted at build time. The block below carries a light and a dark color for every token.

## One config line

```ts
import { basaltShiki } from 'basalt-ui/astro'

export default defineConfig({ markdown: { shikiConfig: basaltShiki } })
```

## What the reader sees

Switching the scheme changes the token colors with no script and no repaint of the page.
