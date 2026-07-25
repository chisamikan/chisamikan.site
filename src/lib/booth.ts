export interface BoothItem {
  id: number;
  title: string;
  price: string;
  category: string | null;
  imageUrl: string | null;
  url: string;
}

// ---------------------------------------------------------------------------
// BOOTHのショップページ(https://{shop}.booth.pm/)自体はCloudflareの
// Managed Challenge(JS実行が必要な認証)で保護されておりビルド時のfetchが弾かれるが、
// 商品一覧ページ(/items)はその対象外で、各商品カードの data-item 属性に
// 商品ID・商品名・価格・サムネイルURL・商品ページURLがJSONとしてそのまま
// 埋め込まれている(新着順)。そのためHTMLをDOMパースする代わりに、この
// data-item 属性を正規表現で抜き出すだけで先頭から新着順の一覧を取得できる。
// ---------------------------------------------------------------------------
const DATA_ITEM_PATTERN =
  /<li class="js-mount-point-shop-item-card contents"[^>]*data-item="([^"]*)"/g;

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export async function getBoothItems(limit = 3): Promise<BoothItem[]> {
  const shopUrl = import.meta.env.BOOTH_SHOP_URL;
  if (!shopUrl) {
    console.warn('[booth] BOOTH_SHOP_URL が設定されていないため、ダミーデータを表示します。');
    return sampleItems.slice(0, limit);
  }

  try {
    const res = await fetch(new URL('items', shopUrl).toString());
    if (!res.ok) {
      throw new Error(`BOOTHショップページの取得に失敗しました(HTTP ${res.status})`);
    }

    const html = await res.text();
    const items: BoothItem[] = [];

    for (const match of html.matchAll(DATA_ITEM_PATTERN)) {
      try {
        const raw = JSON.parse(decodeHtmlEntities(match[1]));
        items.push({
          id: raw.id,
          title: raw.name,
          price: raw.price,
          category: raw.category?.name?.ja ?? raw.category?.name?.en ?? null,
          imageUrl: raw.thumbnail_image_urls?.[0] ?? null,
          url: raw.shop_item_url ?? raw.url,
        });
      } catch {
        // 個別の商品データが想定外の形式だった場合はその商品だけ読み飛ばす
      }
    }

    return items.slice(0, limit);
  } catch (err) {
    console.error('[booth] ショップ商品の取得に失敗しました:', err);
    return [];
  }
}

const sampleItems: BoothItem[] = [
  {
    id: 0,
    title: '(サンプル) BOOTH_SHOP_URL を設定するとショップの商品がここに並びます',
    price: '¥ 0',
    category: 'サンプル',
    imageUrl: null,
    url: '#',
  },
];
