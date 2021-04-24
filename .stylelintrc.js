module.exports = {
  plugins: [
    'stylelint-scss',
    'stylelint-no-unsupported-browser-features',
    'stylelint-declaration-block-no-ignored-properties',
    'stylelint-prettier',
  ],
  extends: [
    'stylelint-config-recess-order',
    //'stylelint-config-standard',
  ],
  ignoreFiles: ['**/node_modules/**', '**/dist/**'],
  rules: {
    // scssを使うには↓の2つがないと@mixinとかでエラーになってしまう。
    'at-rule-no-unknown': null,
    'scss/at-rule-no-unknown': true,

    // 1未満の少数の先頭の0は取る。
    'number-leading-zero': 'never',

    // プロパティをアルファベット順に並び替える。
    //'order/properties-alphabetical-order': true,

    // packege.jsonに書いてあるbrowserslist（対応ブラウザ）で、未対応のプロパティを書いたら警告を出す。
    'plugin/no-unsupported-browser-features': [
      true,
      {
        // 重要度
        // warningとerrorの二種類あるが、部分サポートのプロパティのように、必ず直さないといけないものではないのでwarningにする。
        severity: 'warning',
        // 除外設定
        ignore: [
          // 多用するプロパティは除外する
          'viewport-units', // IEに対応する場合、vmaxは対応していないので使わないこと。
          'flexbox', // flexboxのバグはコンパイル時にpostcss-flexbugs-fixesがある程度直してくれる。
          'css-gradients', // transparentを使っている場合は正常に表示されないので、手動でrgba指定に変えること。
          'calc',
          // text-size-adjustが対応していないブラウザ（IEなど）は、そもそも自動縮小機能が付いてないので無視でOK。効かなくてもviewportをきちんと設定していれば大丈夫。
          'text-size-adjust',
        ],
      },
    ],

    // displayの値によって無視されるプロパティを書いたら警告を出す。
    'plugin/declaration-block-no-ignored-properties': true,

    // font-family を書く時、ブラウザに実装されている総称ファミリは末尾につけるようにする。
    'font-family-no-missing-generic-family-keyword': true,

    //ショートハンドプロパティで上書きしたら警告を出す。
    'declaration-block-no-shorthand-property-overrides': true,

    // stylelint-prettier
    'prettier/prettier': true,
  },
};
