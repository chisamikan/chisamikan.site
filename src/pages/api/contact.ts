import type { APIRoute } from 'astro';
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
 * 対応する環境変数が未設定の通知はスキップし、1件失敗しても他は続行してログに記録します。
 *
 * お問い合わせ内容の保存先は通知のみのため、「1件も送信できなかった場合」は
 * 呼び出し元でエラーとして扱えるよう、設定済みの通知先の数と成功数を返します。
 */
async function sendNotifications(payload: {
  name: string;
  email: string;
  message: string;
}): Promise<{ attempted: number; succeeded: number }> {
  const discordWebhookUrl = pickEnv('DISCORD_WEBHOOK_URL', import.meta.env.DISCORD_WEBHOOK_URL);
  // 管理者宛通知用のZap(Catch Hook → Outlookで自分宛に送信)
  const zapierAdminWebhookUrl = pickEnv(
    'ZAPIER_ADMIN_WEBHOOK_URL',
    import.meta.env.ZAPIER_ADMIN_WEBHOOK_URL
  );
  // 自動返信用のZap(Catch Hook → Outlookで問い合わせ者宛に送信)
  const zapierAutoreplyWebhookUrl = pickEnv(
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
  let succeeded = 0;
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[api/contact] 通知の送信に失敗しました:', result.reason);
    } else {
      succeeded++;
    }
  }
  return { attempted: tasks.length, succeeded };
}

export const POST: APIRoute = async ({ request }) => {
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
  const turnstileSecret = pickEnv('TURNSTILE_SECRET_KEY', import.meta.env.TURNSTILE_SECRET_KEY);
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
    const { attempted, succeeded } = await sendNotifications({ name, email, message });

    // 保存先が通知のみなので、通知先が未設定、または全て失敗した場合は成功扱いにしない
    // (成功を返すとお問い合わせ内容がどこにも残らず失われるため)
    if (attempted === 0 || succeeded === 0) {
      console.error('[api/contact] お問い合わせを届けられませんでした:', { attempted, succeeded });
      return new Response(JSON.stringify({ error: 'server_error' }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // 詳細はサーバーログにのみ記録し、クライアントへは内部情報を含めない
    console.error('[api/contact] 送信処理に失敗しました:', err);
    return new Response(JSON.stringify({ error: 'server_error' }), { status: 500 });
  }
};
