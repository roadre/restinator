const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('restinator', {
  openFile: () => ipcRenderer.invoke('file:open'),
  openPath: (filePath) => ipcRenderer.invoke('file:openPath', filePath),
  loadStartup: (defaultContent) => ipcRenderer.invoke('file:loadStartup', defaultContent),
  writeFile: (filePath, content) => ipcRenderer.invoke('file:write', { filePath, content }),
  saveFile: (filePath, content) => ipcRenderer.invoke('file:save', { filePath, content }),
  saveFileAs: (content, defaultPath) =>
    ipcRenderer.invoke('file:saveAs', { content, defaultPath }),
  confirmUnsaved: (action) => ipcRenderer.invoke('dialog:unsaved', { action }),
  setTitle: (title) => ipcRenderer.invoke('window:setTitle', title),
  sendRequest: (request) => ipcRenderer.invoke('http:send', request),
  copyText: (text) => ipcRenderer.invoke('clipboard:write', text),
  getTheme: () => ipcRenderer.invoke('prefs:theme'),
  getChrome: () => ipcRenderer.invoke('prefs:chrome'),
  setTheme: (theme) => ipcRenderer.invoke('prefs:set-theme', theme),
  setWrap: (wrap) => ipcRenderer.invoke('prefs:set-wrap', wrap),
  setHideSecrets: (hide) => ipcRenderer.invoke('prefs:set-hide-secrets', hide),
  onMenuChrome: (cb) => ipcRenderer.on('menu:chrome', (_event, chrome) => cb(chrome)),
  onMenuOpen: (cb) => ipcRenderer.on('menu:open', cb),
  onMenuNew: (cb) => ipcRenderer.on('menu:new', cb),
  onMenuOpenRecent: (cb) =>
    ipcRenderer.on('menu:open-recent', (_event, filePath) => cb(filePath)),
  onMenuSave: (cb) => ipcRenderer.on('menu:save', cb),
  onMenuSaveAs: (cb) => ipcRenderer.on('menu:save-as', cb),
  onMenuSubmit: (cb) => ipcRenderer.on('menu:submit', cb),
  onMenuCopyCurl: (cb) => ipcRenderer.on('menu:copy-curl', cb),
  onMenuCopyExchange: (cb) => ipcRenderer.on('menu:copy-exchange', cb),
  onMenuCopyResponse: (cb) => ipcRenderer.on('menu:copy-response', cb),
  onMenuHideSecrets: (cb) =>
    ipcRenderer.on('menu:hide-secrets', (_event, hide) => cb(hide)),
  onMenuWrap: (cb) => ipcRenderer.on('menu:wrap', (_event, wrap) => cb(wrap)),
  onMenuTheme: (cb) => ipcRenderer.on('menu:theme', (_event, theme) => cb(theme)),
  onMenuTab: (cb) => ipcRenderer.on('menu:tab', (_event, tab) => cb(tab)),
  onMenuStatement: (cb) =>
    ipcRenderer.on('menu:statement', (_event, direction) => cb(direction)),
  onMenuTemplate: (cb) =>
    ipcRenderer.on('menu:template', (_event, id) => cb(id)),
  onAutosaveAndQuit: (cb) => ipcRenderer.on('app:autosave-and-quit', cb),
  finishQuit: () => ipcRenderer.invoke('app:finish-quit'),
  cancelQuit: () => ipcRenderer.invoke('app:cancel-quit')
});
