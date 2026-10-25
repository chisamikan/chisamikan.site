import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { notifyDiscord, notifyZapier } from '../../lib/notify';
import { pickEnv } from '../../lib/env';
import { CONTACT_LIMITS, normalizeNewlines } from '../../lib/contactLimits';

// このエンドポイントだけは事前ビルド(静的化)せず、Cloudflare上でリクエストごとに実行します。
export const prerender = false;

// フォーム表示からこの時間(ミリ秒)未満での送信はボットとみなす
const MIN_SUBMIT_MS = 3000;

// リクエスト本文の上限(バイト)。本文5000文字(全角でも約15KB)に余裕を持たせた値
const MAX_BODY_BYTES = 32 * 1024;

/**
 * JSONレスポンスを返します。お問い合わせの結果はキャッシュさせないため no-store を付けます。
 */
function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// 文字列以外(数値・配列・オブジェクト等)が送られてきた場合は未入力として扱う
function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * 同じIPアドレスからの短時間の連続送信を制限します(上限は wrangler.toml の CONTACT_RATE_LIMITER)。
 * レート制限の仕組み自体が失敗した場合は、お問い合わせを取りこぼさないよう通過させます。
 */
async function isRateLimited(ip: string | null): Promise<boolean> {
  try {
    const { success } = await env.CONTACT_RATE_LIMITER.limit({ key: ip ?? 'unknown' });
    return !success;
  } catch (err) {
    console.error('[api/contact] レート制限の確認に失敗しました:', err);
    return false;
  }
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Cloudflare Turnstileのトークンをサーバー側で検証します。
 * 本番では、トークンが自サイト(expectedHostname)で発行されたものかも確認します。
 */
async function verifyTurnstile(
  token: string,
  remoteIp: string | null,
  secret: string,
  expectedHostname: string
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
    const data = (await res.json()) as { success: boolean; hostname?: string };
    if (data.success !== true) return false;
    // ローカル開発ではテスト用キーの hostname が自サイトと一致しないため確認しない
    if (!import.meta.env.DEV && data.hostname !== expectedHostname) {
      console.error('[api/contact] Turnstileのhostnameが一致しません:', data.hostname);
      return false;
    }
    return true;
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
  const requestUrl = new URL(request.url);

  // --- リクエスト自体の検証 ---

  // 他サイトのページから送信させる攻撃(CSRF)を防ぐため、自サイト以外からの送信は拒否する
  if (request.headers.get('Origin') !== requestUrl.origin) {
    return json({ error: 'forbidden' }, 403);
  }
  // Turnstileの検証などの重い処理より前に、連続送信を弾く
  const remoteIp = request.headers.get('CF-Connecting-IP');
  if (await isRateLimited(remoteIp)) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Retry-After': '60',
      },
    });
  }
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) {
    return json({ error: 'unsupported_media_type' }, 415);
  }
  // Content-Lengthは省略・詐称できるため、実際に読み込んだ本文の大きさでも確認する
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES) {
    return json({ error: 'payload_too_large' }, 413);
  }
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
    return json({ error: 'payload_too_large' }, 413);
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return json({ error: 'invalid_json' }, 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  // --- スパム対策(いずれもボット判定時は偽の成功レスポンスを返し、それ以上処理しない) ---

  // 1. ハニーポット: 人には見えない項目が埋まっていたらボット
  if (body.company) {
    return json({ ok: true });
  }

  // 2. タイムトラップ: フォーム表示から間もない送信、またはJS未実行(値が無い)はボット
  const loadedAt = Number(body.loadedAt);
  if (!loadedAt || Date.now() - loadedAt < MIN_SUBMIT_MS) {
    return json({ ok: true });
  }

  // 3. Cloudflare Turnstile
  // 本番でsecretが未設定の場合は、検証が素通りにならないようエラーにする(設定漏れに気づけるように)。
  // ローカル開発時のみ、secret未設定なら検証をスキップする。
  const turnstileSecret = pickEnv('TURNSTILE_SECRET_KEY', import.meta.env.TURNSTILE_SECRET_KEY);
  if (!turnstileSecret && !import.meta.env.DEV) {
    console.error('[api/contact] TURNSTILE_SECRET_KEY が設定されていません');
    return json({ error: 'server_error' }, 500);
  }
  if (turnstileSecret) {
    const turnstileToken = asString(body.turnstileToken);
    if (!turnstileToken) {
      return json({ error: 'turnstile_missing' }, 400);
    }
    const verified = await verifyTurnstile(
      turnstileToken,
      remoteIp,
      turnstileSecret,
      requestUrl.hostname
    );
    if (!verified) {
      return json({ error: 'turnstile_failed' }, 400);
    }
  }

  // --- 通常のバリデーション ---
  const name = asString(body.name).trim();
  const email = asString(body.email).trim();
  const message = normalizeNewlines(asString(body.message)).trim();

  if (!name || !email || !message) {
    return json({ error: 'missing_fields' }, 400);
  }
  if (body.privacyConsent !== true) {
    return json({ error: 'privacy_consent_required' }, 400);
  }
  if (name.length > CONTACT_LIMITS.name) {
    return json({ error: 'name_too_long' }, 400);
  }
  if (email.length > CONTACT_LIMITS.email || !isValidEmail(email)) {
    return json({ error: 'invalid_email' }, 400);
  }
  if (message.length > CONTACT_LIMITS.message) {
    return json({ error: 'message_too_long' }, 400);
  }

  try {
    const { attempted, succeeded } = await sendNotifications({ name, email, message });

    // 保存先が通知のみなので、通知先が未設定、または全て失敗した場合は成功扱いにしない
    // (成功を返すとお問い合わせ内容がどこにも残らず失われるため)
    if (attempted === 0 || succeeded === 0) {
      console.error('[api/contact] お問い合わせを届けられませんでした:', { attempted, succeeded });
      return json({ error: 'server_error' }, 500);
    }

    return json({ ok: true });
  } catch (err) {
    // 詳細はサーバーログにのみ記録し、クライアントへは内部情報を含めない
    console.error('[api/contact] 送信処理に失敗しました:', err);
    return json({ error: 'server_error' }, 500);
  }
};
