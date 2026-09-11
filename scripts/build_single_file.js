import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('[1/4] Running Vite build...');
execSync('npx vite build', { stdio: 'inherit' });

console.log('[2/4] Reading compiled CSS...');
const distAssets = fs.readdirSync('dist/assets');
const cssFile = distAssets.find(f => f.endsWith('.css'));
if (!cssFile) throw new Error('Compiled CSS not found in dist/assets');
const cssContent = fs.readFileSync(path.join('dist/assets', cssFile), 'utf-8');

console.log('[3/4] Bundling React app to standalone IIFE JS with esbuild...');
execSync('npx esbuild src/main.jsx --bundle --minify --format=iife --define:process.env.NODE_ENV=\\"production\\" --loader:.js=jsx --loader:.jsx=jsx --loader:.css=empty --outfile=temp_bundle.js', { stdio: 'inherit' });
const jsContent = fs.readFileSync('temp_bundle.js', 'utf-8');
fs.unlinkSync('temp_bundle.js');

console.log('[4/4] Generating standalone rentora_app.html...');
const htmlTemplate = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Rentora | پلتفرم اجاره کالا در شبکه پای</title>
  <style>
${cssContent}
  </style>
  <style>
    body { margin: 0; padding: 0; background-color: #FAFAFC; font-family: 'Vazirmatn', system-ui, -apple-system, sans-serif; }
    .dark body { background-color: #0E0D1B; }
  </style>
</head>
<body class="bg-[#FAFAFC] dark:bg-[#0E0D1B] text-[#111827] dark:text-[#F3F4F6]">
  <div id="root">
    <div style="min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: #FAFAFC; font-family: system-ui, -apple-system, sans-serif; direction: rtl;">
      <div style="width: 52px; height: 52px; border-radius: 14px; background: #26215C; display: flex; align-items: center; justify-content: center; color: #FFFFFF; font-size: 26px; font-weight: bold; box-shadow: 0 6px 16px rgba(38,33,92,0.25);">
        π
      </div>
      <div style="margin-top: 16px; font-weight: 800; font-size: 16px; color: #26215C;">
        رنتورا (Rentora)
      </div>
      <div style="margin-top: 6px; font-size: 12px; color: #64748B;">
        در حال بارگذاری پلتفرم امن اجاره...
      </div>
    </div>
  </div>
  <script>
${jsContent}
  </script>
</body>
</html>`;

fs.writeFileSync('rentora_app.html', htmlTemplate, 'utf-8');
console.log('✓ Successfully generated rentora_app.html (' + (fs.statSync('rentora_app.html').size / 1024).toFixed(1) + ' KB)');
