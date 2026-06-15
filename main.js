const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const ROOT = __dirname;

// YouTube weigert insluiten vanaf file:// (origin "null") -> fout 150/153.
// Daarom serveren we de app via een mini lokale webserver op 127.0.0.1, zodat
// de pagina een geldige http-origin krijgt, net als de online versie.
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
  '.txt':  'text/plain; charset=utf-8'
};

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        let urlPath = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
        if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
        const filePath = path.normalize(path.join(ROOT, urlPath));
        // Voorkom path-traversal: blijf binnen ROOT.
        if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
          res.writeHead(403); res.end('Forbidden'); return;
        }
        fs.readFile(filePath, (err, data) => {
          if (err) { res.writeHead(404); res.end('Not found'); return; }
          const ext = path.extname(filePath).toLowerCase();
          res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
          res.end(data);
        });
      } catch (e) {
        res.writeHead(500); res.end('Server error');
      }
    });
    server.on('error', reject);
    // Poort 0 = laat het OS een vrije poort kiezen; alleen lokaal bereikbaar.
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

let serverRef = null;

async function createWindow() {
  serverRef = await startServer();
  const port = serverRef.address().port;

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadURL(`http://127.0.0.1:${port}/index.html`);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (serverRef) { try { serverRef.close(); } catch (e) {} }
  app.quit();
});
