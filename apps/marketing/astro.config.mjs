import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import { basaltAstro } from "basalt-ui/astro";
import { defineConfig } from "astro/config";
import { guideStaticCode } from "./plugins/guide-static-code.mjs";

export default defineConfig({
  site: "https://basalt-ui.com",
  server: { port: 7711, host: false },
  // Starlight turns prefetch on for every page, which puts a module script on pages that have no
  // island. The site keeps its static pages at zero client JavaScript (site-budgets.json).
  prefetch: false,
  integrations: [
    react(),
    // Tailwind 4, basalt-ui/static.css, the three faces (Astro Fonts API) and the head scripts.
    basaltAstro(),
    starlight({
      title: "Basalt UI",
      description:
        "One look for dashboards, docs and content sites: React on Base UI and Tailwind 4.",
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "Introduction", slug: "docs/introduction" },
            { label: "Installation", slug: "docs/installation" },
          ],
        },
        {
          label: "Design Tokens",
          items: [
            { label: "Colors", slug: "docs/colors" },
            { label: "Typography", slug: "docs/typography" },
            { label: "Spacing", slug: "docs/spacing" },
          ],
        },
        {
          label: "Guides",
          items: [{ label: "Astro Font Optimization", slug: "docs/astro-fonts" }],
        },
      ],
      social: [{ label: "GitHub", icon: "github", href: "https://github.com/jkrumm/basalt-ui" }],
      // Starlight's theme variables read basalt's tokens; one scheme store for docs and site.
      customCss: ["basalt-ui/starlight.css"],
      expressiveCode: {
        // Syntax colors come from this pair; the frame, surface and markers come from starlight.css.
        themes: ["github-dark", "github-light"],
        // basalt's scheme: data-theme for an explicit choice, the system scheme when it is absent.
        useStarlightDarkModeSwitch: false,
        useDarkModeMediaQuery: true,
        themeCssSelector: (theme) => `[data-theme='${theme.type}']`,
      },
      components: {
        Head: "./src/components/starlight/Head.astro",
        ThemeProvider: "./src/components/starlight/ThemeProvider.astro",
        ThemeSelect: "./src/components/starlight/ThemeSelect.astro",
      },
    }),
    // After starlight(), whose expressive-code integration it must follow: it drops expressive-code's
    // module script from the guides, which keep the site's own copy button and zero module JavaScript.
    guideStaticCode(),
    // After starlight(): Starlight sees it and skips its own mdx({ optimize: true }), whose optimize
    // compiles plain elements to HTML strings so the guides' siteMdxComponents overrides (h2, a, table,
    // pre) never run; and Starlight's expressive-code integration still lands before it.
    mdx(),
  ],
  vite: {
    // Both doors: the local *.test vhost and the mini's clean tailnet door.
    // Caddy passes the original Host through, so an unlisted name is a 403,
    // not a fallback — see dotfiles/scripts/caddy-tailnet.sh.
    server: { allowedHosts: ["basalt.test", "basalt.mini.jkrumm.com"] },
  },
});
