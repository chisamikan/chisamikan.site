import type { APIRoute } from 'astro';
import { isFullPage } from '@notionhq/client';
import { createNotionClient, IMAGE_KINDS, type ImageKind } from '../../../../lib/notion';
import { pickEnv } from '../../../../lib/env';

// Notionへアップロードした画像のURLは数時間で失効するため、ビルド時に埋め込まず、
// 表示の都度このエンドポイント経由でNotionへ問い合わせて最新URLへ302リダイレクトする。
export const prerender = false;

// Notion側の実際の有効期限(通常1時間=3600秒)より短くしておくことで、
// ブラウザ/CDNに失効済みURLへのリダイレクトがキャッシュされたまま残るのを防ぐ。
const CACHE_SECONDS = 3000;

export const GET: APIRoute = async ({ params }) => {
  const { kind, id } = params;
  if (!id || !IMAGE_KINDS.includes(kind as ImageKind)) {
    return new Response('Not Found', { status: 404 });
  }

  const token = pickEnv('NOTION_TOKEN', import.meta.env.NOTION_TOKEN);
  if (!token) {
    return new Response('Notion is not configured', { status: 500 });
  }

  const notion = createNotionClient(token);

  try {
    let url: string | null = null;

    const page = await notion.pages.retrieve({ page_id: id });
    if (isFullPage(page)) {
      const prop = page.properties.Image;
      if (prop?.type === 'files' && prop.files.length > 0) {
        const file = prop.files[0];
        url = file.type === 'external' ? file.external.url : file.file.url;
      }
    }

    if (!url) {
      return new Response('Image Not Found', { status: 404 });
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: url,
        'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
      },
    });
  } catch (err) {
    console.error('[api/image] Notionからの画像取得に失敗しました:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
};
