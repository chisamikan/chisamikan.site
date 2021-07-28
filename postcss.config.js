//const purgecss = require('@fullhuman/postcss-purgecss');
const cssnano = require('cssnano');

module.exports = (ctx) => ({
  map: ctx.options.map,
  plugins: [
    require('postcss-import')({
      plugins: [require('stylelint')],
    }),
    //require('tailwindcss'),
    require('postcss-simple-vars'),
    require('postcss-nested'),
    require('postcss-nested-ancestors'),
    require('autoprefixer'),
    require('postcss-sort-media-queries')({
      sort: function (a, b) {},
    }),
    cssnano({ preset: 'default' }),
  ],
});
