// src 内で使われている Font Awesome のアイコン(<i class="fa-solid fa-xmark"> など)だけを、
// SVGをマスクにしたCSS(src/styles/icons.css)として書き出す。Font Awesome のCSSとWebフォント
// (計約270KB)を読み込まず、フォントの読み込み完了時にアイコンが切り替わるカクつきも無くすため。
// npm run dev / build の前に自動で実行される(package.json の predev / prebuild)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as solid from '@fortawesome/free-solid-svg-icons';
import * as regular from '@fortawesome/free-regular-svg-icons';
import * as brands from '@fortawesome/free-brands-svg-icons';

const SRC = 'src';
const OUT = 'src/styles/icons.css';
const STYLES = { solid, regular, brands };

// アイコン名(fa-xmark の xmark)から定義を引く。各パッケージは faXmark のような名前で書き出している
const find = (style, name) => STYLES[style]['fa' + name.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())];

// 「fa-solid fa-xmark」のように並んでいれば、その種類で使う。種類と名前が離れて書かれている箇所
// (SectionHeading の条件分岐など)は、solid → brands の順で見つかったものを使う
const files = readdirSync(SRC, { recursive: true }).filter((file) => /\.(astro|ts|js|mjs)$/.test(file));
const text = files.map((file) => readFileSync(join(SRC, file), 'utf8')).join('\n');
const used = new Set();
const paired = new Set();
for (const [, style, name] of text.matchAll(/fa-(solid|regular|brands)\s+fa-([a-z0-9-]+)/g)) {
  used.add(`${style}:${name}`);
  paired.add(name);
}
for (const [, name] of text.matchAll(/\bfa-([a-z0-9-]+)/g)) {
  if (paired.has(name)) continue;
  const style = ['solid', 'brands'].find((s) => find(s, name));
  if (style) used.add(`${style}:${name}`);
}

const toDataUri = ([width, height, , , path]) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width} ${height}'><path d='${path}'/></svg>`,
  )}")`;

const rules = [...used].sort().map((key) => {
  const [style, name] = key.split(':');
  const def = find(style, name);
  if (!def) throw new Error(`[build-icons] アイコンが見つかりません: fa-${style} fa-${name}`);
  return `.fa-${style}.fa-${name} { --fa-icon: ${toDataUri(def.icon)}; }`;
});

writeFileSync(
  OUT,
  `/* scripts/build-icons.mjs が自動生成するファイル。直接編集しないこと
   アイコン: Font Awesome Free 7.3.1 (https://fontawesome.com) / CC BY 4.0 */

/* Font Awesome 7 のWebフォント版と同じ大きさ(幅1.25em・高さ1em)と位置に揃える */
.fa-solid,
.fa-regular,
.fa-brands {
  display: inline-block;
  width: 1.25em;
  height: 1em;
  line-height: 1;
  background-color: currentColor;
  mask: var(--fa-icon) center / contain no-repeat;
}

/* 中身の無い要素は、文字と並べたときに下端が文字のベースラインに揃ってしまう(flexのitems-baselineでも同様)。
   幅の無い文字を入れて、Webフォント版と同じく文字のベースラインを持たせる */
.fa-solid::before,
.fa-regular::before,
.fa-brands::before {
  content: '\\200b';
}

.fa-spin {
  animation: fa-spin 2s linear infinite;
}

@keyframes fa-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .fa-spin {
    animation: none;
  }
}

${rules.join('\n')}
`,
);
console.log(`[build-icons] ${rules.length}個のアイコンを ${OUT} に書き出しました`);
