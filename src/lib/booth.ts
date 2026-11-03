import { decodeEntities } from './decodeEntities';
import { safeLinkUrl } from './url';

export interface BoothItem {
  id: number;
  title: string;
  price: string;
  category: string | null;
  imageUrl: string | null;
  // サムネイル(300px)の元になった、切り抜き前の大きな画像。トップページのカード画像はこれから変換する
  sourceImageUrl: string | null;
  url: string;
}

// ショップページ本体はCloudflareのManaged Challengeでfetchが弾かれるが、商品一覧ページ
// (/items)は対象外で、各商品カードのdata-item属性に商品情報がJSONで埋め込まれている
// (新着順)。DOMパースせず、この属性を正規表現で抜き出すだけで一覧を取得できる。
const DATA_ITEM_PATTERN =
  /<li class="js-mount-point-shop-item-card contents"[^>]*data-item="([^"]*)"/g;

export async function getBoothItems(limit = 3): Promise<BoothItem[]> {
  const shopUrl = import.meta.env.BOOTH_SHOP_URL;
  if (!shopUrl) {
    console.warn('[booth] BOOTH_SHOP_URL が設定されていないため、商品は表示しません。');
    return [];
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
        const raw = JSON.parse(decodeEntities(match[1]));
        const url = safeLinkUrl(raw.shop_item_url ?? raw.url);
        if (!url) continue;
        const imageUrl: string | null = raw.thumbnail_image_urls?.[0] ?? null;
        items.push({
          id: raw.id,
          title: raw.name,
          price: raw.price,
          category: raw.category?.name?.ja ?? raw.category?.name?.en ?? null,
          imageUrl,
          // サムネイルのURL(https://booth.pximg.net/c/300x300_a2_g5/…)から大きさ指定の部分を除くと元の画像になる
          sourceImageUrl: imageUrl?.replace(/\/c\/[^/]+\//, '/') ?? null,
          url,
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
