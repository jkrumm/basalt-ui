export default {
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: 'var(--primary)',
        muted: 'var(--muted)',
        border: 'var(--border)',
        ring: 'var(--ring)',
      },
      fontFamily: {
        heading: 'var(--font-heading)',
        body: 'var(--font-body)',
        mono: 'var(--font-mono)',
      },
      fontSize: {
        // Utility sizes (keep existing)
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        // Semantic Typography Scale
        caption: ['0.75rem', { lineHeight: '1rem' }],
        small: ['0.875rem', { lineHeight: '1.25rem' }],
        body: ['1rem', { lineHeight: '1.5' }],
        h6: ['1rem', { lineHeight: '1.5' }],
        h5: ['1.125rem', { lineHeight: '1.5' }],
        h4: ['1.25rem', { lineHeight: '1.4' }],
        h3: ['1.5rem', { lineHeight: '1.4' }],
        h2: ['2rem', { lineHeight: '1.3' }],
        h1: ['2.5rem', { lineHeight: '1.2' }],
        hero: ['3rem', { lineHeight: '1.2' }],
        display: ['4rem', { lineHeight: '1.2' }],
      },
      fontWeight: {
        regular: 'var(--font-weight-regular)',
        bold: 'var(--font-weight-bold)',
      },
      letterSpacing: {
        tight: 'var(--tracking-tight)',
        normal: 'var(--tracking-normal)',
        wide: 'var(--tracking-wide)',
      },
      borderRadius: {
        sm: '0.375rem',
        base: '0.5rem',
        md: '0.75rem',
        lg: '1rem',
      },
    },
  },
}
