import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { minifySync } from 'vite';
import subsetFonts from './scripts/subset-fonts.mjs';

// ソースのコメントは開発用なので、公開するHTMLからは取り除く。バンドルされるJS・CSSはビルド時に消えるため、
// 残るのはHTMLのコメントと、HTMLに直接埋め込まれたスクリプト(is:inlineや小さいため埋め込まれたもの)だけ。
// スクリプトは圧縮(minify)でコメントを消す。compress・mangleを切り、空白とコメント以外は変えない
const stripComments = {
  name: 'strip-comments',
  hooks: {
    'astro:build:done': async ({ dir }) => {
      const root = fileURLToPath(dir);
      const files = (await readdir(root, { recursive: true })).filter((f) => f.endsWith('.html'));
      for (const file of files) {
        const path = join(root, file);
        const html = await readFile(path, 'utf8');
        const out = html.replace(
          /(<script\b([^>]*)>)([\s\S]*?)(<\/script>)|<!--[\s\S]*?-->/g,
          (_, open, attrs, code, close) => {
            if (open === undefined) return '';
            if (!code.trim() || /\stype="(?!module")/.test(attrs)) return open + code + close;
            const { code: min, errors } = minifySync('inline.js', code, { compress: false, mangle: false });
            if (errors.length) throw new Error(`${file}: ${errors[0].message}`);
            return open + min + close;
          },
        );
        await writeFile(path, out);
      }
    },
  },
};

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
    stripComments,
    subsetFonts,
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
