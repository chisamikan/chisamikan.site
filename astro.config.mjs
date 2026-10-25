import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

// サイト全体は静的生成(SSG)し、/api/* のみ各ページ側で `export const prerender = false` を
// 指定することで Cloudflare Workers 上のサーバー処理として動かします。
export default defineConfig({
  site: 'https://chisamikan.site',
  adapter: cloudflare({ imageService: 'compile' }),
  integrations: [
    sitemap({
      // /secret は隠しページ、/404 はエラーページのためサイトマップから除外する
      filter: (page) => !page.includes('/secret') && !page.includes('/404'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      // rss-parser は Node.js の組み込みモジュール(http/https等)に依存するため
      // Cloudflare Workers 向けのSSRバンドル対象から除外する
      external: ['rss-parser'],
    },
  },
});
