const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const PORT = 4173;
const publicDir = path.join(__dirname, '.output', 'public');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

let win;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  function startServer() {
    const server = http.createServer((req, res) => {
      let reqPath = decodeURIComponent(req.url.split('?')[0]);
      let filePath = path.join(publicDir, reqPath);

      if (reqPath === '/' || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(publicDir, 'index.html');
      }

      const ext = path.extname(filePath);
      fs.readFile(filePath, (err, data) => {
        if (err) {
          filePath = path.join(publicDir, 'index.html');
          fs.readFile(filePath, (err2, data2) => {
            if (err2) {
              res.writeHead(404);
              res.end('Not found');
              return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data2);
          });
          return;
        }
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        createWindow();
      }
    });

    server.listen(PORT, '127.0.0.1');
  }

  function createWindow() {
    if (win) return;

    const splash = new BrowserWindow({
      width: 500,
      height: 300,
      frame: false,
      alwaysOnTop: true,
      resizable: false,
    });
    splash.loadFile(path.join(__dirname, 'splash.html'));

    win = new BrowserWindow({
      width: 1280,
      height: 800,
      show: false,
      title: 'Document Generator',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    win.setMenuBarVisibility(false);
    win.loadURL(`http://127.0.0.1:${PORT}`);

    win.once('ready-to-show', () => {
      splash.close();
      win.show();
    });

    win.on('closed', () => {
      win = null;
    });
  }

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    startServer();
    setTimeout(createWindow, 300);
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
