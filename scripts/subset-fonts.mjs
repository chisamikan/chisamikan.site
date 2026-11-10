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
// 作り直さない部分のフォントに入れる文字の一覧
const BASE_CHARS = new URL('./font-base-chars.txt', import.meta.url);
// 追加分がこれを超えたら、一覧を作り直すよう知らせる(1文字あたり3つの太さで計約0.4KB。200文字で約80KB)
const EXTRA_LIMIT = 200;

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
      const used = new Set(contents.join(''));
      // 使う文字をそのまま1つのフォントにすると、Notionの更新(2〜3日に1回)で文字が1つ増えるたびに作り直され、
      // 再訪問した人も約530KBを読み直すことになる。固定した文字の一覧で作るフォント(作り直されない)と、
      // 一覧に無い文字だけの小さな追加分に分ける。一覧が無ければ今の文字で作る(作り直すときは npm run refresh-font-chars のあとコミット)
      let base;
      try {
        base = await readFile(BASE_CHARS, 'utf8');
      } catch {
        base = [...used].join('');
        await writeFile(BASE_CHARS, base);
      }
      const baseSet = new Set(base);
      const extra = [...used].filter((c) => !baseSet.has(c));
      if (extra.length > EXTRA_LIMIT) {
        logger.warn(`日本語フォントの追加分が${extra.length}文字になりました。npm run refresh-font-chars を実行し、${fileURLToPath(BASE_CHARS)} をコミットしてください`);
      }

      const hashed = (name, ext, data) => `_astro/${name}.${createHash('sha256').update(data).digest('hex').slice(0, 8)}.${ext}`;
      const fontFace = async (name, weight, source, chars, unicodeRange = '') => {
        const font = await subsetFont(source, chars, { targetFormat: 'woff2' });
        const file = hashed(name, 'woff2', font);
        await writeFile(join(root, file), font);
        return `@font-face{font-family:'${FAMILY}';src:url(/${file}) format('woff2');font-weight:${weight};font-display:swap${unicodeRange}}`;
      };
      let css = '';
      try {
        for (const [weight, name] of Object.entries(WEIGHTS)) {
          const source = await sourceFont(name);
          css += await fontFace(`zen-kaku-${weight}`, weight, source, base);
          // 追加分は、その文字を使うページでだけ読み込まれるよう unicode-range で範囲を絞る
          if (extra.length) {
            const range = `;unicode-range:${extra.map((c) => `U+${c.codePointAt(0).toString(16)}`).join(',')}`;
            css += await fontFace(`zen-kaku-extra-${weight}`, weight, source, extra.join(''), range);
          }
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
      // Google Fontsの日本語フォントは、こちらのフォントが届いてから(失敗したらすぐ)有効にし、英字用とは分けて読み込む。
      // 先に効くと、その分割ファイル(60個以上)を読み始めてしまう(保存済みのGoogle FontsのCSSと、文字が増えて名前の変わった
      // このCSSとで起きる)。また、こちらのフォントが届く前に効いていると、代わりの文字を探すたびに分割ファイルの指定
      // (太さ3種類で数百件)をたどるため、最初のレイアウトが重くなる(スマホ想定のCPU 4倍遅延で約0.8秒→約0.15秒)。
      // フォントの読み込みはレイアウトで始まるため、次の描画を待ってから document.fonts.ready を見る(PageLoaderと同じ)
      const googleFontsJa = `https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@${Object.keys(WEIGHTS).join(';')}&display=swap`;
      const enableJa = "document.getElementById('google-fonts-ja').media='all'";
      const link =
        `<link id="google-fonts-ja" href="${googleFontsJa}" rel="stylesheet" media="print">` +
        `<link href="/${cssFile}" rel="stylesheet" media="print" onload="this.media='all';requestAnimationFrame(()=>setTimeout(()=>document.fonts.ready.then(()=>${enableJa})))" onerror="${enableJa}">` +
        `<noscript><link href="/${cssFile}" rel="stylesheet"></noscript></head>`;
      for (const [i, f] of files.entries()) {
        if (!f.endsWith('.html')) continue;
        const html = contents[i]
          .replace(/(<link href="https:\/\/fonts\.googleapis\.com\/css2[^"]*?)&family=Zen\+Kaku\+Gothic\+New[^&"]*([^"]*" rel="stylesheet" media="print" onload)/, '$1$2')
          .replace('</head>', link);
        await writeFile(join(root, f), html);
      }
    },
  },
};
