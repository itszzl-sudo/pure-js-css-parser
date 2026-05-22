const http = require('http');
const fs = require('fs');
const path = require('path');
const JSCSS = require('./index');

const PORT = 3000;

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    const filePath = path.join(__dirname, 'public', 'index.html');
    serveFile(res, filePath, 'text/html');
  } else if (req.url === '/api/compute' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const jscss = new JSCSS();
        jscss.loadHTML(data.html);
        jscss.loadCSS(data.css);
        jscss.computeLayout();
        const layoutData = jscss.getLayoutData();
        const htmlWithAttrs = jscss.getHTMLWithAttributes();
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          layout: layoutData,
          html: htmlWithAttrs
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else {
    const filePath = path.join(__dirname, 'public', req.url);
    serveFile(res, filePath);
  }
});

function serveFile(res, filePath, defaultContentType = 'text/plain') {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }
    const ext = path.extname(filePath);
    let contentType = defaultContentType;
    if (ext === '.html') contentType = 'text/html';
    if (ext === '.css') contentType = 'text/css';
    if (ext === '.js') contentType = 'application/javascript';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
