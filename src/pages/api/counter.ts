import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

// このエンドポイントだけは事前ビルド(静的化)せず、Cloudflare上でリクエストごとに実行します。
export const prerender = false;

const COUNTER_KEY = 'top-page-views';

function jsonResponse(count: number): Response {
  return new Response(JSON.stringify({ count }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/**
 * 現在の来訪数を、加算せずに取得します。
 * クライアント側でクールダウン中(同じ端末での再読み込み)と判定した場合はこちらを呼びます。
 */
export const GET: APIRoute = async () => {
  const current = Number((await env.COUNTER_KV.get(COUNTER_KEY)) ?? '0');
  return jsonResponse(current);
};

/**
 * KVに保存した来訪数をインクリメントして返します。
 * KVは書き込みが強整合ではないため、同時アクセスが重なると加算が1件落ちることがありますが、
 * 個人サイトのアクセスカウンターとしては許容範囲のため厳密な排他制御は行いません。
 */
export const POST: APIRoute = async () => {
  const current = Number((await env.COUNTER_KV.get(COUNTER_KEY)) ?? '0');
  const next = current + 1;
  await env.COUNTER_KV.put(COUNTER_KEY, String(next));
  return jsonResponse(next);
};
