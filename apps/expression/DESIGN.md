# @basalt-ui/expression — Design

> Seeded by `basalt-ui init`, then yours: `sync` never rewrites it and no version is stamped here
> (run `basalt-ui doctor` for the version). It records this app's intent and its narrow deltas; the law is in
> `.claude/rules/basalt-*.md`. The managed `AGENTS.md` block states the precedence once and does not
> import this file, so an agent reads it by name before it designs a screen.

## Identity

@basalt-ui/expression inherits the basalt-ui identity. Every colour is derived by `basalt-ui tokens:css` from
the flags recorded in `.basalt/manifest.json`, so this region names no value. Silence means "the defaults, unchanged".

- **Accent hue:** blue (one accent, spent where a decision turns on it)
- **Palette flags:** none set. Record a non-default `--accent`, `--neutral`, `--vibrancy` or `--accents` here, with its reason.
- **Density:** the `data-density` default (`dense`, `normal` or `comfortable`) if not `normal`, with its reason. Radius has no knob and the three faces ship in `fonts.css`.

## Direction

_A person writes this: what the app is for, who reads it, the tone it keeps. Agents leave it empty._

## Series

The colour of a metric is authored once, as a `{ light, dark }` pair under `series.<group>.<key>` in
src/basalt.tokens.ts; a chart takes the pair, an HTML mark `groupTokens('<group>', …)`'s variable. A
series earns a hue for a trend, a status or a split a reader must tell apart; the rest stay neutral.

| Series     | Key | Why it earned a hue |
| ---------- | --- | ------------------- |
| _none yet_ |     |                     |

## Deviations

A deviation only narrows a default (a smaller set, a stricter limit) and carries its reason on the
same line, set off by `—`, `--`, `because` or `reason:` (`- no dark charts — print needs light`). A deviation that widens the law is an eject or a waiver, recorded where it lives.

- _none yet_
