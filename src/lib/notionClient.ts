import { Client } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

// Workerで動くAPIルート(/api/image)からも読み込むため、このファイルでは import.meta.env の
// 秘密情報(NOTION_TOKEN など)を参照しないこと。参照するとビルド時の値がWorkerのコードに平文で埋め込まれる。

/**
 * Notion SDK のクライアントを生成する共通関数。このプロジェクトでは必ずこれを使うこと。
 *
 * 新しい @notionhq/client は「ブラウザ環境」を検出するとトークン使用を拒否する。
 * Astro のプリレンダーや Cloudflare Workers(workerd)は window 等が存在するためブラウザと
 * 誤判定されるので、dangerouslyAllowBrowser を有効にしている。
 * この関数はサーバー側(ビルド時 / Workers / APIルート)でのみ呼ぶこと。
 * クライアント側の <script> やコンポーネントから import するとトークンが漏洩する。
 */
export function createNotionClient(auth: string): Client {
  return new Client({
    auth,
    fetch: fetch.bind(globalThis),
    dangerouslyAllowBrowser: true,
  });
}

export const IMAGE_KINDS = ['gallery', 'works', 'toolbox', 'novels'] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

// ページの Image(files) プロパティの1枚目
export function imageFile(page: PageObjectResponse) {
  const prop = page.properties.Image;
  return prop?.type === 'files' ? prop.files[0] : undefined;
}

// 画像の取得元の直接のURL。Notionへアップロードした画像(file.type === 'file')は数時間で失効する署名付きURL
export function directImageUrl(page: PageObjectResponse): string | null {
  const file = imageFile(page);
  if (!file) return null;
  return file.type === 'external' ? file.external.url : file.file.url;
}
