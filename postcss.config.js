module.exports = {
  plugins: [
    require('tailwindcss'),
    require('postcss-nested'),
    require('postcss-nested-ancestors'),
    require('postcss-sort-media-queries')({
      sort: 'mobile-first',
    }),
    require('postcss-flexbugs-fixes'),
    require('postcss-aspect-ratio-polyfill'),
    require('autoprefixer'),
    require('cssnano')({
      preset: [
        'default',
        {
          calc: false,
        },
      ],
    }),
  ],
};
