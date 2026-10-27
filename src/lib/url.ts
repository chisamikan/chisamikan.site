/**
 * Notion・RSS・BOOTHなど外部から取り込んだURLを、リンク(href)に使ってよいものだけに絞ります。
 * http(s) の絶対URLと、サイト内の絶対パス(/gallery など)のみ通し、それ以外は null を返します。
 * javascript: などのスキームが入っていると、クリック時にスクリプトが実行されてしまうためです
 * (データ元のアカウントが乗っ取られた場合などの備え)。
 */
export function safeLinkUrl(value: string | null | undefined): string | null {
  const url = value?.trim();
  if (!url) return null;
  // "//example.com" や "/\example.com" はブラウザが別サイトへのURLとして扱うため、サイト内パスとは認めない
  if (url.startsWith('/')) return /^\/[/\\]/.test(url) ? null : url;
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}
