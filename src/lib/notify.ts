// ---------------------------------------------------------------------------
// お問い合わせ通知(Discord Webhook / Zapier Webhook)
// いずれも未設定なら何もせず、失敗しても呼び出し元の処理は止めません
// (Notionへの保存が主で、通知はベストエフォートのため)。
// ---------------------------------------------------------------------------

export interface ContactNotifyPayload {
  name: string;
  email: string;
  message: string;
}

export async function notifyDiscord(
  payload: ContactNotifyPayload,
  webhookUrl: string
): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: [
        '📩 新しいお問い合わせがありました',
        `**お名前**: ${payload.name}`,
        `**メール**: ${payload.email}`,
        '**内容**:',
        payload.message,
      ].join('\n'),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Discord Webhook error (${res.status}): ${detail}`);
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
