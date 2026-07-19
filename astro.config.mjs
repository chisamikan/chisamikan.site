import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

// サイト全体は静的生成(SSG)し、/api/contact のみ
// 各ページ側で `export const prerender = false` を指定することで
// Cloudflare Pages Functions 上のサーバー処理として動かします。
export default defineConfig({
  site: 'https://chisamikan.site',
  output: 'static', // 既定は静的生成(SSG)。/api/contact のみ prerender=false でサーバー実行
  adapter: cloudflare({
    imageService: 'compile',
    platformProxy: { enabled: true },
  }),
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      // rss-parser は Node.js の組み込みモジュール(http/https等)に依存するため
      // Cloudflare Workers 向けのSSRバンドル対象から除外する
      external: ['rss-parser'],
    },
  },
});
