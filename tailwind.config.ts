import type { Config } from 'tailwindcss'
import forms from '@tailwindcss/forms'
import typography from '@tailwindcss/typography'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', './app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Palette Container Club — section 15.1 du brief
      colors: {
        bg: {
          base: 'var(--color-bg-base)',
          alt: 'var(--color-bg-alt)',
          elevated: 'var(--color-bg-elevated)',
          dark: 'var(--color-bg-dark)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          'on-dark': 'var(--color-text-on-dark)',
        },
        accent: {
          DEFAULT: 'var(--color-accent-primary)',
          hover: 'var(--color-accent-hover)',
          light: 'var(--color-accent-light)',
        },
        border: {
          DEFAULT: 'var(--color-border-base)',
          strong: 'var(--color-border-strong)',
        },
        success: {
          DEFAULT: 'var(--color-success)',
          bg: 'var(--color-success-bg)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          bg: 'var(--color-warning-bg)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          bg: 'var(--color-danger-bg)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          bg: 'var(--color-info-bg)',
        },
        cta: {
          DEFAULT: 'var(--color-cta-primary)',
          hover: 'var(--color-cta-primary-hover)',
          text: 'var(--color-cta-text)',
        },
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        input: 'var(--input)',
        ring: 'var(--ring)',
        sand: {
          DEFAULT: 'var(--sand)',
          soft: 'var(--sand-soft)',
          deep: 'var(--sand-deep)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          soft: 'var(--ink-soft)',
        },
        ember: {
          DEFAULT: 'var(--ember)',
          soft: 'var(--ember-soft)',
        },
        forest: 'var(--forest)',
        ochre: 'var(--ochre)',
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        // Typo responsive avec clamp() — section 15.2
        display: [
          'clamp(2rem, 5vw, 3.5rem)',
          { letterSpacing: '-0.04em', lineHeight: '1.05' },
        ],
        h1: [
          'clamp(1.75rem, 4vw, 2.5rem)',
          { letterSpacing: '-0.03em', lineHeight: '1.15' },
        ],
        h2: [
          'clamp(1.5rem, 3vw, 2rem)',
          { letterSpacing: '-0.02em', lineHeight: '1.2' },
        ],
        h3: ['1.25rem', { letterSpacing: '-0.01em', lineHeight: '1.35' }],
        body: ['1rem', { lineHeight: '1.6' }],
        label: ['0.75rem', { letterSpacing: '0.1em', lineHeight: '1.4' }],
      },
      borderRadius: {
        DEFAULT: '4px',
        lg: '8px',
        xl: '12px',
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(0, 0, 0, 0.04)',
        soft: '0 2px 8px rgba(0, 0, 0, 0.06)',
        medium: '0 4px 16px rgba(0, 0, 0, 0.08)',
      },
      // Touch targets ≥44px — mobile first
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        'fill-bar': 'fill-bar 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
        'pulse-success': 'pulse-success 1s ease-in-out',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fill-bar': {
          '0%': { width: '0%' },
          '100%': { width: 'var(--fill-target, 100%)' },
        },
        'pulse-success': {
          '0%, 100%': { backgroundColor: 'var(--color-success-bg)' },
          '50%': { backgroundColor: 'var(--color-success)' },
        },
      },
    },
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
  },
  plugins: [forms, typography],
}

export default config
