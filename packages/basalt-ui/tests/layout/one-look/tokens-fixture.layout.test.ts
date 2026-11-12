/**
 * Runs the tokens fixture's own assertions (four entries, one boot script byte-equal to
 * `themeScript()`, no React or Tailwind, every `var(--vx-*)` a real token).
 *
 * `test/fixtures/**` is hidden from the root `bun test` loop by design, so a `*.fixture.test.ts` inside
 * it never runs on its own; this file is the runner. Importing a test module registers its tests.
 */
import '../../../test/fixtures/tokens/tokens.fixture.test'
