import type { APIContext, APIRoute } from 'astro';
import { createContactEntry } from '../../lib/notion';
import { notifyDiscord, notifyZapier } from '../../lib/notify';
import { pickEnv } from '../../lib/env';

// このエンドポイントだけは事前ビルド(静的化)せず、Cloudflare上でリクエストごとに実行します。
export const prerender = false;

// フォーム表示からこの時間(ミリ秒)未満での送信はボットとみなす
const MIN_SUBMIT_MS = 3000;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Cloudflare Turnstileのトークンをサーバー側で検証します。
 * secretが未設定の場合は検証をスキップします(未導入でも動作するように)。
 */
async function verifyTurnstile(
  token: string,
  remoteIp: string | null,
  secret: string
): Promise<boolean> {
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

/**
 * Discord通知 / Zapier経由の管理者宛通知・送信者への自動返信をまとめて行います。
 * 対応する環境変数が未設定の通知はスキップし、1件失敗しても他は続行してログのみに記録します。
 */
async function sendNotifications(
  payload: { name: string; email: string; message: string },
  locals: APIContext['locals']
): Promise<void> {
  const discordWebhookUrl = pickEnv(
    locals,
    'DISCORD_WEBHOOK_URL',
    import.meta.env.DISCORD_WEBHOOK_URL
  );
  // 管理者宛通知用のZap(Catch Hook → Outlookで自分宛に送信)
  const zapierAdminWebhookUrl = pickEnv(
    locals,
    'ZAPIER_ADMIN_WEBHOOK_URL',
    import.meta.env.ZAPIER_ADMIN_WEBHOOK_URL
  );
  // 自動返信用のZap(Catch Hook → Outlookで問い合わせ者宛に送信)
  const zapierAutoreplyWebhookUrl = pickEnv(
    locals,
    'ZAPIER_AUTOREPLY_WEBHOOK_URL',
    import.meta.env.ZAPIER_AUTOREPLY_WEBHOOK_URL
  );

  const tasks: Promise<void>[] = [];

  if (discordWebhookUrl) {
    tasks.push(notifyDiscord(payload, discordWebhookUrl));
  }
  if (zapierAdminWebhookUrl) {
    tasks.push(notifyZapier(payload, zapierAdminWebhookUrl));
  }
  if (zapierAutoreplyWebhookUrl) {
    tasks.push(notifyZapier(payload, zapierAutoreplyWebhookUrl));
  }

  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[api/contact] 通知の送信に失敗しました:', result.reason);
    }
  }
}

export const POST: APIRoute = async ({ request, locals }) => {
  let body: {
    name?: string;
    email?: string;
    message?: string;
    company?: string;
    privacyConsent?: boolean;
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
  const turnstileSecret = pickEnv(
    locals,
    'TURNSTILE_SECRET_KEY',
    import.meta.env.TURNSTILE_SECRET_KEY
  );
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
  if (!body.privacyConsent) {
    return new Response(JSON.stringify({ error: 'privacy_consent_required' }), { status: 400 });
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
        NOTION_TOKEN: pickEnv(locals, 'NOTION_TOKEN', import.meta.env.NOTION_TOKEN),
        NOTION_CONTACT_DB_ID: pickEnv(
          locals,
          'NOTION_CONTACT_DB_ID',
          import.meta.env.NOTION_CONTACT_DB_ID
        ),
      }
    );

    // 通知はベストエフォート: Notionへの保存は既に成功しているため、
    // ここで失敗してもユーザーへは成功として返し、ログにのみ記録する。
    await sendNotifications({ name, email, message }, locals);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // 実際の原因(トークン未設定/DB未共有/プロパティ名不一致など)はサーバーログにのみ記録し、
    // クライアントへは詳細を含めない(スタックトレース等の内部情報を露出させないため)。
    const detail = err instanceof Error ? err.message : String(err);
    const runtimeEnv = (locals as { runtime?: { env?: Record<string, string> } })?.runtime?.env;
    const diagnostics = {
      hasLocalsRuntime: Boolean((locals as { runtime?: unknown })?.runtime),
      hasRuntimeEnv: Boolean(runtimeEnv),
      runtimeHasNotionToken: Boolean(runtimeEnv?.NOTION_TOKEN),
      runtimeHasContactDbId: Boolean(runtimeEnv?.NOTION_CONTACT_DB_ID),
      buildTimeHasNotionToken: Boolean(import.meta.env.NOTION_TOKEN),
      buildTimeHasContactDbId: Boolean(import.meta.env.NOTION_CONTACT_DB_ID),
    };
    console.error('[api/contact] Notionへの書き込みに失敗しました:', detail, diagnostics);
    return new Response(JSON.stringify({ error: 'server_error' }), {
      status: 500,
    });
  }
};
