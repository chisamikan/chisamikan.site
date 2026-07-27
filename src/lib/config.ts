export const site = {
  title: import.meta.env.SITE_TITLE || 'Your Name | Illustration Portfolio',
  description:
    import.meta.env.SITE_DESCRIPTION || 'イラストレーターのポートフォリオサイトです。',
};

export const nav = [
  { href: '/', label: 'Top' },
  { href: '/#news', label: 'News' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/#profile', label: 'Profile' },
  { href: '/works', label: 'Works' },
  { href: '/toolbox', label: 'Tool Box' },
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
