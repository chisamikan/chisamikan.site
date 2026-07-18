import type { APIRoute } from 'astro';
import { Client, isFullBlock, isFullPage } from '@notionhq/client';
import { pickEnv } from '../../../../lib/env';

// Notionへ独自にアップロードした画像のURLは署名付きで数時間程度で失効するため、
// ビルド時(SSG)に埋め込まず、表示の都度このエンドポイント経由でNotionへ問い合わせて
// 最新のURLへ302リダイレクトする。そのためこのルートだけは事前ビルドせず、
// Cloudflare上でリクエストごとに実行する。
export const prerender = false;

// Notion側の実際の有効期限(通常1時間=3600秒)より短くしておくことで、
// ブラウザ/CDNに失効済みURLへのリダイレクトがキャッシュされたまま残るのを防ぐ。
const CACHE_SECONDS = 3000;

type Kind = 'gallery' | 'works' | 'profile';

function isKind(value: string | undefined): value is Kind {
  return value === 'gallery' || value === 'works' || value === 'profile';
}

export const GET: APIRoute = async ({ params, locals }) => {
  const { kind, id } = params;
  if (!id || !isKind(kind)) {
    return new Response('Not Found', { status: 404 });
  }

  const token = pickEnv(locals, 'NOTION_TOKEN', import.meta.env.NOTION_TOKEN);
  if (!token) {
    return new Response('Notion is not configured', { status: 500 });
  }

  const notion = new Client({ auth: token });

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
        const prop = page.properties.Image;
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
