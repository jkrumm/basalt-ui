/**
 * Keeps the guides at zero module JavaScript.
 *
 * Starlight registers expressive-code for every MDX fence on the site. It highlights at build time, but puts its
 * copy-button runtime (a module script of about 1.1 kB gzip) in front of the first block of a page. A guide's
 * blocks already carry the site's own copy button (`SiteCodeBlock` through `siteMdxComponents`, one inline
 * script for the whole site), so on a guide this plugin removes the script and expressive-code's inert copy
 * button, and nothing else: the docs keep both.
 *
 * It is a satteri hast plugin appended to the markdown processor, so it must come after `starlight()` in
 * `integrations` (Starlight adds expressive-code, whose plugin has to run first).
 */
const GUIDES = /[\\/]src[\\/]guides[\\/]/;

const classes = (node) => [node.properties?.className].flat().filter(Boolean);

const isEcScript = (node) => /\/ec\.[^/]+\.js$/.test(String(node.properties?.src ?? ""));

const isEcCopy = (node) =>
  classes(node).includes("copy") &&
  node.children?.some(
    (child) => child.tagName === "button" && child.properties?.dataCode !== undefined,
  );

const hastPlugin = {
  name: "basalt-guide-static-code",
  element: {
    filter: ["script", "div"],
    visit(node, ctx) {
      if (!GUIDES.test(ctx.fileURL?.pathname ?? "")) return;
      if (node.tagName === "script" ? isEcScript(node) : isEcCopy(node)) ctx.removeNode(node);
    },
  },
};

export function guideStaticCode() {
  return {
    name: "basalt-guide-static-code",
    hooks: {
      "astro:config:setup": ({ config }) => {
        config.markdown.processor.options.hastPlugins.push(hastPlugin);
      },
    },
  };
}
