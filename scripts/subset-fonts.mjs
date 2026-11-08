import subsetFont from 'subset-font';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 日本語フォント(Zen Kaku Gothic New)を、サイトで使う文字だけに絞って自前で配信する。
// Google Fontsは文字の範囲ごとに細かく分けて配信し、1ページで60個以上のファイルを読み込む。
// ファイルが届くたびにページ全体のレイアウトを計算し直すため、スマホで表示が遅れていた(#209)。
// 絞った文字に無い文字(フォームへの入力など)は、後ろに続けたGoogle Fontsから読み込まれる
const FAMILY = 'Zen Kaku Gothic New Subset';
// Google Fontsの配信元と同じフォント。コミットを固定し、ビルドごとに見た目が変わらないようにする
const COMMIT = 'ba225958c40ae6268a256861d80355a84b26e535';
const SOURCE = `https://raw.githubusercontent.com/google/fonts/${COMMIT}/ofl/zenkakugothicnew/ZenKakuGothicNew-`;
// BaseLayoutでGoogle Fontsから読み込んでいる太さと同じ
const WEIGHTS = { 400: 'Regular', 500: 'Medium', 700: 'Bold' };
// 元のフォント(1つ約2.3MB)を毎回取得しないよう、ビルドキャッシュに残す。コミットを変えたら取り直す
const CACHE_DIR = `node_modules/.cache/zen-kaku-gothic-new/${COMMIT}`;

async function sourceFont(name) {
  const path = join(CACHE_DIR, `${name}.ttf`);
  try {
    return await readFile(path);
  } catch {}
  // 応答が止まってもビルドが止まらないよう、時間を区切る(普段は数秒で取得できる)
  const res = await fetch(`${SOURCE}${name}.ttf`, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`${res.status} ${res.url}`);
  const font = Buffer.from(await res.arrayBuffer());
  await mkdir(CACHE_DIR, { recursive: true });
  // 書き込みが途中で切れた壊れたファイルを、次のビルドで使わないよう、書き終えてから名前を付ける
  await writeFile(`${path}.tmp`, font);
  await rename(`${path}.tmp`, path);
  return font;
}

export default {
  name: 'subset-fonts',
  hooks: {
    'astro:build:done': async ({ dir, logger }) => {
      const root = fileURLToPath(dir);
      const files = (await readdir(root, { recursive: true })).filter((f) => /\.(html|js|css)$/.test(f));
      const contents = await Promise.all(files.map((f) => readFile(join(root, f), 'utf8')));
      // 画面に出る文字は、HTML・JSが書き出す文字列・CSSの content のどれかに含まれる
      const text = [...new Set(contents.join(''))].join('');

      const hashed = (name, ext, data) => `_astro/${name}.${createHash('sha256').update(data).digest('hex').slice(0, 8)}.${ext}`;
      let css = '';
      try {
        for (const [weight, name] of Object.entries(WEIGHTS)) {
          const font = await subsetFont(await sourceFont(name), text, { targetFormat: 'woff2' });
          const file = hashed(`zen-kaku-${weight}`, 'woff2', font);
          await writeFile(join(root, file), font);
          css += `@font-face{font-family:'${FAMILY}';src:url(/${file}) format('woff2');font-weight:${weight};font-display:swap}`;
        }
      } catch (err) {
        // 作れなくても、Google Fontsだけで今までどおり表示される
        logger.warn(`日本語フォントを作れなかったため、Google Fontsだけで表示します: ${err}`);
        return;
      }
      const cssFile = hashed('zen-kaku', 'css', css);
      await writeFile(join(root, cssFile), css);

      // Google Fontsと同じく、表示を止めないよう後から読み込む。HTMLに直接書くと、フォント(計約530KB)が
      // サイト名の表示より先に最優先で取得され、Lighthouse(スマホ)のLCPの推定が数秒悪くなった。
      // Google FontsのCSSが先に効くと、その分割ファイル(60個以上)を読み始めてしまう(保存済みのGoogle FontsのCSSと、
      // 文字が増えて名前の変わったこのCSSとで起きる)。Google Fontsはこちらが効いてから(失敗しても)有効にする
      const enableGoogleFonts = "document.getElementById('google-fonts').media='all'";
      const link =
        `<link href="/${cssFile}" rel="stylesheet" media="print" onload="this.media='all';${enableGoogleFonts}" onerror="${enableGoogleFonts}">` +
        `<noscript><link href="/${cssFile}" rel="stylesheet"></noscript></head>`;
      for (const [i, f] of files.entries()) {
        if (!f.endsWith('.html')) continue;
        const html = contents[i]
          .replace(/(<link href="https:\/\/fonts\.googleapis\.com\/css2[^"]*" rel="stylesheet" media="print") onload="this\.media='all'"/, '$1 id="google-fonts"')
          .replace('</head>', link);
        await writeFile(join(root, f), html);
      }
    },
  },
};
