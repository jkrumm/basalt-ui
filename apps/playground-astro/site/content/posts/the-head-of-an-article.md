---
title: The head of an article
description: Canonical, Open Graph and structured data from one component.
date: 2026-11-10
author: Ada Example
tags: [seo]
---

`SiteHead` writes the tags a search result and a social card read.

## Props

```astro
<SiteHead title="..." description="..." type="article" published={date} authors={['Ada']} />
```

The canonical URL comes from `Astro.site` and the page's path.
