import typographyPlugin from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            // === MAP TO BASALT CSS VARIABLES (automatic dark mode) ===
            '--tw-prose-body': 'var(--foreground)',
            '--tw-prose-headings': 'var(--foreground)',
            '--tw-prose-lead': 'var(--text-subdued-light)',
            '--tw-prose-links': 'var(--blue)',
            '--tw-prose-bold': 'var(--foreground)',
            '--tw-prose-counters': 'var(--text-subdued-light)',
            '--tw-prose-bullets': 'var(--text-subdued-light)',
            '--tw-prose-hr': 'var(--border)',
            '--tw-prose-quotes': 'var(--foreground)',
            '--tw-prose-quote-borders': 'var(--border)',
            '--tw-prose-captions': 'var(--text-subdued-light)',
            '--tw-prose-code': 'var(--foreground)',
            '--tw-prose-pre-code': 'var(--foreground)',
            '--tw-prose-pre-bg': 'var(--muted)',
            '--tw-prose-th-borders': 'var(--border)',
            '--tw-prose-td-borders': 'var(--border)',

            // === BASALT TYPOGRAPHY SCALE ===
            // Map prose font sizes to Basalt design tokens
            // Critical because @theme inline disables default Tailwind font-size scale

            // Base prose font size
            fontSize: 'var(--font-size-body)',
            lineHeight: 'var(--line-height-body)',

            // Headings - Basalt scale with font family
            'h1, h2, h3, h4, h5, h6': {
              fontFamily: 'var(--font-heading)',
              fontWeight: 'var(--font-weight-bold)',
            },
            h1: {
              fontSize: 'var(--font-size-h1)',
              lineHeight: 'var(--line-height-h1)',
            },
            h2: {
              fontSize: 'var(--font-size-h2)',
              lineHeight: 'var(--line-height-h2)',
            },
            h3: {
              fontSize: 'var(--font-size-h3)',
              lineHeight: 'var(--line-height-h3)',
            },
            h4: {
              fontSize: 'var(--font-size-h4)',
              lineHeight: 'var(--line-height-h4)',
            },
            h5: {
              fontSize: 'var(--font-size-h5)',
              lineHeight: 'var(--line-height-h5)',
            },
            h6: {
              fontSize: 'var(--font-size-h6)',
              lineHeight: 'var(--line-height-h6)',
            },

            // Body text
            p: {
              fontSize: 'var(--font-size-body)',
              lineHeight: 'var(--line-height-body)',
            },

            // Lead paragraph (intro text)
            '[class~="lead"]': {
              fontSize: 'var(--font-size-h5)', // Slightly larger than body
              lineHeight: 'var(--line-height-h5)',
            },

            // Small text
            small: {
              fontSize: 'var(--font-size-small)',
              lineHeight: 'var(--line-height-small)',
            },

            // === BASALT-SPECIFIC CUSTOMIZATIONS ===

            maxWidth: '65ch', // Readable line length

            // Links - Basalt style (underline, offset, transition)
            a: {
              color: 'var(--tw-prose-links)',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
              fontWeight: '500',
              transition: 'all 150ms ease-in-out',
            },

            // Code - inline and blocks
            code: {
              fontFamily: 'var(--font-mono)',
              backgroundColor: 'var(--muted)',
              color: 'var(--foreground)',
              padding: '0.2em 0.4em',
              borderRadius: 'var(--radius-sm)',
              fontWeight: '400',
              fontSize: 'var(--font-size-small)', // Slightly smaller for code
            },

            // Remove default backticks around inline code
            'code::before': { content: '""' },
            'code::after': { content: '""' },

            // Pre blocks - match Basalt card style
            pre: {
              backgroundColor: 'var(--muted)',
              borderRadius: 'var(--radius)',
              fontSize: 'var(--font-size-small)',
              lineHeight: 'var(--line-height-small)',
            },

            // Code inside pre (don't double-apply styles)
            'pre code': {
              backgroundColor: 'transparent',
              padding: '0',
              borderRadius: '0',
              fontSize: 'inherit',
            },

            // Blockquotes - Basalt blue border
            blockquote: {
              borderLeftColor: 'var(--blue)',
              fontSize: 'var(--font-size-body)',
              lineHeight: 'var(--line-height-body)',
            },

            // Figcaption - use caption size
            figcaption: {
              fontSize: 'var(--font-size-caption)',
              lineHeight: 'var(--line-height-caption)',
            },
          },
        },
      },
    },
  },
  plugins: [typographyPlugin],
}
