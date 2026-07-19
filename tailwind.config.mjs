/** @type {import('tailwindcss').Config} */

// paper/ink/graphite はライト/ダークで値が入れ替わるCSS変数(--color-*)経由にし、
// コンポーネント側のクラス(bg-paper, text-ink 等)を書き換えずにテーマ切替できるようにする。
// アクセントカラーはどちらのテーマでも視認性が保てるため固定値のまま。
// Tailwind v4 の @config 互換レイヤーは関数値を解決できないため、
// <alpha-value> プレースホルダを使った文字列形式で定義する。
export default {
  darkMode: 'class',
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: 'rgb(var(--color-paper) / <alpha-value>)',
          dim: 'rgb(var(--color-paper-dim) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--color-ink) / <alpha-value>)',
          soft: 'rgb(var(--color-ink-soft) / <alpha-value>)',
        },
        accent: {
          DEFAULT: '#0099FF',
          dark: '#0077CC',
          light: '#4DB8FF',
        },
        graphite: 'rgb(var(--color-graphite) / <alpha-value>)',
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
