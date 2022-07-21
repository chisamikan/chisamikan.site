module.exports = {
  content: ['./src/**/*.{js,ejs}'],
  theme: {
    fontFamily: {
      body: ['"M PLUS 1p"', 'sans-serif'],
      mono: ['"Share Tech Mono"', '"M PLUS 1p"', 'monospace'],
    },
    extend: {
      keyframes: {
        loader: {
          '0%': {
            transform: 'rotate(0deg)',
          },
          to: {
            transform: 'rotate(1turn)',
          },
        },
        pulsate: {
          '0%': {
            textShadow:
              '0 0 4px var(--neon-light), 0 0 10px var(--neon-light), 0 0 18px var(--neon-light), 0 0 38px var(--neon-dark),0 0 73px var(--neon-dark), 0 0 80px var(--neon-dark), 0 0 94px var(--neon-dark), 0 0 140px var(--neon-dark)',
          },
          to: {
            textShadow:
              '0 0 4px var(--neon-light), 0 0 11px var(--neon-light), 0 0 19px var(--neon-light), 0 0 40px var(--neon-dark), 0 0 80px var(--neon-dark), 0 0 90px var(--neon-dark), 0 0 100px var(--neon-dark), 0 0 150px var(--neon-dark)',
          },
        },
        'checkbox-on': {
          '0%': {
            boxShadow:
              '0 0 0 10px, 10px -10px 0 10px, 32px 0px 0 20px, 0px 32px 0 20px, -5px 5px 0 10px, 15px 2px 0 11px',
          },
          '50%': {
            boxShadow:
              '0 0 0 10px, 10px -10px 0 10px, 32px 0px 0 20px, 0px 32px 0 20px, -5px 5px 0 10px, 20px 2px 0 11px',
          },
          '100%': {
            boxShadow:
              '0 0 0 10px, 10px -10px 0 10px, 32px 0px 0 20px, 0px 32px 0 20px, -5px 5px 0 10px, 20px -12px 0 11px',
          },
        },
        'checkbox-off': {
          '0%': {
            boxShadow:
              '0 0 0 10px, 10px -10px 0 10px, 32px 0px 0 20px, 0px 32px 0 20px, -5px 5px 0 10px, 20px -12px 0 11px, 0 0 0 0 inset',
          },
          '25%': {
            boxShadow:
              '0 0 0 10px, 10px -10px 0 10px, 32px 0px 0 20px, 0px 32px 0 20px, -5px 5px 0 10px, 20px -12px 0 11px, 0 0 0 0 inset',
          },
          '50%': {
            transform: 'rotate(45deg)',
            marginTop: '-4px',
            marginLeft: '6px',
            width: '0px',
            height: '0px',
            boxShadow:
              '0 0 0 10px, 10px -10px 0 10px, 32px 0px 0 20px, 0px 32px 0 20px, -5px 5px 0 10px, 15px 2px 0 11px, 0 0 0 0 inset',
          },
          '51%': {
            transform: 'rotate(0deg)',
            marginTop: '-2px',
            marginLeft: '-2px',
            width: '20px',
            height: '20px',
            boxShadow:
              '0 0 0 0, 0 0 0 0, 0 0 0 0, 0 0 0 0, 0 0 0 0, 0 0 0 0, 0px 0px 0 10px inset',
          },
          '100%': {
            transform: 'rotate(0deg)',
            marginTop: '-2px',
            marginLeft: '-2px',
            width: '20px',
            height: '20px',
            boxShadow:
              '0 0 0 0, 0 0 0 0, 0 0 0 0, 0 0 0 0, 0 0 0 0, 0 0 0 0, 0px 0px 0 0px inset',
          },
        },
        'ripple-on': {
          '0%': {
            opacity: '.5',
          },

          to: {
            opacity: '0',
            transform: 'scale(13, 13)',
          },
        },
        'ripple-off': {
          '0%': {
            opacity: '.5',
          },

          to: {
            opacity: '0',
            transform: 'scale(13, 13)',
          },
        },
      },
      animation: {
        loader: 'loader 0.5s linear infinite',
        pulsate: 'pulsate 0.11s ease-in-out infinite alternate',
        'checkbox-on': 'checkbox-on 0.3s forwards ease-out',
        'checkbox-off': 'checkbox-off 0.3s forwards ease-out',
        'ripple-on': 'ripple-on 700ms forwards ease-out',
        'ripple-off': 'ripple-off  700ms forwards ease-out',
      },
    },
  },
  variants: {},
  plugins: [],
};
