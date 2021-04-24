import imagemin from 'imagemin';
import imageminMozjpeg from 'imagemin-mozjpeg';
import imageminPngquant from 'imagemin-pngquant';
import imageminGifsicle from 'imagemin-gifsicle';
import imageminSvgo from 'imagemin-svgo';
import { extendDefaultPlugins } from 'svgo';

const files = await imagemin(['src/images/*.{jpg,png,gif,svg}'], {
  destination: 'dist/images',
  plugins: [
    imageminMozjpeg({ quality: 80 }),
    imageminPngquant({ quality: [0.65, 0.8] }),
    imageminGifsicle(),
    imageminSvgo({
      plugins: extendDefaultPlugins([{ name: 'removeViewBox', active: false }]),
    }),
  ],
});

console.log(files);
