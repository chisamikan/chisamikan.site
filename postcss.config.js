const cssnano = require('cssnano');

module.exports = {
  plugins: [
    require('postcss-import')({
      plugins: [require('stylelint')],
    }),
    require('tailwindcss'),
    require('postcss-nested'),
    require('postcss-nested-ancestors'),
    require('autoprefixer'),
    require('postcss-sort-media-queries')({
      sort: function (a, b) {},
    }),
    cssnano({ preset: 'default' }),
  ],
};
