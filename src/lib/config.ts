export const site = {
  title: import.meta.env.SITE_TITLE || 'Your Name | Illustration Portfolio',
  description:
    import.meta.env.SITE_DESCRIPTION || 'イラストレーターのポートフォリオサイトです。',
};

export const nav = [
  { href: '/', label: 'Top' },
  { href: '/#profile', label: 'Profile' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/works', label: 'Works' },
  { href: '/#news', label: 'News' },
  { href: '/#contact', label: 'Contact' },
];
