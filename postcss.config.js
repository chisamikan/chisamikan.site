module.exports = {
  plugins: [
    require('postcss-import'),
    require('tailwindcss/nesting'),
    require('tailwindcss'),
    require('postcss-sort-media-queries')({
      sort: 'mobile-first',
    }),
    require('postcss-flexbugs-fixes'),
    require('postcss-aspect-ratio-polyfill'),
    require('autoprefixer'),
  ],
};
