// HTML/XMLの属性・本文に出てくる文字参照を元の文字に戻す(BOOTHの商品データと自サイトのrss.xmlで共用)。
// 想定する入力は決まった出力元のものだけなので、名前付きの5種類と &#39; だけを扱う。
// &amp; を先に戻すと「&amp;lt;」が「<」になってしまうため最後に戻す
export function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&(#39|apos);/g, "'")
    .replace(/&amp;/g, '&');
}
