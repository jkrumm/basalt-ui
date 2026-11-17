# Marketing app: Starlight documentation

## Starlight Documentation

This app uses Starlight v0.37+ for documentation at `/docs/*`.

### Structure

- **Documentation root**: `src/content/docs/docs/` (nested structure creates `/docs/*` URLs)
- **Landing page**: `/docs` redirects to `/docs/introduction`
- **Demo pages**: Root level (`/typography`, `/colors`, etc.)
- **Docs pages**: `/docs/*` subpath

### Adding Documentation

1. Create new `.md` file in `src/content/docs/docs/`
2. Add frontmatter:
   ```markdown
   ---
   title: Page Title
   description: Page description
   ---
   ```
3. Update sidebar in `astro.config.mjs`:
   ```javascript
   sidebar: [
     {
       label: 'Section Name',
       items: [{ label: 'Page Title', slug: 'docs/page-slug' }],
     },
   ]
   ```

### Styling

**Provided by basalt-ui Package:**

Starlight styling is a vendored copy of basalt-ui 0.4.x CSS in this app, frozen pending the rebuild. The
`basalt-ui` package exports no Starlight entry point.

- **Starlight entry point**: `src/styles/basalt/starlight.css`, wired as `customCss` in `astro.config.mjs`
- **Starlight variables**: the `--sl-*` mappings live in `src/styles/basalt/starlight.css`
- **Tokens and base styles**: `src/styles/basalt/index.css`, imported by `src/styles/global.css` and by `starlight.css`

**Available Starlight Features:**

- Navigation (sidebar, top nav, mobile menu) - all styled
- Table of contents - automatic with Basalt colors
- Search - Pagefind integration with Basalt styling
- Code blocks - ExpressiveCode with `github-dark`/`github-light` themes
- Badges - All variants (note, tip, danger, caution, success) use Basalt semantic colors
- Link cards, tabs, asides - all styled automatically

### Configuration

- **Config file**: `astro.config.mjs` - Starlight integration
- **Content config**: `src/content.config.ts` - Content collections setup
- **Social links**: Configured as array in Starlight config (v0.37+ syntax)
- **ExpressiveCode**: GitHub themes match Basalt's dark/light modes

### Dark Mode

Starlight uses its own theme switcher that sets `data-theme="light"` attribute:

- Dark mode: No attribute or `data-theme="dark"` (default)
- Light mode: `data-theme="light"` on `<html>`
- Basalt UI CSS automatically handles both via `:root[data-theme='light']` selector
- No conflicts with main app's `.dark` class (different selectors)
