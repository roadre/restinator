const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('restinator', {
  openFile: () => ipcRenderer.invoke('file:open'),
  openPath: (filePath) => ipcRenderer.invoke('file:openPath', filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke('file:save', { filePath, content }),
  saveFileAs: (content, defaultPath) =>
    ipcRenderer.invoke('file:saveAs', { content, defaultPath }),
  confirmUnsaved: (action) => ipcRenderer.invoke('dialog:unsaved', { action }),
  setTitle: (title) => ipcRenderer.invoke('window:setTitle', title),
  allowClose: () => ipcRenderer.invoke('app:allow-close'),
  sendRequest: (request) => ipcRenderer.invoke('http:send', request),
  copyText: (text) => ipcRenderer.invoke('clipboard:write', text),
  onMenuOpen: (cb) => ipcRenderer.on('menu:open', cb),
  onMenuOpenRecent: (cb) =>
    ipcRenderer.on('menu:open-recent', (_event, filePath) => cb(filePath)),
  onMenuSave: (cb) => ipcRenderer.on('menu:save', cb),
  onMenuSaveAs: (cb) => ipcRenderer.on('menu:save-as', cb),
  onMenuSubmit: (cb) => ipcRenderer.on('menu:submit', cb),
  onMenuWrap: (cb) => ipcRenderer.on('menu:wrap', (_event, wrap) => cb(wrap)),
  onMenuTab: (cb) => ipcRenderer.on('menu:tab', (_event, tab) => cb(tab)),
  onCloseRequested: (cb) => ipcRenderer.on('app:close-requested', cb)
});
