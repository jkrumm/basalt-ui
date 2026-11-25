# Playground: auth pages, Phone and Two panes removed (Issue 3301)

Frames of every page the change touches, shot headless with `apps/playground/scripts/shots.ts` (the landing,
the removed pages, the two new pages) and a one-off Playwright run for the form states. Reshoot: build the
playground, then `bun apps/playground/scripts/shots.ts / /sign-in /register`.

## Before: the landing and the two removed pages (master)

| Page                          | Light 1800x1200                                                              | Dark 1800x1200                                                              | Light 390x844                                                              | Dark 390x844                                                              |
| ----------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Start (landing)               | [frame](assets/auth-pages-2026-11-25/before-root--light--1800x1200.png)      | [frame](assets/auth-pages-2026-11-25/before-root--dark--1800x1200.png)      | [frame](assets/auth-pages-2026-11-25/before-root--light--390x844.png)      | [frame](assets/auth-pages-2026-11-25/before-root--dark--390x844.png)      |
| /kit/mobile-nav (Phone stop)  | [frame](assets/auth-pages-2026-11-25/kit-mobile-nav--light--1800x1200.png)   | [frame](assets/auth-pages-2026-11-25/kit-mobile-nav--dark--1800x1200.png)   | [frame](assets/auth-pages-2026-11-25/kit-mobile-nav--light--390x844.png)   | [frame](assets/auth-pages-2026-11-25/kit-mobile-nav--dark--390x844.png)   |
| /recipes/two-pane (Two panes) | [frame](assets/auth-pages-2026-11-25/recipes-two-pane--light--1800x1200.png) | [frame](assets/auth-pages-2026-11-25/recipes-two-pane--dark--1800x1200.png) | [frame](assets/auth-pages-2026-11-25/recipes-two-pane--light--390x844.png) | [frame](assets/auth-pages-2026-11-25/recipes-two-pane--dark--390x844.png) |

## After: the landing links the two auth pages

| Page            | Light 1800x1200                                                        | Dark 1800x1200                                                        | Light 390x844                                                        | Dark 390x844                                                        |
| --------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Start (landing) | [frame](assets/auth-pages-2026-11-25/after-root--light--1800x1200.png) | [frame](assets/auth-pages-2026-11-25/after-root--dark--1800x1200.png) | [frame](assets/auth-pages-2026-11-25/after-root--light--390x844.png) | [frame](assets/auth-pages-2026-11-25/after-root--dark--390x844.png) |

## After: the new pages

| Page      | Light 1800x1200                                                      | Dark 1800x1200                                                      | Light 390x844                                                      | Dark 390x844                                                      |
| --------- | -------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| /sign-in  | [frame](assets/auth-pages-2026-11-25/sign-in--light--1800x1200.png)  | [frame](assets/auth-pages-2026-11-25/sign-in--dark--1800x1200.png)  | [frame](assets/auth-pages-2026-11-25/sign-in--light--390x844.png)  | [frame](assets/auth-pages-2026-11-25/sign-in--dark--390x844.png)  |
| /register | [frame](assets/auth-pages-2026-11-25/register--light--1800x1200.png) | [frame](assets/auth-pages-2026-11-25/register--dark--1800x1200.png) | [frame](assets/auth-pages-2026-11-25/register--light--390x844.png) | [frame](assets/auth-pages-2026-11-25/register--dark--390x844.png) |

## After: form states

| Page                                                           | Light 1800x1200                                                               | Dark 1800x1200                                                               | Light 390x844                                                               | Dark 390x844                                                               |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Sign in, submitted empty (blur and submit errors)              | [frame](assets/auth-pages-2026-11-25/sign-in-invalid--light--1800x1200.png)   | [frame](assets/auth-pages-2026-11-25/sign-in-invalid--dark--1800x1200.png)   | [frame](assets/auth-pages-2026-11-25/sign-in-invalid--light--390x844.png)   | [frame](assets/auth-pages-2026-11-25/sign-in-invalid--dark--390x844.png)   |
| Sign in, wrong pair (error on Password)                        | [frame](assets/auth-pages-2026-11-25/sign-in-refused--light--1800x1200.png)   | [frame](assets/auth-pages-2026-11-25/sign-in-refused--dark--1800x1200.png)   | [frame](assets/auth-pages-2026-11-25/sign-in-refused--light--390x844.png)   | [frame](assets/auth-pages-2026-11-25/sign-in-refused--dark--390x844.png)   |
| Forgotten password                                             | [frame](assets/auth-pages-2026-11-25/sign-in-forgot--light--1800x1200.png)    | [frame](assets/auth-pages-2026-11-25/sign-in-forgot--dark--1800x1200.png)    | [frame](assets/auth-pages-2026-11-25/sign-in-forgot--light--390x844.png)    | [frame](assets/auth-pages-2026-11-25/sign-in-forgot--dark--390x844.png)    |
| Reset link sent                                                | [frame](assets/auth-pages-2026-11-25/sign-in-sent--light--1800x1200.png)      | [frame](assets/auth-pages-2026-11-25/sign-in-sent--dark--1800x1200.png)      | [frame](assets/auth-pages-2026-11-25/sign-in-sent--light--390x844.png)      | [frame](assets/auth-pages-2026-11-25/sign-in-sent--dark--390x844.png)      |
| Register, taken address (error on Email)                       | [frame](assets/auth-pages-2026-11-25/register-refused--light--1800x1200.png)  | [frame](assets/auth-pages-2026-11-25/register-refused--dark--1800x1200.png)  | [frame](assets/auth-pages-2026-11-25/register-refused--light--390x844.png)  | [frame](assets/auth-pages-2026-11-25/register-refused--dark--390x844.png)  |
| Landing after sign in with demo / demo (account row signed in) | [frame](assets/auth-pages-2026-11-25/signed-in-landing--light--1800x1200.png) | [frame](assets/auth-pages-2026-11-25/signed-in-landing--dark--1800x1200.png) | [frame](assets/auth-pages-2026-11-25/signed-in-landing--light--390x844.png) | [frame](assets/auth-pages-2026-11-25/signed-in-landing--dark--390x844.png) |
