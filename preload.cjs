const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  chooseDataRoot: () => ipcRenderer.invoke('settings:choose-root'),
  initialize: (dataRoot) => ipcRenderer.invoke('settings:initialize', dataRoot),
  restore: () => ipcRenderer.invoke('workspace:restore'),
  listDocuments: () => ipcRenderer.invoke('documents:list'),
  saveDocument: (document, pdfData) => ipcRenderer.invoke('documents:save', document, pdfData),
  deleteDocument: (document) => ipcRenderer.invoke('documents:delete', document),
  createFolder: (category, name) => ipcRenderer.invoke('folders:create', category, name),
  savePdf: (name, data) => ipcRenderer.invoke('pdf:save-as', name, data),
  exportSelected: (ids) => ipcRenderer.invoke('pdf:export-selected', ids),
  backup: (from, to) => ipcRenderer.invoke('workspace:backup', from, to),
});