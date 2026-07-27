export const site = {
  title: import.meta.env.SITE_TITLE || 'Your Name | Illustration Portfolio',
  description:
    import.meta.env.SITE_DESCRIPTION || 'イラストレーターのポートフォリオサイトです。',
};

export const nav = [
  { href: '/', label: 'Top' },
  { href: '/#news', label: 'News' },
  { href: '/profile', label: 'Profile' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/novels', label: 'Novels' },
  { href: '/toolbox', label: 'ToolBox' },
  { href: '/#shop', label: 'Shop' },
  { href: '/contact', label: 'Contact' },
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
