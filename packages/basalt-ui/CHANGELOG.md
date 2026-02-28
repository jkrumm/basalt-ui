# [0.3.0](https://github.com/jkrumm/basalt-ui/compare/v0.2.2...v0.3.0) (2026-02-28)


### Bug Fixes

* remove --frozen-lockfile from Docker bun install ([b8ee288](https://github.com/jkrumm/basalt-ui/commit/b8ee288d10f04089f7d364caa9575c2c3574dae4))
* remove scope from release commit message to satisfy commitlint ([5c8ca17](https://github.com/jkrumm/basalt-ui/commit/5c8ca17ced4b646ee7b51d7fc263a12e989add60))
* replace @semantic-release/npm with exec to bypass workspace: protocol error ([905dc95](https://github.com/jkrumm/basalt-ui/commit/905dc95de06a1bf9f59ebf3fe9c1e4bfec5c3f6c))
* skip Docker job on release dry run ([f479092](https://github.com/jkrumm/basalt-ui/commit/f479092ff7fa30d442f6d55a2454b7a94a4ad2ac))


### Features

* add OCI labels to Docker images ([cd8fcfb](https://github.com/jkrumm/basalt-ui/commit/cd8fcfb46e079a023065d09fa4b7f8d100a33086))

# Changelog

## [0.2.2](https://github.com/jkrumm/basalt-ui/compare/v0.2.1...v0.2.2) (2026-02-27)


### Performance Improvements

* change font-display from block to swap ([ed485ba](https://github.com/jkrumm/basalt-ui/commit/ed485ba0bdddad77ed6f3e773dc0c565f4a7523d))

## [0.2.1](https://github.com/jkrumm/basalt-ui/compare/v0.2.0...v0.2.1) (2026-02-09)


### Bug Fixes

* add missing language subsets and font weights ([e667d9a](https://github.com/jkrumm/basalt-ui/commit/e667d9af7e63527d807f946e97ac556ad3792255))
* use font-display block to prevent flickering in Astro MPAs ([c3c286f](https://github.com/jkrumm/basalt-ui/commit/c3c286ffc41db5ebe3bdec0f45523c02baa3e7fa))

# [0.2.0](https://github.com/jkrumm/basalt-ui/compare/v0.1.0...v0.2.0) (2026-02-09)


### Features

* enhance package exports and peer dependencies ([d34a2cf](https://github.com/jkrumm/basalt-ui/commit/d34a2cf38f30d25ab759d6e7922a737f163104f8))
* integrate fonts and improve CSS architecture ([b95fc24](https://github.com/jkrumm/basalt-ui/commit/b95fc24d8c6bcc1357e77ba9cfbadae0348f33ab))
* **JK-34:** add `shadcn` and `tw-animate-css` to basalt-ui dependencies ([20c5a10](https://github.com/jkrumm/basalt-ui/commit/20c5a10f2c9d0fda9eed1e2be3d0d16fca6253ff))

# 0.1.0 (2025-12-12)


### Features

* add Starlight compatibility with dedicated CSS file c16087c
* add Tremor Raw compatibility with enhanced color system 9e74979
* added foundation palette architecture and foreground color pairings 2efa222
* added Tailwind Typography integration and Tremor styling 1ec6f05
* adopt Nord Aurora colors and Frost blue as primary accent 3b1f44d, closes #81a1c1 #81a1c1 #5e81ac
* **basalt-ui:** implement mature OKLCH-based volcanic design system 1ad67b1
* introduce Basalt UI a Tailwind CSS design system fe4db96
* **JK-32:** rewrite basalt-ui README and metadata d1b6b90
* refine OKLCH color tokens for improved contrast and consistency aedf443
* replace Tailwind preset with @tailwindcss/typography integration 120c80e

All notable changes to basalt-ui will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).
