import type { APIRoute } from 'astro';
import { createContactEntry } from '../../lib/notion';

// このエンドポイントだけは事前ビルド(静的化)せず、Cloudflare Pages Functions として
// リクエストごとに実行します。
export const prerender = false;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export const POST: APIRoute = async ({ request }) => {
  let body: { name?: string; email?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400 });
  }

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
    await createContactEntry({ name, email, message });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[api/contact] Notionへの書き込みに失敗しました:', err);
    return new Response(JSON.stringify({ error: 'server_error' }), { status: 500 });
  }
};
