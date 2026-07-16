import type { APIContext, APIRoute } from 'astro';
import { createContactEntry } from '../../lib/notion';

// このエンドポイントだけは事前ビルド(静的化)せず、Cloudflare上でリクエストごとに実行します。
export const prerender = false;

// フォーム表示からこの時間(ミリ秒)未満での送信はボットとみなす
const MIN_SUBMIT_MS = 3000;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Cloudflareのランタイム環境(Astro.locals.runtime.env)から値を取得します。
 * ビルド時とリクエスト実行時で参照できる環境変数の設定先がCloudflare側で異なる場合があるため、
 * ランタイム値を優先しつつ、無ければビルド時の import.meta.env にフォールバックします。
 */
function getEnvValue(locals: APIContext['locals'], key: string): string | undefined {
  const runtimeEnv = (locals as { runtime?: { env?: Record<string, string> } })?.runtime?.env;
  return runtimeEnv?.[key] || (import.meta.env as unknown as Record<string, string>)[key];
}

/**
 * Cloudflare Turnstileのトークンをサーバー側で検証します。
 * secretが未設定の場合は検証をスキップします(未導入でも動作するように)。
 */
async function verifyTurnstile(
  token: string,
  remoteIp: string | null,
  secret: string | undefined
): Promise<boolean> {
  if (!secret) return true;

  const form = new URLSearchParams();
  form.set('secret', secret);
  form.set('response', token);
  if (remoteIp) form.set('remoteip', remoteIp);

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const data = (await res.json()) as { success: boolean };
    return data.success === true;
  } catch (err) {
    console.error('[api/contact] Turnstileの検証に失敗しました:', err);
    return false;
  }
}

export const POST: APIRoute = async ({ request, locals }) => {
  let body: {
    name?: string;
    email?: string;
    message?: string;
    company?: string;
    loadedAt?: string;
    turnstileToken?: string;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400 });
  }

  // --- スパム対策(いずれもボット判定時は偽の成功レスポンスを返し、それ以上処理しない) ---

  // 1. ハニーポット: 人には見えない項目が埋まっていたらボット
  if (body.company) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. タイムトラップ: フォーム表示から間もない送信、またはJS未実行(値が無い)はボット
  const loadedAt = Number(body.loadedAt);
  if (!loadedAt || Date.now() - loadedAt < MIN_SUBMIT_MS) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 3. Cloudflare Turnstile(secretが設定されている場合のみ検証)
  const turnstileSecret = getEnvValue(locals, 'TURNSTILE_SECRET_KEY');
  if (turnstileSecret) {
    if (!body.turnstileToken) {
      return new Response(JSON.stringify({ error: 'turnstile_missing' }), { status: 400 });
    }
    const remoteIp = request.headers.get('CF-Connecting-IP');
    const verified = await verifyTurnstile(body.turnstileToken, remoteIp, turnstileSecret);
    if (!verified) {
      return new Response(JSON.stringify({ error: 'turnstile_failed' }), { status: 400 });
    }
  }

  // --- 通常のバリデーション ---
  const name = (body.name ?? '').trim();
  const email = (body.email ?? '').trim();
  const message = (body.message ?? '').trim();

  if (!name || !email || !message) {
    return new Response(JSON.stringify({ error: 'missing_fields' }), { status: 400 });
  }
  if (!isValidEmail(email)) {
    return new Response(JSON.stringify({ error: 'invalid_email' }), { status: 400 });
  }
  if (message.length > 5000) {
    return new Response(JSON.stringify({ error: 'message_too_long' }), { status: 400 });
  }

  try {
    await createContactEntry(
      { name, email, message },
      {
        NOTION_TOKEN: getEnvValue(locals, 'NOTION_TOKEN'),
        NOTION_CONTACT_DB_ID: getEnvValue(locals, 'NOTION_CONTACT_DB_ID'),
      }
    );
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // 実際の原因(トークン未設定/DB未共有/プロパティ名不一致など)を調査しやすいよう、
    // レスポンスボディにも詳細を含める(ブラウザの開発者ツール > Network タブで確認可能)。
    // 原因が判明し安定稼働したら、この detail は削除して問題ありません。
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[api/contact] Notionへの書き込みに失敗しました:', detail);
    return new Response(JSON.stringify({ error: 'server_error', detail }), { status: 500 });
  }
};
