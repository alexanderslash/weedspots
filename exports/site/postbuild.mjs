import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import CleanCSS from 'clean-css';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distAssets = path.join(__dirname, '..', 'dist', 'assets');
const srcCss = path.join(__dirname, 'src', 'styles', 'style.css');

fs.mkdirSync(distAssets, { recursive: true });

const css = fs.readFileSync(srcCss, 'utf8');
const minified = new CleanCSS({ level: 2 }).minify(css);
fs.writeFileSync(path.join(distAssets, 'style.min.css'), minified.styles, 'utf8');

console.log('  ✓ CSS minified → dist/assets/style.min.css');
