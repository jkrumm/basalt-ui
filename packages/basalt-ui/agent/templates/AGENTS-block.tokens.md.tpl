<!-- basalt:begin {{BASALT_VERSION}} -->

## basalt-ui (managed — do not hand-edit)

Placed by `basalt-ui init`, refreshed by `basalt-ui sync` (`--check` gates drift in CI); edit `DESIGN.md`, not this block.

**Stack** (profile `tokens`): CSS entries and `basalt-ui tokens:css` only; no React, no Tailwind, no lint preset. Color comes from a `--basalt-*` token, never a literal.

**Precedence** (highest wins): consumer `DESIGN.md` > global skills.

**Before guessing a token**, read `node_modules/basalt-ui/docs/<name>.md` (`basalt-ui doctor` prints where it is installed).

**Run the local bin** (`./node_modules/.bin/basalt-ui` or a package script), never `bunx`, `init` included: install `basalt-ui` first, then run `init` once from the local bin. Run the repo gate before reporting done. **A gap in basalt-ui** (a missing export, a part that cannot express the screen, a rule that refuses a legitimate shape) is filed in the package's issue tracker (`bugs.url` in `node_modules/basalt-ui/package.json`) with a minimal reproduction (the smallest file, the command and what it printed). Never patch it locally: no edit under `node_modules`, no local copy of a part, no waiver standing in for the fix.

<!-- basalt:end -->
