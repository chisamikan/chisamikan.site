/** @type {import('tailwindcss').Config} */

// paper/ink/graphite はライト/ダークで値が入れ替わるCSS変数(--color-*)経由にし、
// コンポーネント側のクラス(bg-paper, text-ink 等)を書き換えずにテーマ切替できるようにする。
// アクセントカラーはどちらのテーマでも視認性が保てるため固定値のまま。
function withOpacity(variableName) {
  return ({ opacityValue }) =>
    opacityValue === undefined
      ? `rgb(var(${variableName}))`
      : `rgb(var(${variableName}) / ${opacityValue})`;
}

export default {
  darkMode: 'class',
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: withOpacity('--color-paper'),
          dim: withOpacity('--color-paper-dim'),
        },
        ink: {
          DEFAULT: withOpacity('--color-ink'),
          soft: withOpacity('--color-ink-soft'),
        },
        accent: {
          DEFAULT: '#0099FF',
          dark: '#0077CC',
          light: '#4DB8FF',
        },
        graphite: withOpacity('--color-graphite'),
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
        'glass-accent': '0 8px 28px -6px rgba(0, 153, 255, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.35)',
      },
    },
  },
  plugins: [],
};
