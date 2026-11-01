import { getImage, inferRemoteSize } from 'astro:assets';

// ファーストビューの全画面イラスト。ビルド中に元画像を取得してサイズ違いのAVIFへ変換し、
// 自サイトの静的ファイルとして配信する(/api/image のリダイレクトとNotionへの問い合わせを通さない)
export interface HeroImage {
  // 変換できなかった画像は src だけを持ち、従来どおりその URL を表示する
  src: string;
  srcset?: string;
  sizes?: string;
}

// PCの画面幅(1920px前後)で等倍になる大きさを上限にする。スマホの高画素密度の画面では
// 少し拡大表示になるが、文字を重ねる背景でありズームもしているため目立たない
const WIDTHS = [640, 960, 1280, 1920];

/**
 * @param sourceUrl 取得元の直接のURL(Notionの署名付きURLなど)
 * @param fallbackUrl 変換できなかった場合に表示するURL
 */
export async function optimizeHeroImage(sourceUrl: string, fallbackUrl: string): Promise<HeroImage> {
  try {
    // 元画像の大きさを取得する。ここで取得できない画像は、ビルドの最後にまとめて行われる変換でも
    // 失敗してビルド全体が止まるため、この時点で変換の対象から外す
    const { width, height } = await inferRemoteSize(sourceUrl);
    const maxWidth = Math.min(width, WIDTHS.at(-1)!);
    const widths = [...WIDTHS.filter((w) => w < maxWidth), maxWidth];
    // AVIFは主要ブラウザがすべて対応しているため、WebPなどのフォールバックは用意しない
    const avif = await getImage({
      src: sourceUrl,
      width: maxWidth,
      height: Math.round((maxWidth * height) / width),
      widths,
      format: 'avif',
      quality: 50,
    });

    // 画面全体に object-cover で敷くため、画面が画像より縦長なら画面の高さに合わせて拡大される。
    // そのときは横幅ではなく「画面の高さ × 画像の縦横比」を表示幅として画像を選ばせる
    const sizes = `(min-aspect-ratio: ${width}/${height}) 100vw, calc(100vh * ${(width / height).toFixed(3)})`;

    return { src: avif.src, srcset: avif.srcSet.attribute, sizes };
  } catch (err) {
    console.warn(`[heroImages] ファーストビューの画像を変換できなかったため、変換せずに表示します: ${fallbackUrl}`, err);
    return { src: fallbackUrl };
  }
}
