export const site = {
  title: 'chisamikan.site - 千紗みかんウェブサイト',
  description: '千紗みかんのポートフォリオサイトです。',
};

// 構造化データ(JSON-LD)のPersonスキーマで使うサイト運営者情報
export const person = {
  name: '千紗みかん',
  alternateName: 'Chisa Mikan',
  jobTitle: 'イラストレーター',
  description: 'インターネット絵とデザインと文マン。同人サークル『Pt.Spoon』・『Satellite Galaxy』主催。',
  image: '/images/profile-icon.webp',
};

// ナビゲーションでは英語名(label)を主に表示し、日本語名(labelJa)を小さく併記する
export const nav = [
  { href: '/', label: 'Top', labelJa: 'トップ' },
  { href: '/news', label: 'News', labelJa: 'お知らせ' },
  { href: '/about', label: 'About', labelJa: 'サイトについて' },
  { href: '/profile', label: 'Profile', labelJa: 'プロフィール' },
  { href: '/gallery', label: 'Gallery', labelJa: 'ギャラリー' },
  { href: '/novels', label: 'Novels', labelJa: '小説' },
  { href: '/toolbox', label: 'ToolBox', labelJa: 'ツールボックス' },
  { href: '/#shop', label: 'Shop', labelJa: 'ショップ' },
  { href: '/contact', label: 'Contact', labelJa: 'お問い合わせ' },
];

export const snsLinks = [
  { label: 'X', href: 'https://x.com/chisamikan', icon: 'fa-brands fa-x-twitter' },
  // Misskeyの公式アイコンはFont Awesomeに存在しないため、カスタムSVG(MisskeyIcon)を使用する
  { label: 'Misskey.io', href: 'https://misskey.io/@chisamikan', icon: 'custom:misskey' },
  { label: 'pixiv', href: 'https://www.pixiv.net/users/263417', icon: 'fa-brands fa-pixiv' },
  { label: 'YouTube', href: 'https://www.youtube.com/user/chisamikan', icon: 'fa-brands fa-youtube' },
  { label: 'Discord', href: 'https://discord.com/invite/KhYNuGStvj', icon: 'fa-brands fa-discord' },
  { label: 'GitHub', href: 'https://github.com/chisamikan', icon: 'fa-brands fa-github' },
];

export const supportLinks = [
  {
    label: 'FANBOX',
    href: 'https://chisamikan.fanbox.cc/',
    icon: 'fa-solid fa-heart',
    description: 'サブスク形式で支援したい方はこちら',
  },
  {
    label: 'note',
    href: 'https://note.com/chisamikan',
    icon: 'fa-solid fa-pen-nib',
    description: '会員限定記事を単品購入したい方はこちら',
  },
  {
    label: 'Amazonほしい物リスト',
    href: 'https://www.amazon.co.jp/registry/wishlist/2NJTPLW0NSHNA/',
    icon: 'fa-brands fa-amazon',
    description: 'プレゼントはこちら',
  },
];

// プロフィールページの「技術文書」セクションで表示するZennの記事フィード
export const zennFeedUrl = 'https://zenn.dev/chisamikan/feed';
