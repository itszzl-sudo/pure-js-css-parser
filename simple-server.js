const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  let filePath;
  if (req.url === '/') {
    filePath = './docs/index.html';
  } else if (fs.existsSync('./docs' + req.url)) {
    filePath = './docs' + req.url;
  } else if (fs.existsSync('.' + req.url)) {
    filePath = '.' + req.url;
  } else {
    filePath = './docs' + req.url;
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if(error.code == 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>', 'utf-8');
      }
      else {
        res.writeHead(500);
        res.end('Server Error: ' + error.code);
      }
    }
    else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`- Homepage: http://localhost:${PORT}/`);
  console.log(`- Cool Effects: http://localhost:${PORT}/cool-effects.html`);
  console.log(`- Canvas Demo: http://localhost:${PORT}/canvas-demo.html`);
  console.log(`- Test Page: http://localhost:${PORT}/test.html`);
});
