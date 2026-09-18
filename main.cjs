const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const http = require('http');

const PORT = 4173;
let win;
let serverProcess;

function startServer() {
  const serverEntry = path.join(__dirname, '.output', 'server', 'index.mjs');
  serverProcess = fork(serverEntry, [], {
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' },
    stdio: 'pipe',
  });

  serverProcess.stdout?.on('data', (data) => console.log(`[server] ${data}`));
  serverProcess.stderr?.on('data', (data) => console.error(`[server] ${data}`));
}

function waitForServer(url, callback, attempts = 40) {
  http.get(url, (res) => {
    callback();
  }).on('error', () => {
    if (attempts > 0) {
      setTimeout(() => waitForServer(url, callback, attempts - 1), 300);
    } else {
      console.error('Server did not start in time.');
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
  waitForServer(url, () => {
    win.loadURL(url);
  });

  win.once('ready-to-show', () => {
    splash.close();
    win.show();
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  startServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
