<!-- basalt:begin {{BASALT_VERSION}} -->

## basalt-ui (managed — do not hand-edit)

Placed by `basalt-ui init`, refreshed by `basalt-ui sync` (`--check` gates drift in CI); edit `DESIGN.md`, not this block.

**Stack** (profile `tokens`): CSS entries and `basalt-ui tokens:css` only; no React, no Tailwind, no lint preset. Colour comes from a `--vx-*` token, never a literal.

**Precedence** (highest wins): consumer `DESIGN.md` > global skills.

**Before guessing a token**, read `node_modules/basalt-ui/docs/<name>.md` (`basalt-ui doctor` prints where it is installed).

**Run the local bin** (`./node_modules/.bin/basalt-ui` or a package script), never `bunx`; `init` is the one exception. Run the repo gate before reporting done.

<!-- basalt:end -->
