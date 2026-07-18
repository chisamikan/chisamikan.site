/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#FAF7F0',
          dim: '#F1ECE0',
        },
        ink: {
          DEFAULT: '#221F1B',
          soft: '#453F37',
        },
        indigo: {
          DEFAULT: '#3A4A8C',
          light: '#5A6BB0',
        },
        marker: {
          DEFAULT: '#E85D3F',
          dark: '#C74A2E',
        },
        graphite: '#8C8578',
      },
      fontFamily: {
        display: ['"Oswald"', '"Zen Kaku Gothic New"', 'sans-serif'],
        body: ['"Oswald"', '"Zen Kaku Gothic New"', 'sans-serif'],
        mono: ['"Oswald"', '"Zen Kaku Gothic New"', 'sans-serif'],
      },
      rotate: {
        1.5: '1.5deg',
        '-1.5': '-1.5deg',
        2.5: '2.5deg',
        '-2.5': '-2.5deg',
      },
      boxShadow: {
        pin: '0 6px 16px -4px rgba(34, 31, 27, 0.25)',
        glass: '0 8px 32px -8px rgba(34, 31, 27, 0.18), inset 0 1px 0 0 rgba(255, 255, 255, 0.5)',
        'glass-lg': '0 20px 48px -12px rgba(34, 31, 27, 0.3), inset 0 1px 0 0 rgba(255, 255, 255, 0.6)',
      },
    },
  },
  plugins: [],
};
