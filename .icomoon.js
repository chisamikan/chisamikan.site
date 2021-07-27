const pipeline = require('icomoon-generator');

pipeline({
  // If you add a selectionPath file you will add the svg icons over the existing one,
  // But if you dont add a selectionPath icomoon-generator will use an empty selection.json file and will generate a new selection.json back to square one and will prepare just for the svg icons that are inside the svg folder
  //selectionPath: "src/_icons/selection.json",
  outputDir: 'dist/icons',
  svgDir: 'src/icons',
  forceOverride: true,
  // visible: true,
  whenFinished(result) {
    // you can get the absolute path of output directory via result.outputDir
  },
});
