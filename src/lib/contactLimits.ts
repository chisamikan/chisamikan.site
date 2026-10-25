// お問い合わせフォームの最大文字数。フォーム(maxlength・残り文字数表示)とAPIの検証で共用する。
// 文字数はJavaScriptの length(UTF-16単位)で数えるため、全角・半角は区別せず1文字、
// 絵文字の多くは2文字として数えられる(ブラウザの maxlength と同じ数え方)。
export const CONTACT_LIMITS = {
  name: 100,
  // メールアドレスの仕様上の最大長
  email: 254,
  message: 5000,
} as const;

/**
 * 改行コードを LF に揃えます。
 * 送信時に改行が CRLF(2文字)に変換される場合があり、そのまま数えると
 * フォーム上は上限以内でもAPIでは上限超過と判定されてしまうため、数える前に揃えます。
 */
export function normalizeNewlines(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}
