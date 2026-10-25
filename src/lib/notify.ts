// お問い合わせの通知。
// - 管理者宛メール(Cloudflare Email Routing の send_email): お問い合わせ内容の唯一の保管先
// - Discord: 新着・送信失敗を知らせるだけで、個人情報(名前・メールアドレス・本文)は含めない

export interface ContactNotifyPayload {
  name: string;
  email: string;
  message: string;
}

const SENDER_ADDRESS = 'no-reply@chisamikan.site';

/**
 * お問い合わせ内容を管理者(自分)宛にメールで送ります。
 * 送り先(adminAddress)は Email Routing で認証済みのアドレスでなければ送信できません。
 * Reply-To に問い合わせ者のアドレスを入れるため、メールソフトの「返信」でそのまま返信できます。
 * 送信に失敗した場合は例外を投げます(呼び出し元でエラーとして扱うため)。
 */
export async function sendAdminEmail(
  payload: ContactNotifyPayload,
  binding: SendEmail,
  adminAddress: string
): Promise<void> {
  const receivedAt = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  await binding.send({
    from: { email: SENDER_ADDRESS, name: 'chisamikan.site お問い合わせフォーム' },
    to: adminAddress,
    replyTo: payload.email,
    subject: `【お問い合わせ】${payload.name} 様より`,
    text: [
      'chisamikan.site のお問い合わせフォームから送信がありました。',
      '',
      `受信日時: ${receivedAt}`,
      `お名前: ${payload.name}`,
      `メールアドレス: ${payload.email}`,
      '',
      '--- お問い合わせ内容 ---',
      payload.message,
    ].join('\n'),
  });
}

/**
 * Discordに定型文だけを送ります。問い合わせ者の入力内容は含めないでください。
 */
export async function notifyDiscord(content: string, webhookUrl: string): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // 定型文のみだが、念のためメンションは無効にしておく
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
  });
  if (!res.ok) {
    throw new Error(`Discord Webhook error (${res.status})`);
  }
}
