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
        // アクセントは CSS変数(--color-accent-*)経由。ライト/ダークで色そのものが
        // 入れ替わる(CodePen "Liquid Glass" kit のトークン設計を踏襲)ため、
        // bg-accent 等の呼び出し側は変更せずテーマ追従する。
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          violet: 'rgb(var(--color-accent-violet) / <alpha-value>)',
          rose: 'rgb(var(--color-accent-rose) / <alpha-value>)',
          amber: 'rgb(var(--color-accent-amber) / <alpha-value>)',
          lime: 'rgb(var(--color-accent-lime) / <alpha-value>)',
        },
        graphite: 'rgb(var(--color-graphite) / <alpha-value>)',
        // すりガラス面の下地色・境界線色。ライト/ダークで不透明度ごと入れ替わる。
        glass: {
          DEFAULT: 'var(--glass-white)',
          md: 'var(--glass-white-md)',
          lg: 'var(--glass-white-lg)',
          dark: 'var(--glass-dark)',
          'dark-md': 'var(--glass-dark-md)',
        },
        'glass-border': {
          DEFAULT: 'var(--glass-border)',
          subtle: 'var(--glass-border-subtle)',
          bright: 'var(--glass-border-bright)',
        },
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
        // ガラス面の陰影も CSS変数経由(--shadow-*)にし、ライト/ダークで濃さが入れ替わるようにする。
        glass: 'var(--shadow-glass)',
        'glass-lg': 'var(--shadow-float)',
        'glass-accent': 'var(--shadow-glass-accent)',
        'glass-accent-lg': 'var(--shadow-glass-accent-lg)',
        card: 'var(--shadow-card)',
        'card-lg': 'var(--shadow-card-lg)',
        float: 'var(--shadow-float)',
        glow: 'var(--shadow-glow)',
      },
      // CodePen "Liquid Glass UI kit" の radius / blur スケールに合わせる。
      borderRadius: {
        xs: '6px',
        sm: '10px',
        md: '14px',
        lg: '20px',
        xl: '24px',
        '2xl': '32px',
      },
      backdropBlur: {
        sm: '8px',
        md: '18px',
        lg: '32px',
        xl: '60px',
      },
    },
  },
  plugins: [],
};
