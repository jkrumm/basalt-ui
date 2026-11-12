/**
 * Fixture `tokens` (quality-contract section 5, row `tokens` CSS): a whole document the way a
 * consumer's root route renders it. The palette's tenant blocks are in the server HTML, the
 * `./theme-script` boot script sits in `<head>` and stamps `data-theme` before React hydrates, and
 * the one allowed `suppressHydrationWarning` is on `<html>`, nowhere else.
 */
import { themeScript } from '../../../../src/css/theme-script'
import { buildPaletteCss } from '../../../../src/tokens'

const palette = buildPaletteCss({
  scheme: { attribute: 'data-theme', darkValue: 'dark', lightValue: 'light' },
  mediaFallback: true,
})

export function Page({ locale }: { locale: string; timeZone: string }) {
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <title>tokens</title>
        <style dangerouslySetInnerHTML={{ __html: palette }} />
        <script dangerouslySetInnerHTML={{ __html: themeScript() }} />
      </head>
      <body>
        <main data-slot="fixture">tokens</main>
      </body>
    </html>
  )
}
