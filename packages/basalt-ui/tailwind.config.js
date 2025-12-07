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

            // === BASALT-SPECIFIC CUSTOMIZATIONS ===
            // Only override what's unique to Basalt design system
            // Plugin handles layout/spacing (don't reimplement)

            maxWidth: '65ch', // Readable line length

            // Links - Basalt style (underline, offset, transition)
            a: {
              color: 'var(--tw-prose-links)',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
              fontWeight: '500',
              transition: 'all 150ms ease-in-out',
            },

            // Code blocks - Basalt muted background
            code: {
              backgroundColor: 'var(--muted)',
              color: 'var(--foreground)',
              padding: '0.2em 0.4em',
              borderRadius: 'var(--radius-sm)', // Reference Basalt token
              fontWeight: '400',
            },

            // Remove default backticks around inline code
            'code::before': { content: '""' },
            'code::after': { content: '""' },

            // Pre blocks - match Basalt card style
            pre: {
              backgroundColor: 'var(--muted)',
              borderRadius: 'var(--radius)', // Reference Basalt token
            },

            // Headings - use Basalt font family
            'h1, h2, h3, h4, h5, h6': {
              fontFamily: 'var(--font-heading)',
            },

            // Blockquotes - Basalt blue border
            blockquote: {
              borderLeftColor: 'var(--blue)',
            },
          },
        },
      },
    },
  },
  plugins: [typographyPlugin],
}
