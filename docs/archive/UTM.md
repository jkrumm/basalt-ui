# UTM parameter strategy (archived 2026-09-02)

> Archived 2026-09-02 — cut from root `CLAUDE.md` in the C4 docs-consolidation wave. Neither
> README currently links `basalt-ui.com` with a live `utm_source` (both point off-domain). Historical,
> not maintained; revive this convention when a doc next links `basalt-ui.com`.

**Philosophy**: minimal tracking with Umami Analytics — track document source, not campaigns.

**Format**: a single parameter identifying the file/location:

```
?utm_source={file_location}
```

**Defined sources**: `root_readme`, `basalt_ui_readme`. (`brand_voice` dropped — its source doc was
deleted; `npm_package` dropped — `package.json`'s `homepage` now points to GitHub, not
`basalt-ui.com`.)

**Why**: the analytics already tracks referrers (github.com, npmjs.com), there are no active
campaigns, and one consistent parameter answers the only question that matters — "which document
did they click from?". We don't track `utm_medium` / `utm_campaign` / `utm_content` / `utm_term`.

Applies only to links that actually target `basalt-ui.com` (Umami only sees traffic on that
domain).

```markdown
[Some page](https://basalt-ui.com?utm_source=root_readme)
```
