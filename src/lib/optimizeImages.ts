import { getImage, inferRemoteSize } from 'astro:assets';

// Notionの画像をビルド中に取得してサイズ違いのAVIFへ変換し、自サイトの静的ファイルとして配信する
// (/api/image のリダイレクトとNotionへの問い合わせを通さない)。
// AVIFは主要ブラウザがすべて対応しているため、WebPなどのフォールバックは用意しない
export interface OptimizedImage {
  // 変換できなかった画像は src だけを持ち、従来どおりその URL を表示する
  src: string;
  srcset?: string;
  sizes?: string;
}

/**
 * 変換に失敗した場合や開発サーバーでは、変換せずに fallbackUrl を表示する。
 * @param sourceUrl 取得元の直接のURL(Notionの署名付きURLなど)
 * @param fallbackUrl 変換できなかった場合に表示するURL
 * @param convert 元画像の大きさを受け取って変換する
 */
async function optimize(
  sourceUrl: string,
  fallbackUrl: string,
  convert: (width: number, height: number) => Promise<OptimizedImage>,
): Promise<OptimizedImage> {
  // 開発サーバーでは画像を表示のたびにその場で変換するうえ、Notionの署名付きURLがリロードのたびに変わって
  // ブラウザのキャッシュも効かないため、毎回約1秒待たされる。開発中は変換せずに表示する
  if (import.meta.env.DEV) return { src: fallbackUrl };
  try {
    // 元画像の大きさを取得する。ここで取得できない画像は、ビルドの最後にまとめて行われる変換でも
    // 失敗してビルド全体が止まるため、この時点で変換の対象から外す
    const { width, height } = await inferRemoteSize(sourceUrl);
    return await convert(width, height);
  } catch (err) {
    console.warn(`[optimizeImages] 画像を変換できなかったため、変換せずに表示します: ${fallbackUrl}`, err);
    return { src: fallbackUrl };
  }
}

// 元画像より大きい幅は作らず、元画像の幅を上限にする
const widthsUpTo = (widths: number[], max: number) => [...widths.filter((w) => w < max), max];

// ファーストビューの全画面イラスト。PCの画面幅(1920px前後)で等倍になる大きさを上限にする。
// スマホの高画素密度の画面では少し拡大表示になるが、文字を重ねる背景でありズームもしているため目立たない
const HERO_WIDTHS = [640, 960, 1280, 1920];

export function optimizeHeroImage(sourceUrl: string, fallbackUrl: string): Promise<OptimizedImage> {
  return optimize(sourceUrl, fallbackUrl, async (width, height) => {
    const maxWidth = Math.min(width, HERO_WIDTHS.at(-1)!);
    const avif = await getImage({
      src: sourceUrl,
      width: maxWidth,
      height: Math.round((maxWidth * height) / width),
      widths: widthsUpTo(HERO_WIDTHS, maxWidth),
      format: 'avif',
      quality: 50,
    });
    // 画面全体に object-cover で敷くため、画面が画像より縦長なら画面の高さに合わせて拡大される。
    // そのときは横幅ではなく「画面の高さ × 画像の縦横比」を表示幅として画像を選ばせる
    const sizes = `(min-aspect-ratio: ${width}/${height}) 100vw, calc(100vh * ${(width / height).toFixed(3)})`;
    return { src: avif.src, srcset: avif.srcSet.attribute, sizes };
  });
}

// トップページのカードのサムネイル。カードは正方形に上端揃えで切り抜いて表示する(object-cover object-top)ため、
// 同じ切り抜き方の正方形にして無駄な部分を送らない。表示幅はスマホで画面幅の85%、PCで約19〜24rem。
// スマホ(表示約350px×画素密度1.75〜2)では600〜700px必要になり、400の次が800だと大きすぎるものを送るため640を挟む
const CARD_WIDTHS = [400, 640, 800, 1200];

export function optimizeCardImage(sourceUrl: string, fallbackUrl: string): Promise<OptimizedImage> {
  return optimize(sourceUrl, fallbackUrl, async (width, height) => {
    const side = Math.min(width, height, CARD_WIDTHS.at(-1)!);
    const avif = await getImage({
      src: sourceUrl,
      width: side,
      height: side,
      widths: widthsUpTo(CARD_WIDTHS, side),
      fit: 'cover',
      position: 'top',
      format: 'avif',
      quality: 50,
    });
    return { src: avif.src, srcset: avif.srcSet.attribute, sizes: '(min-width: 640px) 24rem, 85vw' };
  });
}
