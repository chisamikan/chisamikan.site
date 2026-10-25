// お問い合わせ通知(Discord Webhook / Zapier Webhook)。未設定なら何もせず、
// 失敗しても呼び出し元は止めない(Notionへの保存が主で、通知はベストエフォートのため)。

export interface ContactNotifyPayload {
  name: string;
  email: string;
  message: string;
}

// Discordのメッセージ本文(content)は2000文字までのため、超える場合は複数メッセージに分けて送る
const DISCORD_CONTENT_MAX = 2000;

function splitByLength(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let current = '';
  // Array.fromでコードポイント単位に分け、絵文字(サロゲートペア)の途中で切らない
  for (const ch of Array.from(text)) {
    if (current.length + ch.length > maxLength) {
      chunks.push(current);
      current = '';
    }
    current += ch;
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function notifyDiscord(
  payload: ContactNotifyPayload,
  webhookUrl: string
): Promise<void> {
  const content = [
    '📩 新しいお問い合わせがありました',
    `**お名前**: ${payload.name}`,
    `**メール**: ${payload.email}`,
    '**内容**:',
    payload.message,
  ].join('\n');

  // 順番が入れ替わらないよう、1通ずつ順番に送信する
  for (const chunk of splitByLength(content, DISCORD_CONTENT_MAX)) {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: chunk }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Discord Webhook error (${res.status}): ${detail}`);
    }
  }
}

/**
 * Zapierの「Webhooks by Zapier(Catch Hook)」宛にお問い合わせ内容をPOSTします。
 * 実際のメール送信(Outlookアカウント連携など)はZapier側のZapで組み立てます。
 * 管理者宛通知用・送信者への自動返信用など、用途ごとに別のZapier Webhook URLを渡してください。
 */
export async function notifyZapier(
  payload: ContactNotifyPayload,
  webhookUrl: string
): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Zapier Webhook error (${res.status}): ${detail}`);
  }
}
