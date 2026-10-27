import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isRateLimited, isSameOrigin } from '../../lib/apiGuard';

// このエンドポイントだけは事前ビルド(静的化)せず、Cloudflare上でリクエストごとに実行します。
export const prerender = false;

const COUNTER_KEY = 'top-page-views';

function jsonResponse(count: number, status = 200): Response {
  return new Response(JSON.stringify({ count }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function getCurrentCount(): Promise<number> {
  return Number((await env.COUNTER_KV.get(COUNTER_KEY)) ?? '0');
}

/**
 * 現在の来訪数を、加算せずに取得します。
 * クライアント側でクールダウン中(同じ端末での再読み込み)と判定した場合はこちらを呼びます。
 */
export const GET: APIRoute = async () => {
  return jsonResponse(await getCurrentCount());
};

/**
 * KVに保存した来訪数をインクリメントして返します。
 * KVは書き込みが強整合ではないため、同時アクセスが重なると加算が1件落ちることがありますが、
 * 個人サイトのアクセスカウンターとしては許容範囲のため厳密な排他制御は行いません。
 *
 * 端末ごとの重複防止(24時間)はクライアント側のlocalStorageで行っているだけで、
 * スクリプトから直接叩けば回避できてしまうため、サーバー側でも次の2点を確認します。
 * (連打によるキリ番の操作や、KVの書き込み上限の使い切りを防ぐため)
 */
export const POST: APIRoute = async ({ request }) => {
  // 自サイトのページ以外からの加算は受け付けない
  if (!isSameOrigin(request)) {
    return jsonResponse(0, 403);
  }
  // 同じIPアドレスからの連続した加算は、数えずに現在値だけ返す(上限は wrangler.toml の COUNTER_RATE_LIMITER)
  if (await isRateLimited(env.COUNTER_RATE_LIMITER, request.headers.get('CF-Connecting-IP'), 'api/counter')) {
    return jsonResponse(await getCurrentCount());
  }

  const next = (await getCurrentCount()) + 1;
  await env.COUNTER_KV.put(COUNTER_KEY, String(next));
  return jsonResponse(next);
};
