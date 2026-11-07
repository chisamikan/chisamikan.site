import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

// サイト全体は静的生成(SSG)し、/api/* のみ各ページ側で `export const prerender = false` を
// 指定することで Cloudflare Workers 上のサーバー処理として動かします。
export default defineConfig({
  site: 'https://chisamikan.site',
  adapter: cloudflare({ imageService: 'compile' }),
  // ファーストビューとトップページのカードの画像(src/lib/optimizeImages.ts)をビルド時に取得・変換するため、
  // Notionへアップロードした画像とBOOTHの商品画像の配信元を許可する。ここに無い配信元の画像は変換されず、そのままのURLで表示される
  image: {
    service: {
      // ビルド時はsharpで変換する(変換結果の見分け方だけ変えている。src/lib/imageService.ts 参照)。
      // 実行時(Workers)はsharpが動かないため、アダプターの既定と同じ変換しないサービスを使う。
      // AVIFの圧縮の手間(effort)は既定の4から3に下げる。実際の画像で変換が約3倍速くなり、
      // ファイルサイズはほぼ同じ(むしろ0.7%小さい)だった。新しい画像やビルドキャッシュが消えたときに効く
      build: { entrypoint: './src/lib/imageService.ts', config: { avif: { effort: 3 } } },
      runtime: { entrypoint: '@astrojs/cloudflare/image-service-workerd' },
    },
    remotePatterns: [
      { protocol: 'https', hostname: 'prod-files-secure.s3.us-west-2.amazonaws.com' },
      { protocol: 'https', hostname: 'prod-files-secure-apne1.s3.ap-northeast-1.amazonaws.com' },
      { protocol: 'https', hostname: 'booth.pximg.net' },
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
