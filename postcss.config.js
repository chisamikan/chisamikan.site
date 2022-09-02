module.exports = {
  plugins: {
    'postcss-import': {},
    'tailwindcss/nesting': {},
    tailwindcss: {},
    'postcss-sort-media-queries': {
      sort: 'mobile-first',
    },
    'postcss-flexbugs-fixes': {},
    'postcss-aspect-ratio-polyfill': {},
    autoprefixer: {},
  },
};
