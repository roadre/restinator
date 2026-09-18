const { app, BrowserWindow, Menu, dialog, ipcMain, clipboard } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { sendHttpRequest } = require('./http-client');

const RECENTS_MAX = 15;

let mainWindow;
let allowClose = false;
let wrapText = false;

function recentsFile() {
  return path.join(app.getPath('userData'), 'recent-files.json');
}

async function loadRecents() {
  try {
    const parsed = JSON.parse(await fs.readFile(recentsFile(), 'utf8'));
    if (Array.isArray(parsed)) {
      recents = parsed.filter((item) => typeof item === 'string').slice(0, RECENTS_MAX);
    }
  } catch {
    recents = [];
  }
}

async function persistRecents() {
  await fs.mkdir(path.dirname(recentsFile()), { recursive: true });
  await fs.writeFile(recentsFile(), JSON.stringify(recents, null, 2), 'utf8');
}

async function rememberFile(filePath) {
  if (!filePath) return;
  const resolved = path.resolve(filePath);
  recents = [resolved, ...recents.filter((item) => item !== resolved)].slice(0, RECENTS_MAX);
  await persistRecents();
  buildMenu();
}

async function removeRecent(filePath) {
  recents = recents.filter((item) => item !== filePath);
  await persistRecents();
  buildMenu();
}

function recentMenuItems() {
  if (recents.length === 0) {
    return [{ label: 'No Recent Files', enabled: false }];
  }
  return recents.map((filePath) => ({
    label: `${path.basename(filePath)} — ${path.dirname(filePath)}`,
    toolTip: filePath,
    click: () => sendMenu('menu:open-recent', filePath)
  }));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 860,
    minHeight: 520,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.setTitle('Untitled — Restinator');

  mainWindow.on('close', (event) => {
    if (allowClose) return;
    event.preventDefault();
    mainWindow.webContents.send('app:close-requested');
  });

  buildMenu();
}

function sendMenu(channel, ...args) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendMenu('menu:open')
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendMenu('menu:save')
        },
        {
          label: 'Save As',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendMenu('menu:save-as')
        },
        {
          label: 'Recent',
          submenu: recentMenuItems()
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.close();
            } else {
              app.quit();
            }
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Submit',
          accelerator: 'F9',
          click: () => sendMenu('menu:submit')
        },
        { type: 'separator' },
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Wrap Text',
          type: 'checkbox',
          checked: wrapText,
          click: (item) => {
            wrapText = item.checked;
            sendMenu('menu:wrap', wrapText);
          }
        }
      ]
    },
    {
      label: 'Response',
      submenu: [
        {
          label: 'Json',
          accelerator: 'CmdOrCtrl+1',
          click: () => sendMenu('menu:tab', 'json')
        },
        {
          label: 'Request',
          accelerator: 'CmdOrCtrl+2',
          click: () => sendMenu('menu:tab', 'request')
        },
        {
          label: 'Raw',
          accelerator: 'CmdOrCtrl+3',
          click: () => sendMenu('menu:tab', 'raw')
        },
        {
          label: 'Html',
          accelerator: 'CmdOrCtrl+4',
          click: () => sendMenu('menu:tab', 'html')
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function restFilters() {
  return [
    { name: 'REST', extensions: ['rest', 'http'] },
    { name: 'All Files', extensions: ['*'] }
  ];
}

ipcMain.handle('file:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open REST file',
    filters: restFilters(),
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  const content = await fs.readFile(filePath, 'utf8');
  await rememberFile(filePath);
  return { filePath, content };
});

ipcMain.handle('file:openPath', async (_event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    await rememberFile(filePath);
    return { filePath, content };
  } catch (err) {
    await dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Unable to open file',
      message: 'Unable to open file',
      detail: `${filePath}\n\n${err.message}`
    });
    await removeRecent(filePath);
    return null;
  }
});

ipcMain.handle('file:save', async (_event, { filePath, content }) => {
  await fs.writeFile(filePath, content, 'utf8');
  await rememberFile(filePath);
  return { filePath };
});

ipcMain.handle('file:saveAs', async (_event, { content, defaultPath }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save REST file',
    defaultPath: defaultPath || 'untitled.rest',
    filters: restFilters()
  });
  if (result.canceled || !result.filePath) return null;
  await fs.writeFile(result.filePath, content, 'utf8');
  await rememberFile(result.filePath);
  return { filePath: result.filePath };
});

ipcMain.handle('dialog:unsaved', async (_event, { action }) => {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Save', 'Discard', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    message: 'You have unsaved changes.',
    detail: action === 'close'
      ? 'Save before exiting?'
      : 'Save before opening another file?'
  });
  return ['save', 'discard', 'cancel'][response];
});

ipcMain.handle('window:setTitle', async (_event, title) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setTitle(title);
  }
});

ipcMain.handle('app:allow-close', async () => {
  allowClose = true;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
  app.quit();
});

ipcMain.handle('http:send', async (_event, request) => {
  return sendHttpRequest(request);
});

ipcMain.handle('clipboard:write', async (_event, text) => {
  clipboard.writeText(String(text || ''));
});

app.whenReady().then(async () => {
  await loadRecents();
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
