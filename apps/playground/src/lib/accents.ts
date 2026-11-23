import type { AccentName } from 'basalt-ui/tokens'

/**
 * The accents the playground ships, its base first: the set `src/accents.css` carries
 * (`basalt-ui tokens:css --accents violet,rose,orange,green,teal`; `make regen` rewrites it).
 */
export const ACCENTS: readonly AccentName[] = ['blue', 'violet', 'rose', 'orange', 'green', 'teal']
