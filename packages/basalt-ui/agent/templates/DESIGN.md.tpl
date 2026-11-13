# {{APP_NAME}} — Design

> Seeded by `basalt-ui init`, then yours: `sync` never rewrites it and no version is stamped here
> (run `basalt-ui doctor` for the version). It records this app's intent and its narrow deltas; the law is in
> `.claude/rules/basalt-*.md`. The managed `AGENTS.md` block states the precedence once and does not
> import this file, so an agent reads it by name before it designs a screen.

## Identity

{{APP_NAME}} inherits the basalt-ui identity, and every value behind it is derived from the
`basalt()` configuration, so this region names no value. Silence means "the defaults, unchanged".

- **Accent hue:** {{ACCENT_HUE}} (one accent, spent where a decision turns on it)
- **Knobs:** none set. Record any non-default `derive`, `fonts`, `radius` or `density` here, with its reason.

## Direction

_The owner writes this: what the app is for, who reads it, the tone it keeps. Agents leave it empty._

## Series

The colour of a metric is authored once, as a `{ light, dark }` pair in {{SERIES_MODULE_PATH}}. A
series earns a hue for a trend, a status or a split a reader must tell apart; the rest stay neutral.

| Series | Key | Why it earned a hue |
| ------ | --- | ------------------- |
| _none yet_ |  |  |

## Deviations

A deviation only narrows a default (a smaller set, a stricter limit) and carries its reason on the
same line. A deviation that widens the law is an eject or a waiver, recorded where it lives.

- _none yet_
