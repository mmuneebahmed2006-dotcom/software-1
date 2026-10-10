const { app, BrowserWindow, Menu, dialog, ipcMain, shell, powerMonitor, screen } = require('electron');
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
const installerRoot = () => { for (const file of [path.join(app.getPath('userData'), 'data-root.txt'), path.join(path.dirname(app.getPath('exe')), 'data-root.txt')]) { try { const value = fs.readFileSync(file, 'utf8').trim().replace(/^\\ufeff/, ''); if (value) return path.resolve(value); } catch {} } return null; };
const defaultWorkspaceRoot = () => path.join(app.getPath('userData'), 'workspace');
const isLegacyDocumentsWorkspace = (candidate) => {
  try {
    const documents = path.resolve(app.getPath('documents'));
    const target = path.resolve(candidate);
    return target === path.join(documents, 'Document Studio');
  } catch { return false; }
};
const migrateLegacyWorkspace = (source) => {
  const target = defaultWorkspaceRoot();
  if (!source || !fs.existsSync(source) || path.resolve(source) === path.resolve(target)) return target;
  try {
    if (!fs.existsSync(target)) fs.cpSync(source, target, { recursive: true });
  } catch (error) {
    log(`Workspace migration failed: ${error.message}`);
  }
  return target;
};
const readSettings = () => {
  let stored = {};
  try { stored = JSON.parse(fs.readFileSync(settingsPath(), 'utf8')); } catch {}
  const base = { initialized: false, dataRoot: null, lastBackupAt: null, ...stored };
  if (base.dataRoot) {
    if (isLegacyDocumentsWorkspace(base.dataRoot)) {
      const target = migrateLegacyWorkspace(base.dataRoot);
      try { ensureWorkspace(target); return writeSettings({ ...base, initialized: true, dataRoot: target }); } catch {}
    }
    return base;
  }
  const chosen = installerRoot();
  if (chosen && !isLegacyDocumentsWorkspace(chosen)) {
    try {
      const target = path.resolve(chosen);
      ensureWorkspace(target);
      return writeSettings({ ...base, initialized: true, dataRoot: target });
    } catch {}
  }
  try {
    const target = defaultWorkspaceRoot();
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
function ensureWorkspace(root) {
  fs.mkdirSync(root, { recursive: true });
  for (const category of Object.values(CATEGORIES)) {
    const categoryPath = path.join(root, category);
    fs.mkdirSync(categoryPath, { recursive: true });
    // Remove only an empty legacy default; preserve any user documents inside it.
    const legacyGeneral = path.join(categoryPath, 'General');
    try { if (fs.statSync(legacyGeneral).isDirectory() && fs.readdirSync(legacyGeneral).length === 0) fs.rmdirSync(legacyGeneral); } catch {}
  }
  fs.mkdirSync(path.join(root, 'AutoBackups'), { recursive: true });
}
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
  ipcMain.handle('documents:delete', async (_event, document) => {
    let files = documentPaths(document);
    // A folder move can make an already-open card carry an old storagePath.
    // Resolve the current record by id before deciding that deletion succeeded.
    if (!fs.existsSync(files.json)) {
      const current = listStoredDocuments().find((entry) => entry.id === document?.id);
      if (!current) throw new Error('The saved document could not be found.');
      files = documentPaths(current);
    }
    await fs.promises.unlink(files.json);
    try { await fs.promises.unlink(files.pdf); }
    catch (error) { if (error?.code !== 'ENOENT') throw error; }
    return true;
  });
  ipcMain.handle('folders:create', (_event, categoryKey, name) => {
    const category = CATEGORIES[categoryKey];
    const cleanName = String(name ?? '').trim();
    if (!category || !cleanName || cleanName.toLowerCase() === 'general') throw new Error('Enter a valid folder name.');
    fs.mkdirSync(withinRoot(category, cleanName), { recursive: true });
    return fs.readdirSync(withinRoot(category), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).filter((entry) => entry.toLowerCase() !== 'general').sort();
  });
  ipcMain.handle('folders:list', (_event, categoryKey) => {
    const category = CATEGORIES[categoryKey];
    if (!category) throw new Error('Invalid category');
    const root = withinRoot(category);
    fs.mkdirSync(root, { recursive: true });
    return fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).filter((entry) => entry.toLowerCase() !== 'general').sort();
  });
  ipcMain.handle('folders:rename', (_event, categoryKey, from, to) => {
    const category = CATEGORIES[categoryKey];
    const cleanTo = String(to ?? '').trim();
    if (!category || !cleanTo || cleanTo.toLowerCase() === 'general') throw new Error('Enter a valid folder name.');
    const source = withinRoot(category, from);
    const target = withinRoot(category, cleanTo);
    if (!fs.existsSync(source) || (fs.existsSync(target) && path.resolve(source) !== path.resolve(target))) throw new Error('The folder could not be renamed.');
    if (path.resolve(source) !== path.resolve(target)) fs.renameSync(source, target);
    for (const file of walkJson(target)) {
      const document = validStoredDocument(file);
      if (document?.docType && CATEGORIES[document.docType] === category && document.folder === from) {
        fs.writeFileSync(file, JSON.stringify({ ...document, folder: cleanTo }, null, 2));
      }
    }
    return fs.readdirSync(withinRoot(category), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).filter((entry) => entry.toLowerCase() !== 'general').sort();
  });
  ipcMain.handle('folders:delete', (_event, categoryKey, name) => {
    const category = CATEGORIES[categoryKey];
    if (!category) throw new Error('Invalid category');
    const target = withinRoot(category, name);
    if (!fs.existsSync(target)) throw new Error('The folder could not be found.');
    // Folder deletion intentionally removes saved JSON/PDF files in that folder,
    // matching the confirmation shown in the UI.
    fs.rmSync(target, { recursive: true, force: true });
    return fs.readdirSync(withinRoot(category), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).filter((entry) => entry.toLowerCase() !== 'general').sort();
  });
  let printerListCache = { at: 0, printers: [] };
  ipcMain.handle('printers:list', async () => {
    if (!win || win.isDestroyed()) return printerListCache.printers;
    const now = Date.now();
    if (now - printerListCache.at < 15000) return printerListCache.printers;
    try {
      const printers = await win.webContents.getPrintersAsync();
      printerListCache = {
        at: now,
        printers: printers.map((printer) => ({
          name: String(printer.name || ''),
          displayName: String(printer.displayName || printer.name || ''),
          description: printer.description || '',
          options: printer.options || {},
          isDefault: Boolean(printer.isDefault),
          status: 'ready',
        })).filter((printer) => printer.name),
      };
      return printerListCache.printers;
    } catch (error) {
      log('Native printer enumeration failed: ' + error.message);
      return printerListCache.printers;
    }
  });
  ipcMain.handle('printers:settings', async (_event, deviceName) => {
    if (process.platform !== 'win32' || !deviceName) return false;
    try {
      const { spawn } = require('child_process');
      spawn('rundll32.exe', ['printui.dll,PrintUIEntry', '/e', '/n', String(deviceName)], { windowsHide: true, stdio: 'ignore', detached: true }).unref();
      return true;
    } catch (error) { log('Printer settings failed: ' + error.message); return false; }
  });
  ipcMain.handle('print:pdf', async (_event, data, options = {}) => {
    const payload = String(data || '');
    if (!payload.startsWith('data:application/pdf;base64,')) {
      return { success: false, failureReason: 'The print PDF is invalid.' };
    }
    const bytes = decodeData(payload);
    if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      return { success: false, failureReason: 'The print PDF is invalid.' };
    }
    const os = require('os');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docstudio-print-pdf-'));
    const file = path.join(tempDir, 'document.pdf');
    fs.writeFileSync(file, bytes);
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    const cleanup = () => {
      try { if (!printWindow.isDestroyed()) printWindow.close(); } catch {}
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    };
    try {
      await printWindow.loadFile(file);
      // Chromium's built-in PDF viewer finishes painting shortly after the file
      // load event. Wait before handing the PDF page to the printer pipeline.
      await printWindow.webContents.executeJavaScript('new Promise(resolve => setTimeout(resolve, 700))');
      const deviceName = options.deviceName ? String(options.deviceName) : '';
      const paperSize = ['A4', 'A5', 'Letter', 'Legal'].includes(options.paperSize) ? options.paperSize : 'A4';
      const settings = {
        silent: true,
        ...(deviceName ? { deviceName } : {}),
        printBackground: true,
        color: !Boolean(options.gray),
        landscape: Boolean(options.landscape),
        pageSize: paperSize,
        pagesPerSheet: 1,
        scaleFactor: 100,
        margins: { marginType: 'none' },
        copies: Math.min(999, Math.max(1, Number(options.copies) || 1)),
        duplexMode: ['simplex', 'shortEdge', 'longEdge'].includes(options.duplex) ? options.duplex : 'simplex',
        ...(options.dpi ? { dpi: { horizontal: Number(options.dpi), vertical: Number(options.dpi) } } : {}),
      };
      const result = await new Promise((resolve) => {
        try {
          printWindow.webContents.print(settings, (success, failureReason) => {
            resolve({ success, failureReason: String(failureReason || '') });
          });
        } catch (error) {
          resolve({ success: false, failureReason: String(error?.message || error) });
        }
      });
      log(`PDF print ${result.success ? 'accepted' : 'rejected'} | printer=${deviceName || '(default)'} | paper=${paperSize} | landscape=${Boolean(options.landscape)} | reason=${result.failureReason}`);
      return { ...result, printer: deviceName, failureReason: result.success ? '' : (result.failureReason || 'Windows rejected the PDF print job.') };
    } catch (error) {
      log('PDF print failed: ' + error.message);
      return { success: false, failureReason: String(error.message || error) };
    } finally {
      setTimeout(cleanup, 1500);
    }
  });
  ipcMain.handle('print:document', async (_event, options = {}) => {
    const { pageRangeIndices, buildPrintHtml } = await import('./print-layout.mjs');
    const PAPER_MM = { A4: [210, 297], A5: [148, 210], Letter: [215.9, 279.4], Legal: [215.9, 355.6] };
    const pageSize = PAPER_MM[options.paperSize] ? options.paperSize : 'A4';
    const landscape = Boolean(options.landscape);
    const all = Array.isArray(options.images) ? options.images.filter((v) => typeof v === 'string' && v.startsWith('data:image/')) : [];
    if (!all.length) return { success: false, failureReason: 'Nothing to print.' };
    const indices = pageRangeIndices(all.length, options.pageRanges);
    const images = indices.map((index) => all[index]);
    if (!images.length) return { success: false, failureReason: 'The selected page range is empty.' };
    const sizing = ['fit', 'actual', 'custom', 'shrink'].includes(options.sizing) ? options.sizing : 'fit';
    const scale = Math.min(400, Math.max(10, Number(options.scaleFactor) || 100)) / 100;
    const gray = Boolean(options.gray);
    const html = buildPrintHtml({ ...options, paperSize: pageSize, landscape, sizing, scaleFactor: scale * 100, gray }, images);

    const os = require('os');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docstudio-print-'));
    const file = path.join(tempDir, 'print.html');
    fs.writeFileSync(file, html);
    const printWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
    const cleanup = () => { try { if (!printWindow.isDestroyed()) printWindow.close(); } catch {} try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {} };
    try {
      await printWindow.loadFile(file);
      await printWindow.webContents.executeJavaScript('Promise.all(Array.from(document.images, image => image.decode().catch(() => undefined)))');
      let deviceName = options.deviceName ? String(options.deviceName) : '';
      if (!deviceName) {
        try { const list = await printWindow.webContents.getPrintersAsync(); deviceName = (list.find((p) => p.isDefault) || list[0] || {}).name || ''; } catch {}
      }
      const duplexMode = ['simplex', 'shortEdge', 'longEdge'].includes(options.duplex) ? options.duplex : 'simplex';
      // Prefer the standard media name so Windows can match the job to the
      // printer's real A4/A5/Letter/Legal form. A custom micron-sized form can
      // be accepted by a driver but then silently scaled/centered as an
      // unsupported media size.
      const [paperWidthMm, paperHeightMm] = PAPER_MM[pageSize] || PAPER_MM.A4;
      const pageSizeMicrons = { width: Math.round(paperWidthMm * 1000), height: Math.round(paperHeightMm * 1000) };
      // Each generated HTML sheet already has the selected paper dimensions
      // and its printable-area inset. Keep Electron and the driver on that same
      // paper and prevent the printer's saved N-up/scaling defaults from shrinking it.
      const base = {
        // Send directly to the selected printer using its saved driver preferences.
        // Electron's portable controls are pageSize, landscape, and zero margins;
        // borderless media must be enabled in the printer driver's saved defaults.
        silent: true,
        ...(deviceName ? { deviceName } : {}),
        printBackground: true,
        color: !gray,
        landscape,
        pageSize,
        pagesPerSheet: 1,
        scaleFactor: 100,
        margins: { marginType: 'none' },
        copies: Math.min(999, Math.max(1, Number(options.copies) || 1)),
        ...(options.dpi ? { dpi: { horizontal: Number(options.dpi), vertical: Number(options.dpi) } } : {}),
      };
      const full = { ...base, duplexMode };
      const submit = (settings) => new Promise((resolve) => {
        try { printWindow.webContents.print(settings, (success, failureReason) => resolve({ success, failureReason: String(failureReason || '') })); }
        catch (error) { resolve({ success: false, failureReason: String(error && error.message ? error.message : error) }); }
      });
      let result = await submit(full);
      if (!result.success && result.failureReason !== 'cancelled') {
        log('Print retry with minimal options | reason=' + result.failureReason);
        result = await submit(base);
      }
      if (!result.success && result.failureReason !== 'cancelled') {
        log('Print retry with exact paper dimensions | reason=' + result.failureReason);
        result = await submit({ ...base, pageSize: pageSizeMicrons });
      }
      log(`Print ${result.success ? 'accepted' : 'rejected'} | printer=${deviceName || '(dialog)'} | paper=${pageSize} (${pageSizeMicrons.width}x${pageSizeMicrons.height}um) | landscape=${landscape} | sizing=${sizing} | scale=${scale} | reason=${result.failureReason}`);
      if (!result.success && result.failureReason === 'cancelled') return { success: false, cancelled: true, failureReason: '' };
      return { success: result.success, printer: deviceName, failureReason: result.success ? '' : (result.failureReason || 'Windows rejected the print job.') };
    } catch (error) {
      log('Print failed: ' + error.message);
      return { success: false, failureReason: String(error.message || error) };
    } finally {
      setTimeout(cleanup, 1500);
    }
  });
  ipcMain.handle('pdf:save-as', async (_event, name, data, docType) => {
    if (!win || win.isDestroyed()) return false;
    let suggestedName = safePart(String(name || 'Document').replace(/\.pdf$/i, '')) + '.pdf';
    try { const category = CATEGORIES[docType]; if (category) suggestedName = path.join(withinRoot(category), suggestedName); } catch {}
    let result;
    try {
      result = await dialog.showSaveDialog(win, { title: 'Save PDF', defaultPath: suggestedName, buttonLabel: 'Save', filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    } catch (error) {
      log(`PDF Save dialog retry: ${error.message}`);
      result = await dialog.showSaveDialog(win, {
        title: 'Save PDF',
        defaultPath: path.basename(suggestedName),
        buttonLabel: 'Save',
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
    }

    if (result.canceled || !result.filePath) return false;

    const selectedPath = result.filePath.toLowerCase().endsWith('.pdf') ? result.filePath : `${result.filePath}.pdf`;
    const bytes = decodeData(data);

    try {
      // Use async filesystem calls so large PDFs do not block Electron's main
      // process while the selected destination directory is being prepared.
      await fs.promises.mkdir(path.dirname(selectedPath), { recursive: true });
      await fs.promises.writeFile(selectedPath, bytes);
      const savedFile = await fs.promises.stat(selectedPath);
      if (!savedFile.isFile() || savedFile.size === 0) throw new Error('The PDF file was not created.');
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
  const { width: displayWidth, height: displayHeight } = screen.getPrimaryDisplay().workAreaSize;
  splashWin = new BrowserWindow({
    width: Math.min(1440, displayWidth),
    height: Math.min(900, displayHeight),
    center: true,
    useContentSize: true,
    frame: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    show: true,
    backgroundColor: '#0b0b0b',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  void splashWin.loadFile(path.join(__dirname, 'splash.html')).catch((error) => {
    log(`Splash screen failed to load: ${error.message}`);
    if (splashWin && !splashWin.isDestroyed()) splashWin.close();
    splashWin = null;
  });
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
function scheduleAutomaticBackup() {
  const run = () => {
    if (!win || win.isDestroyed()) return;
    try {
      if (powerMonitor.getSystemIdleTime() < 30) {
        setTimeout(run, 60 * 1000);
        return;
      }
      createAutoBackup();
    } catch (error) {
      log(error.message);
    }
  };
  setTimeout(run, 5 * 60 * 1000);
}

if (!app.requestSingleInstanceLock()) app.quit(); else { app.whenReady().then(() => { Menu.setApplicationMenu(null); installIpc(); startServer(); createSplashWindow(); createWindow(); const settings = readSettings(); if (settings.initialized && settings.dataRoot && (!settings.lastBackupAt || Date.now() - settings.lastBackupAt >= 30 * 86400000)) scheduleAutomaticBackup(); }); app.on('window-all-closed', () => { serverProcess?.kill(); if (process.platform !== 'darwin') app.quit(); }); }