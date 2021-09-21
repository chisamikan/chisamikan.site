const presets = [
  [
    '@babel/preset-env',
    {
      useBuiltIns: 'entry',
      corejs: 3,
    },
  ],
];
module.exports = { presets };
