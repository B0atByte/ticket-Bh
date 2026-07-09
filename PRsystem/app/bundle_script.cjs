const fs = require('fs');

const css = fs.readFileSync('dist/assets/index.css', 'utf8');
const js = fs.readFileSync('dist/assets/index.js', 'utf8');

const bundleHtml = `<!doctype html>
<html lang="th">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ระบบขอซื้อสินค้า — PR System</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
    <style>
${css}
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
${js.replace(/<\/script>/g, '<\\/script>')}
    </script>
  </body>
</html>`;

fs.writeFileSync('bundle.html', bundleHtml, 'utf8');
console.log('Successfully created bundle.html (Full Rebuild)');
