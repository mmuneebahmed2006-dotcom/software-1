const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const splash = new BrowserWindow({
    width: 500,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
  });
  splash.loadFile(path.join(__dirname, 'splash.html'));

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    title: 'Document Generator',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile(path.join(__dirname, '.output/public/index.html'));

  win.once('ready-to-show', () => {
    setTimeout(() => {
      splash.close();
      win.show();
    }, 2500);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
