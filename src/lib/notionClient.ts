import { Client } from '@notionhq/client';

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
