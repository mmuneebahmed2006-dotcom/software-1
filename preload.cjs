const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  chooseDataRoot: () => ipcRenderer.invoke('settings:choose-root'),
  initialize: (dataRoot) => ipcRenderer.invoke('settings:initialize', dataRoot),
  restore: () => ipcRenderer.invoke('workspace:restore'),
  restoreBackup: () => ipcRenderer.invoke('workspace:restore-backup'),
  listDocuments: () => ipcRenderer.invoke('documents:list'),
  saveDocument: (document, pdfData) => ipcRenderer.invoke('documents:save', document, pdfData),
  renameDocument: (document, title) => ipcRenderer.invoke('documents:rename', document, title),
  deleteDocument: (document) => ipcRenderer.invoke('documents:delete', document),
  createFolder: (category, name) => ipcRenderer.invoke('folders:create', category, name),
  listFolders: (category) => ipcRenderer.invoke('folders:list', category),
  savePdf: (name, data) => ipcRenderer.invoke('pdf:save-as', name, data),
  exportSelected: (ids, from, to) => ipcRenderer.invoke('pdf:export-selected', ids, from, to),
  backup: () => ipcRenderer.invoke('workspace:backup'),
  getCompanyDetails: () => ipcRenderer.invoke('company:get'),
  saveCompanyDetails: (details) => ipcRenderer.invoke('company:save', details),
  updatePreviousCompanyDetails: (details) => ipcRenderer.invoke('company:update-previous', details),
});