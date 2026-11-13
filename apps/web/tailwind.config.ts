import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Roboto', 'sans-serif'],
      },
      colors: {
        background: '#f5f7f2',
        foreground: '#183e48',
        card: {
          DEFAULT: '#ffffff',
          foreground: '#183e48',
        },
        popover: {
          DEFAULT: '#ffffff',
          foreground: '#183e48',
        },
        primary: {
          DEFAULT: '#19806d',
          foreground: '#ffffff',
          dark: '#126253',
        },
        secondary: {
          DEFAULT: '#e8efe9',
          foreground: '#183e48',
        },
        muted: {
          DEFAULT: '#edf2ed',
          foreground: '#5b7072',
        },
        accent: {
          DEFAULT: '#e8efe9',
          foreground: '#19806d',
        },
        destructive: {
          DEFAULT: '#b42318',
          foreground: '#ffffff',
        },
        border: '#d9e2dc',
        input: '#d9e2dc',
        ring: '#19806d',
        ink: '#183e48',
        brandAmber: '#e7b73e',
        brandEmerald: '#16a34a',
      },
      keyframes: {
        'pulse-ring': { '0%': { boxShadow: '0 0 0 0 rgba(231,183,62,0.65)' }, '70%,100%': { boxShadow: '0 0 0 14px rgba(231,183,62,0)' } },
        'bounce-calm': { '0%,100%': { transform: 'translateY(0)', animationTimingFunction: 'cubic-bezier(.3,0,.4,1)' }, '50%': { transform: 'translateY(-7px)', animationTimingFunction: 'cubic-bezier(.6,0,.7,1)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        appear: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      transitionTimingFunction: { brand: 'cubic-bezier(.2,.7,.2,1)' },
      animation: { appear: 'appear 250ms cubic-bezier(.2,.7,.2,1) both', 'bounce-calm': 'bounce-calm 2.8s infinite', float: 'float 4s ease-in-out infinite', 'pulse-ring': 'pulse-ring 1.8s ease-out infinite' },
      borderRadius: {
        lg: '1rem',
        md: '0.75rem',
        sm: '0.5rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};

export default config;
