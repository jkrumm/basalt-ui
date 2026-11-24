import { glob } from 'astro/loaders'
import { defineCollection } from 'astro:content'
import { z } from 'astro/zod'

// One collection per page type: a guide is part of an ordered series, a post stands alone.
export const collections = {
  guides: defineCollection({
    loader: glob({ pattern: '*.mdx', base: './site/content/guides' }),
    schema: z.object({
      title: z.string(),
      description: z.string(),
      date: z.coerce.date(),
      order: z.number(),
    }),
  }),
  posts: defineCollection({
    loader: glob({ pattern: '*.md', base: './site/content/posts' }),
    schema: z.object({
      title: z.string(),
      description: z.string(),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      author: z.string(),
      tags: z.array(z.string()).default([]),
    }),
  }),
}
