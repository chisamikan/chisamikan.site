import type { APIRoute } from 'astro';
import { Client, isFullBlock, isFullPage } from '@notionhq/client';
import { pickEnv } from '../../../../lib/env';

// Notionへアップロードした画像のURLは数時間で失効するため、ビルド時に埋め込まず、
// 表示の都度このエンドポイント経由でNotionへ問い合わせて最新URLへ302リダイレクトする。
export const prerender = false;

// Notion側の実際の有効期限(通常1時間=3600秒)より短くしておくことで、
// ブラウザ/CDNに失効済みURLへのリダイレクトがキャッシュされたまま残るのを防ぐ。
const CACHE_SECONDS = 3000;

type Kind = 'gallery' | 'works' | 'profile' | 'toolbox' | 'novels';

function isKind(value: string | undefined): value is Kind {
  return (
    value === 'gallery' ||
    value === 'works' ||
    value === 'profile' ||
    value === 'toolbox' ||
    value === 'novels'
  );
}

// kind === 'profile' はブロック直下のimageのため対象外。他のkindは共通で Image プロパティを使う。
const IMAGE_PROPERTY_NAME: Record<Exclude<Kind, 'profile'>, string> = {
  gallery: 'Image',
  works: 'Image',
  toolbox: 'Image',
  novels: 'Image',
};

export const GET: APIRoute = async ({ params }) => {
  const { kind, id } = params;
  if (!id || !isKind(kind)) {
    return new Response('Not Found', { status: 404 });
  }

  const token = pickEnv('NOTION_TOKEN', import.meta.env.NOTION_TOKEN);
  if (!token) {
    return new Response('Notion is not configured', { status: 500 });
  }

  const notion = new Client({ auth: token, fetch: fetch.bind(globalThis) });

  try {
    let url: string | null = null;

    if (kind === 'profile') {
      const block = await notion.blocks.retrieve({ block_id: id });
      if (isFullBlock(block) && block.type === 'image') {
        const img = block.image;
        url = img.type === 'external' ? img.external.url : img.file.url;
      }
    } else {
      const page = await notion.pages.retrieve({ page_id: id });
      if (isFullPage(page)) {
        const prop = page.properties[IMAGE_PROPERTY_NAME[kind]];
        if (prop?.type === 'files' && prop.files.length > 0) {
          const file = prop.files[0];
          url = file.type === 'external' ? file.external.url : file.file.url;
        }
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
