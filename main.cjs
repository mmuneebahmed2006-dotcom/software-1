const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const http = require('http');
const fs = require('fs');
const AdmZip = require('adm-zip');

const PORT = 4173;
const CATEGORIES = { invoice: 'Invoice', quotation: 'Quotation', dc: 'Delivery Challan', tax: 'Sales Tax Invoice' };
const EMPTY_COMPANY = { address: '', phone: '', email: '', terms: '' };
let win; let serverProcess;
const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');
const writeSettings = (value) => { fs.mkdirSync(path.dirname(settingsPath()), { recursive: true }); fs.writeFileSync(settingsPath(), JSON.stringify(value, null, 2)); return value; };
// The Windows installer asks for a documents folder on every install and drops the choice here.
const installerRoot = () => { for (const file of [path.join(app.getPath('userData'), 'data-root.txt'), path.join(path.dirname(app.getPath('exe')), 'data-root.txt')]) { try { const value = fs.readFileSync(file, 'utf8').trim().replace(/^\ufeff/, ''); if (value) return path.resolve(value); } catch {} } return null; };
const readSettings = () => {
  let stored = {};
  try { stored = JSON.parse(fs.readFileSync(settingsPath(), 'utf8')); } catch {}
  const base = { initialized: false, dataRoot: null, lastBackupAt: null, ...stored };
  if (base.dataRoot) return base;
  const chosen = installerRoot();
  if (!chosen) return base;
  try {
    const target = path.resolve(chosen);
    ensureWorkspace(target);
    return writeSettings({ ...base, initialized: true, dataRoot: target });
  } catch {}
  return base;
};
const safePart = (value) => String(value ?? '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').trim().slice(0, 100) || 'Untitled';
const dataRoot = () => { const root = readSettings().dataRoot; if (!root) throw new Error('Workspace is not initialized'); return path.resolve(root); };
const withinRoot = (...parts) => { const root = dataRoot(); const target = path.resolve(root, ...parts.map(safePart)); if (target !== root && !target.startsWith(root + path.sep)) throw new Error('Invalid workspace path'); return target; };
const decodeData = (value) => Buffer.from(String(value).replace(/^data:[^;]+;base64,/, ''), 'base64');
const getServerEntry = () => app.isPackaged ? path.join(process.resourcesPath, 'app-output', 'server', 'index.mjs') : path.join(__dirname, '.output', 'server', 'index.mjs');
const log = (message) => { try { fs.appendFileSync(path.join(app.getPath('userData'), 'document-generator.log'), `[${new Date().toISOString()}] ${message}\n`); } catch {} };
function ensureWorkspace(root) { fs.mkdirSync(root, { recursive: true }); Object.values(CATEGORIES).forEach((category) => fs.mkdirSync(path.join(root, category, 'General'), { recursive: true })); fs.mkdirSync(path.join(root, 'AutoBackups'), { recursive: true }); }
function walkJson(root) { if (!fs.existsSync(root)) return []; return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walkJson(path.join(root, entry.name)) : entry.name.endsWith('.document.json') ? [path.join(root, entry.name)] : []); }
function companyPath() { return path.join(dataRoot(), '.document-studio-company.json'); }
function readCompany() { try { return { ...EMPTY_COMPANY, ...JSON.parse(fs.readFileSync(companyPath(), 'utf8')) }; } catch { return { ...EMPTY_COMPANY }; } }
function writeCompany(value) { const normalized = Object.fromEntries(Object.keys(EMPTY_COMPANY).map((key) => [key, String(value?.[key] ?? '')])); fs.writeFileSync(companyPath(), JSON.stringify(normalized, null, 2)); return normalized; }
function documentPaths(document) { const category = CATEGORIES[document.docType]; if (!category) throw new Error('Invalid category'); if (document.storagePath) { const json = path.resolve(dataRoot(), String(document.storagePath)); if (!json.startsWith(dataRoot() + path.sep)) throw new Error('Invalid document path'); return { json, pdf: json.replace(/\.document\.json$/, '.pdf') }; } const folder = document.folder ? withinRoot(category, document.folder) : withinRoot(category); const base = safePart(`${document.title}-${document.id}`); return { json: path.join(folder, `${base}.document.json`), pdf: path.join(folder, `${base}.pdf`) }; }
function saveStoredDocument(document, pdfData) { const files = documentPaths(document); fs.mkdirSync(path.dirname(files.json), { recursive: true }); const stored = { ...document, storagePath: path.relative(dataRoot(), files.json) }; fs.writeFileSync(files.json, JSON.stringify(stored, null, 2)); if (pdfData) fs.writeFileSync(files.pdf, decodeData(pdfData)); return stored; }
function validStoredDocument(file) { try { const document = JSON.parse(fs.readFileSync(file, 'utf8')); if (!CATEGORIES[document.docType]) return null; return { ...document, storagePath: path.relative(dataRoot(), file) }; } catch { return null; } }
function listStoredDocuments() { return walkJson(dataRoot()).flatMap((file) => { const document = validStoredDocument(file); return document ? [document] : []; }); }
function runBackupWorker(root, destination) {
  return new Promise((resolve, reject) => {
    const worker = fork(path.join(__dirname, 'backup-worker.cjs'), [root, destination], { stdio: 'pipe' });
    worker.stderr?.on('data', (data) => log(data.toString()));
    worker.on('error', reject);
    worker.on('exit', (code) => code === 0 ? resolve(destination) : reject(new Error(`Backup worker exited with code ${code}`)));
  });
}
async function createBackupFile(destination) {
  const root = dataRoot();
  await runBackupWorker(root, destination);
  writeSettings({ ...readSettings(), lastBackupAt: Date.now() });
  return destination;
}
function createAutoBackup() {
  if (global.autoBackupProcess) return null;
  const root = dataRoot();
  const folder = path.join(root, 'AutoBackups');
  fs.mkdirSync(folder, { recursive: true });
  const destination = path.join(folder, `Document-Studio-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`);
  global.autoBackupProcess = fork(path.join(__dirname, 'backup-worker.cjs'), [root, destination], { stdio: 'pipe' });
  global.autoBackupProcess.stderr?.on('data', (data) => log(data.toString()));
  global.autoBackupProcess.on('error', (error) => { log(error.message); global.autoBackupProcess = null; });
  global.autoBackupProcess.on('exit', (code) => {
    if (code === 0) writeSettings({ ...readSettings(), lastBackupAt: Date.now() });
    else log(`Automatic backup worker exited with code ${code}`);
    global.autoBackupProcess = null;
  });
  return destination;
}
function restoreZip(archive, root) { ensureWorkspace(root); const zip = new AdmZip(archive); for (const entry of zip.getEntries()) { const name = entry.entryName.replaceAll('\\', '/'); if (entry.isDirectory || name === 'backup-manifest.json' || name.startsWith('/') || name.includes('../')) continue; const destination = path.resolve(root, name); if (!destination.startsWith(path.resolve(root) + path.sep)) continue; fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, entry.getData()); } return walkJson(root).length; }
function installIpc() {
  ipcMain.handle('settings:get', () => readSettings());
  ipcMain.handle('settings:choose-root', async () => { const result = await dialog.showOpenDialog(win, { title: 'Choose Document Studio data folder', defaultPath: process.platform === 'win32' && fs.existsSync('D:\\') ? 'D:\\DocumentStudio' : app.getPath('documents'), properties: ['openDirectory', 'createDirectory'] }); return result.canceled ? null : result.filePaths[0]; });
  ipcMain.handle('settings:initialize', (_event, root) => { const resolved = path.resolve(String(root)); ensureWorkspace(resolved); return writeSettings({ initialized: true, dataRoot: resolved, lastBackupAt: null }); });
  ipcMain.handle('workspace:restore', async () => { const result = await dialog.showOpenDialog(win, { title: 'Restore Document Studio folder', properties: ['openDirectory'] }); if (result.canceled) return null; const root = path.resolve(result.filePaths[0]); ensureWorkspace(root); writeSettings({ initialized: true, dataRoot: root, lastBackupAt: null }); const documents = listStoredDocuments(); return { imported: documents.length, skipped: walkJson(root).length - documents.length, dataRoot: root }; });
  ipcMain.handle('workspace:restore-backup', async () => { const archive = await dialog.showOpenDialog(win, { title: 'Restore Document Studio backup', filters: [{ name: 'Document Studio Backup', extensions: ['zip'] }], properties: ['openFile'] }); if (archive.canceled) return null; const rootChoice = await dialog.showOpenDialog(win, { title: 'Choose restored workspace folder', properties: ['openDirectory', 'createDirectory'] }); if (rootChoice.canceled) return null; const root = path.resolve(rootChoice.filePaths[0]); const imported = restoreZip(archive.filePaths[0], root); writeSettings({ initialized: true, dataRoot: root, lastBackupAt: null }); return { imported, skipped: 0, dataRoot: root }; });
  ipcMain.handle('documents:list', () => listStoredDocuments());
  ipcMain.handle('documents:save', (_event, document, pdfData) => saveStoredDocument(document, pdfData));
  ipcMain.handle('documents:rename', (_event, document, title) => { const files = documentPaths(document); if (!fs.existsSync(files.json)) throw new Error('The saved document could not be found.'); const saved = { ...document, title: safePart(title), updatedAt: Date.now(), storagePath: path.relative(dataRoot(), files.json) }; fs.writeFileSync(files.json, JSON.stringify(saved, null, 2)); return saved; });
  ipcMain.handle('documents:delete', (_event, document) => { const files = documentPaths(document); for (const file of [files.json, files.pdf]) if (fs.existsSync(file)) fs.unlinkSync(file); });
  ipcMain.handle('folders:create', (_event, categoryKey, name) => { const category = CATEGORIES[categoryKey]; if (!category) throw new Error('Invalid category'); fs.mkdirSync(withinRoot(category, name), { recursive: true }); return fs.readdirSync(withinRoot(category), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(); });
  ipcMain.handle('folders:list', (_event, categoryKey) => { const category = CATEGORIES[categoryKey]; if (!category) throw new Error('Invalid category'); const root = withinRoot(category); fs.mkdirSync(root, { recursive: true }); return fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(); });
  ipcMain.handle('folders:rename', (_event, categoryKey, from, to) => { const category = CATEGORIES[categoryKey]; if (!category) throw new Error('Invalid category'); const source = withinRoot(category, from); const target = withinRoot(category, to); if (fs.existsSync(source) && !fs.existsSync(target)) fs.renameSync(source, target); return fs.readdirSync(withinRoot(category), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(); });
  ipcMain.handle('folders:delete', (_event, categoryKey, name) => { const category = CATEGORIES[categoryKey]; if (!category) throw new Error('Invalid category'); const target = withinRoot(category, name); if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true }); return fs.readdirSync(withinRoot(category), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(); });
  ipcMain.handle('printers:list', async () => {
    if (!win || win.isDestroyed()) return [];
    const printers = await win.webContents.getPrintersAsync();
    return printers.map((printer) => ({
      name: printer.name,
      displayName: printer.displayName,
      description: printer.description || '',
      options: printer.options || {},
    }));
  });
  ipcMain.handle('printers:settings', async (_event, deviceName) => {
    if (process.platform !== 'win32' || !deviceName) return false;
    try {
      const { spawn } = require('child_process');
      const child = spawn('rundll32.exe', ['printui.dll,PrintUIEntry', '/p', '/n', String(deviceName)], { windowsHide: true, stdio: 'ignore' });
      return await new Promise((resolve) => {
        child.once('error', () => resolve(false));
        child.once('exit', (code) => resolve(code === 0));
      });
    } catch { return false; }
  });
  ipcMain.handle('print:document', async (_event, options = {}) => {
    if (!win || win.isDestroyed()) return false;
    const pageSize = ['A4', 'A5', 'Letter', 'Legal'].includes(options.paperSize) ? options.paperSize : 'A4';
    const pageRanges = Array.isArray(options.pageRanges) && options.pageRanges.length ? options.pageRanges : undefined;
    const images = Array.isArray(options.images) ? options.images.filter((src) => typeof src === 'string' && src.startsWith('data:image/')) : [];

    // Print the exact captured document pages rather than the live editor DOM.
    // This prevents the editor zoom/layout from changing the physical print.
    if (images.length) {
      const printWindow = new BrowserWindow({
        show: false,
        width: options.landscape ? 1200 : 900,
        height: options.landscape ? 900 : 1200,
        webPreferences: { sandbox: true },
      });
      const gray = Boolean(options.gray);
      const mode = ['size', 'poster', 'multiple', 'booklet'].includes(options.mode) ? options.mode : 'size';
      const posterTiles = Math.min(4, Math.max(2, Number(options.posterTiles) || 2));
      const pageNodes = mode === 'poster'
        ? images.flatMap((src) => Array.from({ length: posterTiles * posterTiles }, (_, i) => {
            const row = Math.floor(i / posterTiles);
            const col = i % posterTiles;
            return `<section class="page poster-tile"><img src="${src}" style="width:${posterTiles * 100}%;height:${posterTiles * 100}%;left:-${col * 100}%;top:-${row * 100}%"></section>`;
          }))
        : images.map((src) => `<section class="page"><img src="${src}"></section>`);
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>
        @page{size:${pageSize}${options.landscape ? ' landscape' : ''};margin:0}
        *{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}
        .page{position:relative;width:${options.landscape ? '297mm' : '210mm'};height:${options.landscape ? '210mm' : '297mm'};display:flex;align-items:center;justify-content:center;overflow:hidden;break-after:page;page-break-after:always;background:#fff}
        .page:last-child{break-after:auto;page-break-after:auto}
        .page>img{display:block;width:${mode === 'size' ? Math.min(96, Math.max(10, Number(options.scaleFactor) || 100)) : 100}%;height:${mode === 'size' ? Math.min(96, Math.max(10, Number(options.scaleFactor) || 100)) : 100}%;object-fit:fill;filter:${gray ? 'grayscale(1)' : 'none'}}
        .poster-tile{position:relative;align-items:flex-start;justify-content:flex-start}
        .poster-tile>img{position:absolute;max-width:none;object-fit:fill}
      </style></head><body>${pageNodes.join('')}</body></html>`;
      try {
        await printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
        await printWindow.webContents.executeJavaScript(`
          Promise.all(Array.from(document.images).map((img) => img.complete
            ? Promise.resolve()
            : new Promise((resolve) => { img.addEventListener('load', resolve, { once: true }); img.addEventListener('error', resolve, { once: true }); })))
        `);
        await new Promise((resolve) => setTimeout(resolve, 180));
        const printOptions = {
          silent: Boolean(options.silent),
          deviceName: typeof options.deviceName === 'string' ? options.deviceName : undefined,
          printBackground: true,
          color: gray ? false : true,
          landscape: Boolean(options.landscape),
          margins: { marginType: 'none' },
          scaleFactor: Math.min(200, Math.max(25, Number(options.scaleFactor) || 100)),
          pagesPerSheet: mode === 'size' || mode === 'poster' ? 1 : mode === 'booklet' ? 2 : ([1, 2, 4, 6, 9, 16].includes(Number(options.pagesPerSheet)) ? Number(options.pagesPerSheet) : 1),
          collate: true,
          copies: Math.min(999, Math.max(1, Number(options.copies) || 1)),
          pageRanges: mode === 'poster' ? undefined : pageRanges,
          duplexMode: mode === 'booklet' ? 'shortEdge' : options.duplex === 'shortEdge' || options.duplex === 'longEdge' ? options.duplex : 'simplex',
          pageSize,
          usePrinterDefaultPageSize: false,
        };
        return await new Promise((resolve) => {
          printWindow.webContents.print(printOptions, (success) => {
            resolve(Boolean(success));
            setTimeout(() => { if (!printWindow.isDestroyed()) printWindow.close(); }, 300);
          });
        });
      } catch {
        if (!printWindow.isDestroyed()) printWindow.close();
        return false;
      }
    }

    const printOptions = {
      silent: Boolean(options.silent),
      deviceName: typeof options.deviceName === 'string' ? options.deviceName : undefined,
      printBackground: true,
      color: options.gray ? false : true,
      landscape: Boolean(options.landscape),
      margins: { marginType: 'none' },
      scaleFactor: Math.min(200, Math.max(25, Number(options.scaleFactor) || 100)),
      pagesPerSheet: [1, 2, 4, 6, 9, 16].includes(Number(options.pagesPerSheet)) ? Number(options.pagesPerSheet) : 1,
      collate: true,
      copies: Math.min(999, Math.max(1, Number(options.copies) || 1)),
      pageRanges,
      duplexMode: options.duplex === 'shortEdge' || options.duplex === 'longEdge' ? options.duplex : 'simplex',
      pageSize,
      usePrinterDefaultPageSize: false,
    };
    return new Promise((resolve) => {
      win.webContents.print(printOptions, (success) => resolve(Boolean(success)));
    });
  });
  ipcMain.handle('pdf:save-as', async (_event, name, data) => {
    // PDF Save As is deliberately independent from the Document Studio data root.
    // The user must remain free to choose Documents, D:, E:, USB storage, etc.
    // On Windows, pass the initial directory separately from the suggested file
    // name. This avoids native Save As resolving a non-existent default file as
    // an invalid path on some installed Windows configurations.
    const documentsDir = app.getPath('documents');
    const suggestedName = safePart(name).toLowerCase().endsWith('.pdf') ? safePart(name) : `${safePart(name)}.pdf`;
    const initialDirectory = fs.existsSync(documentsDir) ? documentsDir : app.getPath('home');

    let result;
    try {
      result = await dialog.showSaveDialog(win, {
        title: 'Save PDF',
        defaultPath: path.join(initialDirectory, suggestedName),
        buttonLabel: 'Save',
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
    } catch (error) {
      // If the native dialog rejects its initial directory, retry once with only
      // the suggested filename so Windows can choose its normal save location.
      log(`PDF Save dialog retry: ${error.message}`);
      result = await dialog.showSaveDialog(win, {
        title: 'Save PDF',
        defaultPath: suggestedName,
        buttonLabel: 'Save',
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
    }

    if (result.canceled || !result.filePath) return false;

    const selectedPath = result.filePath.toLowerCase().endsWith('.pdf') ? result.filePath : `${result.filePath}.pdf`;
    const bytes = decodeData(data);

    try {
      fs.mkdirSync(path.dirname(selectedPath), { recursive: true });
      // Write directly to the user-selected destination. Using a temporary
      // rename on Windows can make the native Save dialog report "File not found"
      // when the destination already exists or is on a removable/network drive.
      fs.writeFileSync(selectedPath, bytes, { flag: 'w' });
      if (!fs.existsSync(selectedPath)) throw new Error('The PDF file was not created.');
      return true;
    } catch (error) {
      log(`PDF save failed: ${error.message} | target=${selectedPath}`);
      await dialog.showMessageBox(win, {
        type: 'error',
        title: 'PDF Save Error',
        message: 'The PDF could not be saved to this location.',
        detail: String(error.message || 'Unknown file-system error'),
      });
      return false;
    }
  });
  ipcMain.handle('pdf:export-current', async (_event, name, docType, paperSize, landscape = false, scale = 100, pageRange = '') => {
    if (!win || win.isDestroyed()) return false;
    let defaultPath = safePart(name);
    try { const category = CATEGORIES[docType]; if (category) defaultPath = path.join(withinRoot(category), safePart(name)); } catch {}
    const result = await dialog.showSaveDialog(win, { defaultPath, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (result.canceled || !result.filePath) return false;
    const validSize = ['A4', 'A5', 'Letter', 'Legal'].includes(paperSize) ? paperSize : 'A4';
    const data = await win.webContents.printToPDF({
      landscape: Boolean(landscape),
      printBackground: true,
      scale: Math.min(2, Math.max(0.25, Number(scale) / 100 || 1)),
      pageSize: validSize,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      pageRanges: typeof pageRange === 'string' ? pageRange : '',
      preferCSSPageSize: false,
      displayHeaderFooter: false,
    });
    fs.mkdirSync(path.dirname(result.filePath), { recursive: true });
    fs.writeFileSync(result.filePath, data);
    return true;
  });
  ipcMain.handle('zip:save-as', async (_event, name, data) => { const result = await dialog.showSaveDialog(win, { defaultPath: safePart(name), filters: [{ name: 'ZIP archive', extensions: ['zip'] }] }); if (result.canceled || !result.filePath) return false; fs.writeFileSync(result.filePath, decodeData(data)); return true; });
  ipcMain.handle('settings:base-path', () => { try { return dataRoot(); } catch { return null; } });
  ipcMain.handle('pdf:save-to-library', (_event, docType, folder, fileName, data) => { const category = CATEGORIES[docType]; if (!category) throw new Error('Invalid category'); const directory = folder ? withinRoot(category, folder) : withinRoot(category); fs.mkdirSync(directory, { recursive: true }); const file = path.join(directory, `${safePart(String(fileName).replace(/\.pdf$/i, ''))}.pdf`); fs.writeFileSync(file, decodeData(data)); return file; });
  ipcMain.handle('pdf:export-selected', async (_event, ids, from, to) => { const result = await dialog.showSaveDialog(win, { defaultPath: 'Document-Studio-PDFs.zip', filters: [{ name: 'ZIP archive', extensions: ['zip'] }] }); if (result.canceled || !result.filePath) return 0; const selected = new Set(Array.isArray(ids) ? ids.map(String) : []); const zip = new AdmZip(); let count = 0; for (const doc of listStoredDocuments()) { if (!selected.has(doc.id) || (from && doc.updatedAt < from) || (to && doc.updatedAt > to)) continue; const pdf = documentPaths(doc).pdf; if (fs.existsSync(pdf)) { zip.addLocalFile(pdf, path.join(CATEGORIES[doc.docType], doc.folder || 'General')); count++; } } if (count) zip.writeZip(result.filePath); return count; });
  ipcMain.handle('workspace:backup', async () => {
    const result = await dialog.showSaveDialog(win, { defaultPath: `Document-Studio-Backup-${new Date().toISOString().slice(0, 10)}.zip`, filters: [{ name: 'Document Studio Backup', extensions: ['zip'] }] });
    return result.canceled || !result.filePath ? null : createBackupFile(result.filePath);
  });
  ipcMain.handle('company:get', () => readCompany());
  ipcMain.handle('company:save', (_event, details) => writeCompany(details));
  ipcMain.handle('company:update-previous', (_event, details) => listStoredDocuments().map((document) => saveStoredDocument({ ...document, state: { ...document.state, footer: { address: details.address, phone: details.phone, email: details.email }, terms: details.terms }, updatedAt: Date.now() })));
}
function startServer() { serverProcess = fork(getServerEntry(), [], { env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' }, stdio: 'pipe' }); serverProcess.stderr?.on('data', (data) => log(data.toString())); }
function waitForServer(url, callback, attempts = 60) { http.get(url, callback).on('error', () => attempts > 0 ? setTimeout(() => waitForServer(url, callback, attempts - 1), 250) : log('Server did not respond')); }
let splashWin;

function createSplashWindow() {
  splashWin = new BrowserWindow({
    width: 1440,
    height: 900,
    frame: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    show: true,
    backgroundColor: '#000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  splashWin.loadFile(path.join(__dirname, 'splash.html'));
}

function createWindow() {
  const iconPath = path.join(__dirname, 'electron', 'icon.ico');

  // The real application window uses the normal Windows frame. It stays hidden
  // while the black borderless splash window is displayed.
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 650,
    show: false,
    title: 'Document Studio',
    backgroundColor: '#ffffff',
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      sandbox: true
    }
  });

  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${PORT}`)) event.preventDefault();
  });

  waitForServer(`http://127.0.0.1:${PORT}`, () => win.loadURL(`http://127.0.0.1:${PORT}`));

  win.once('ready-to-show', () => {
    // Keep the real application window hidden while the frameless black
    // splash is visible. The Windows title bar appears only after startup.
    setTimeout(() => {
      if (!win || win.isDestroyed()) return;
      win.show();
      if (splashWin && !splashWin.isDestroyed()) splashWin.close();
      splashWin = null;
    }, 3100);
  });
}
if (!app.requestSingleInstanceLock()) app.quit(); else { app.whenReady().then(() => { Menu.setApplicationMenu(null); installIpc(); startServer(); createSplashWindow(); createWindow(); const settings = readSettings(); if (settings.initialized && settings.dataRoot && (!settings.lastBackupAt || Date.now() - settings.lastBackupAt >= 30 * 86400000)) setTimeout(() => { try { createAutoBackup(); } catch (error) { log(error.message); } }, 10000); }); app.on('window-all-closed', () => { serverProcess?.kill(); if (process.platform !== 'darwin') app.quit(); }); }
