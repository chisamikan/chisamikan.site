import imagemin from 'imagemin';
import imageminMozjpeg from 'imagemin-mozjpeg';
import imageminPngquant from 'imagemin-pngquant';
import imageminGifsicle from 'imagemin-gifsicle';
import imageminSvgo from 'imagemin-svgo';

const files = await imagemin(['src/images/**/*.{jpg,png,gif,svg}'], {
  destination: 'dist/images',
  plugins: [
    imageminMozjpeg({ quality: 80 }),
    imageminPngquant({ quality: [1.0, 1.0] }),
    imageminGifsicle(),
    imageminSvgo({
      plugins: [
        {
          name: 'removeViewBox',
          active: false,
        },
      ],
    }),
  ],
});

console.log(files);
