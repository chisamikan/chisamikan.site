import { defineConfig, sharpImageService } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

// サイト全体は静的生成(SSG)し、/api/* のみ各ページ側で `export const prerender = false` を
// 指定することで Cloudflare Workers 上のサーバー処理として動かします。
export default defineConfig({
  site: 'https://chisamikan.site',
  adapter: cloudflare({ imageService: 'compile' }),
  // ファーストビューとトップページのカードの画像(src/lib/optimizeImages.ts)をビルド時に取得・変換するため、
  // Notionへアップロードした画像の配信元を許可する。ここに無い配信元の画像は変換されず、そのままのURLで表示される
  image: {
    // AVIFの圧縮の手間(effort)を既定の4から3に下げる。実際の画像で変換が約3倍速くなり、
    // ファイルサイズはほぼ同じ(むしろ0.7%小さい)だった。画像はビルドのたびに全部変換し直すため効果が大きい
    service: sharpImageService({ avif: { effort: 3 } }),
    remotePatterns: [
      { protocol: 'https', hostname: 'prod-files-secure.s3.us-west-2.amazonaws.com' },
      { protocol: 'https', hostname: 'prod-files-secure-apne1.s3.ap-northeast-1.amazonaws.com' },
    ],
  },
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
