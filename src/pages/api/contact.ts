import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { notifyDiscord, sendAdminEmail } from '../../lib/notify';
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
function json(body: Record<string, unknown>, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
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

// 改行・タブ以外の制御文字(メールのヘッダーや表示を崩す原因になる)
const CONTROL_CHARS_EXCEPT_NEWLINE = /[\u0000-\u0008\u000B-\u001F\u007F]/g;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
// 判定用(g フラグ付きの正規表現を test() で使うと前回の位置を引き継いでしまうため分ける)
const HAS_CONTROL_CHAR = /[\u0000-\u001F\u007F]/;

/**
 * Discordに定型文で知らせます。未設定・失敗してもお問い合わせの処理は止めません。
 */
async function notifyDiscordSafely(content: string): Promise<void> {
  const webhookUrl = pickEnv('DISCORD_WEBHOOK_URL', import.meta.env.DISCORD_WEBHOOK_URL);
  if (!webhookUrl) return;
  try {
    await notifyDiscord(content, webhookUrl);
  } catch (err) {
    console.error('[api/contact] Discordへの通知に失敗しました:', err);
  }
}

export const POST: APIRoute = async ({ request, locals }) => {
  const requestUrl = new URL(request.url);
  // Discord通知は送信者の待ち時間に含めないよう、レスポンスを返した後に実行する
  const notifyInBackground = (content: string) => locals.cfContext.waitUntil(notifyDiscordSafely(content));
  // ponytail: 送信が遅い原因を調べるための一時的な計測。原因を特定したら削除する
  const timings: string[] = [];
  async function timed<T>(name: string, task: Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      return await task;
    } finally {
      timings.push(`${name};dur=${Date.now() - start}`);
    }
  }
  const timingHeader = () => ({ 'Server-Timing': timings.join(', ') });

  // --- リクエスト自体の検証 ---

  // 他サイトのページから送信させる攻撃(CSRF)を防ぐため、自サイト以外からの送信は拒否する
  if (request.headers.get('Origin') !== requestUrl.origin) {
    return json({ error: 'forbidden' }, 403);
  }
  // Turnstileの検証などの重い処理より前に、連続送信を弾く
  const remoteIp = request.headers.get('CF-Connecting-IP');
  if (await timed('ratelimit', isRateLimited(remoteIp))) {
    return json({ error: 'rate_limited' }, 429, { 'Retry-After': '60' });
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
    const verified = await timed(
      'turnstile',
      verifyTurnstile(turnstileToken, remoteIp, turnstileSecret, requestUrl.hostname)
    );
    if (!verified) {
      return json({ error: 'turnstile_failed' }, 400);
    }
  }

  // --- 通常のバリデーション ---
  const name = asString(body.name).replace(CONTROL_CHARS, '').trim();
  const email = asString(body.email).trim();
  const message = normalizeNewlines(asString(body.message))
    .replace(CONTROL_CHARS_EXCEPT_NEWLINE, '')
    .trim();

  if (!name || !email || !message) {
    return json({ error: 'missing_fields' }, 400);
  }
  if (body.privacyConsent !== true) {
    return json({ error: 'privacy_consent_required' }, 400);
  }
  if (name.length > CONTACT_LIMITS.name) {
    return json({ error: 'name_too_long' }, 400);
  }
  // メールアドレスは Reply-To に使うため、制御文字を含むものは除去せず不正として扱う
  if (email.length > CONTACT_LIMITS.email || HAS_CONTROL_CHAR.test(email) || !isValidEmail(email)) {
    return json({ error: 'invalid_email' }, 400);
  }
  if (message.length > CONTACT_LIMITS.message) {
    return json({ error: 'message_too_long' }, 400);
  }

  // 予備の連絡先(Email Routingで作った転送用アドレス)。公開ページには載せず、
  // Turnstileを通過した送信者にだけ、完了画面・送信失敗時の案内として返す。
  // 迷惑メールが届くようになったら、別のアドレスに差し替えられるようシークレットで管理する
  const fallbackEmail = pickEnv('CONTACT_FALLBACK_EMAIL', import.meta.env.CONTACT_FALLBACK_EMAIL);

  // お問い合わせ内容の保管先は管理者宛メールのみ。メールが送れた場合だけ成功を返す
  // (失敗時はフォームに入力内容が残るため、ユーザーが再送信できる)
  const adminAddress = pickEnv('CONTACT_ADMIN_EMAIL', import.meta.env.CONTACT_ADMIN_EMAIL);
  if (!adminAddress) {
    console.error('[api/contact] CONTACT_ADMIN_EMAIL が設定されていません');
    notifyInBackground('⚠️ お問い合わせを受け付けられません(CONTACT_ADMIN_EMAIL が未設定です)');
    return json({ error: 'server_error', fallbackEmail }, 500);
  }
  try {
    await timed('email', sendAdminEmail({ name, email, message }, env.CONTACT_EMAIL, adminAddress));
  } catch (err) {
    // 詳細はサーバーログにのみ記録し、クライアントやDiscordへは個人情報・内部情報を含めない
    const code = (err as { code?: string }).code ?? 'unknown';
    console.error('[api/contact] 管理者宛メールの送信に失敗しました:', code, err);
    notifyInBackground(`⚠️ お問い合わせメールの送信に失敗しました(エラー: ${code})`);
    return json({ error: 'server_error', fallbackEmail }, 500, timingHeader());
  }

  notifyInBackground('📩 新しいお問い合わせがありました。メールをご確認ください。');
  return json({ ok: true, fallbackEmail }, 200, timingHeader());
};
