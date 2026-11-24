import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";

import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { defineCollection } from "astro:content";

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema(),
  }),
  // One MDX file per guide (src/guides/<slug>.mdx): adding a guide is adding the file. `order` places it in
  // the series, which the sidebar, the index and the pager follow.
  guides: defineCollection({
    loader: glob({ pattern: "*.mdx", base: "./src/guides" }),
    schema: z.object({
      title: z.string(),
      description: z.string(),
      date: z.coerce.date(),
      order: z.number(),
    }),
  }),
};
