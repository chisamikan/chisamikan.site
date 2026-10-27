import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { APIErrorCode, isFullPage, isNotionClientError } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { createNotionClient, IMAGE_KINDS, type ImageKind } from '../../../../lib/notionClient';
import { runtimeEnv } from '../../../../lib/env';
import { isRateLimited } from '../../../../lib/apiGuard';

// Notionへアップロードした画像のURLは数時間で失効するため、ビルド時に埋め込まず、
// 表示の都度このエンドポイント経由でNotionへ問い合わせて最新URLへ302リダイレクトする。
export const prerender = false;

// Notion側の実際の有効期限(通常1時間=3600秒)より短くしておくことで、
// ブラウザ/CDNに失効済みURLへのリダイレクトがキャッシュされたまま残るのを防ぐ。
const CACHE_SECONDS = 3000;

// NotionのページID(UUID。ハイフンの有無はどちらも受け付ける)
const PAGE_ID_PATTERN = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

// 種類ごとの取得元データベースと、公開(Published)のページに限るか。
// 指定の種類のデータベースに属し、サイトに載せているページの画像だけを返す
// (インテグレーションが読める他のページの画像まで取り出せないようにするため)。
// データベースIDは秘密情報ではないため、ビルド時の値を埋め込んでよい
const IMAGE_SOURCES: Record<ImageKind, { databaseId: string | undefined; publishedOnly: boolean }> = {
  gallery: { databaseId: import.meta.env.NOTION_GALLERY_DB_ID, publishedOnly: true },
  works: { databaseId: import.meta.env.NOTION_WORKS_DB_ID, publishedOnly: true },
  toolbox: { databaseId: import.meta.env.NOTION_TOOLBOX_DB_ID, publishedOnly: false },
  novels: { databaseId: import.meta.env.NOTION_NOVELS_DB_ID, publishedOnly: false },
};

function notFound(): Response {
  return new Response('Not Found', { status: 404 });
}

// IDの表記ゆれ(ハイフンの有無・大文字小文字)を揃えて比較する
function normalizeId(id: string): string {
  return id.replaceAll('-', '').toLowerCase();
}

function isListedPage(page: PageObjectResponse, kind: ImageKind): boolean {
  const { databaseId, publishedOnly } = IMAGE_SOURCES[kind];
  const { parent } = page;
  if (!databaseId || (parent.type !== 'data_source_id' && parent.type !== 'database_id')) return false;
  if (normalizeId(parent.database_id) !== normalizeId(databaseId)) return false;
  if (page.in_trash) return false;
  if (!publishedOnly) return true;
  const published = page.properties.Published;
  return published?.type === 'checkbox' && published.checkbox;
}

function imageUrlOf(page: PageObjectResponse): string | null {
  const prop = page.properties.Image;
  if (prop?.type !== 'files' || prop.files.length === 0) return null;
  const file = prop.files[0];
  return file.type === 'external' ? file.external.url : file.file.url;
}

export const GET: APIRoute = async ({ params, request, locals }) => {
  const { kind, id } = params;
  if (!id || !PAGE_ID_PATTERN.test(id) || !IMAGE_KINDS.includes(kind as ImageKind)) {
    return notFound();
  }

  // 同じ画像へのアクセスはCloudflareの拠点ごとのキャッシュから返し、Notionへの問い合わせを減らす
  // (クエリ文字列を変えてキャッシュをすり抜けられないよう、キーはパスだけにする)
  const requestUrl = new URL(request.url);
  const cacheKey = new Request(`${requestUrl.origin}${requestUrl.pathname}`);
  const cache = await caches.open('api-image');
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  // キャッシュに無い場合だけNotionへ問い合わせるため、ここで連続アクセスを弾く
  // (NotionのAPI制限を使い切られると、正規の訪問者にも画像が表示されなくなるため)
  if (await isRateLimited(env.IMAGE_RATE_LIMITER, request.headers.get('CF-Connecting-IP'), 'api/image')) {
    return new Response('Too Many Requests', { status: 429, headers: { 'Retry-After': '10' } });
  }

  const token = runtimeEnv('NOTION_TOKEN');
  if (!token) {
    console.error('[api/image] NOTION_TOKEN が設定されていません');
    return new Response('Notion is not configured', { status: 500 });
  }

  const notion = createNotionClient(token);

  try {
    const page = await notion.pages.retrieve({ page_id: id });
    const url = isFullPage(page) && isListedPage(page, kind as ImageKind) ? imageUrlOf(page) : null;
    if (!url) {
      return notFound();
    }

    const response = new Response(null, {
      status: 302,
      headers: {
        Location: url,
        'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
      },
    });
    locals.cfContext.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (err) {
    // 存在しない・インテグレーションに共有されていないページは404にする
    if (isNotionClientError(err) && err.code === APIErrorCode.ObjectNotFound) {
      return notFound();
    }
    console.error('[api/image] Notionからの画像取得に失敗しました:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
};
