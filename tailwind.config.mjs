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
        display: ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
        body: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      rotate: {
        1.5: '1.5deg',
        '-1.5': '-1.5deg',
        2.5: '2.5deg',
        '-2.5': '-2.5deg',
      },
      boxShadow: {
        pin: '0 6px 16px -4px rgba(34, 31, 27, 0.25)',
      },
    },
  },
  plugins: [],
};
