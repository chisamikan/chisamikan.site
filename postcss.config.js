const postcssFlexBugsFixes = require('postcss-flexbugs-fixes');
const cssMqgroup = require('css-mqgroup');
const autoprefixer = require('autoprefixer');
const purgecss = require('@fullhuman/postcss-purgecss');
const cssnano = require('cssnano');

module.exports = {
  plugins: [
    postcssFlexBugsFixes({}),
    cssMqgroup({ sort: true }),
    autoprefixer({
      grid: true,
    }),
    purgecss({
      content: ['./dist/**/*.html', './dist/**/*.js'],
    }),
    cssnano({ preset: 'default' }),
  ],
};
