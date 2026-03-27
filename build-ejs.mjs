import fs from "fs";
import path from "path";
import ejs from "ejs";

const SRC_DIR = "src/ejs/pages";
const OUT_DIR = "dist/temp";
const DATA = JSON.parse(fs.readFileSync("site.json", "utf-8"));

// 再帰的にファイル取得
function getFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((dirent) => {
    const res = path.resolve(dir, dirent.name);
    return dirent.isDirectory() ? getFiles(res) : res;
  });
}

// 出力ディレクトリ作成
fs.mkdirSync(OUT_DIR, { recursive: true });

// EJSファイル処理
const files = getFiles(SRC_DIR).filter((f) => f.endsWith(".ejs"));

for (const file of files) {
  const relativePath = path.relative(SRC_DIR, file);
  const outPath = path.join(
    OUT_DIR,
    relativePath.replace(/\.ejs$/, ".html")
  );

  // 出力先ディレクトリ作成
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const template = fs.readFileSync(file, "utf-8");

  const html = ejs.render(template, DATA, {
    filename: file, // include対応
  });

  fs.writeFileSync(outPath, html);
}

console.log("EJS build completed");