const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const http = require('http');

const PORT = 4173;
let win;
let serverProcess;

function getServerEntry() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app-output', 'server', 'index.mjs');
  }
  return path.join(__dirname, '.output', 'server', 'index.mjs');
}

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
    const serverEntry = getServerEntry();
    serverProcess = fork(serverEntry, [], {
      env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' },
      stdio: 'pipe',
    });
    serverProcess.stdout?.on('data', (d) => console.log(`[server] ${d}`));
    serverProcess.stderr?.on('data', (d) => console.error(`[server] ${d}`));
  }

  function waitForServer(url, callback, attempts = 50) {
    http.get(url, () => callback()).on('error', () => {
      if (attempts > 0) {
        setTimeout(() => waitForServer(url, callback, attempts - 1), 300);
      }
    });
  }

  function createWindow() {
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

    const url = `http://127.0.0.1:${PORT}`;
    waitForServer(url, () => win.loadURL(url));

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
    setTimeout(createWindow, 500);
  });

  app.on('window-all-closed', () => {
    if (serverProcess) serverProcess.kill();
    if (process.platform !== 'darwin') app.quit();
  });
}
