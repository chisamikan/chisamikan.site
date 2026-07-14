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
  { href: '/#contact', label: 'Contact' },
];
