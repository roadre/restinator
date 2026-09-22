const { app, BrowserWindow, Menu, dialog, ipcMain, clipboard, globalShortcut } = require('electron');
const os = require('os');
const path = require('path');
const fs = require('fs/promises');
const { sendHttpRequest } = require('./http-client');
const { registerDesktopShortcut } = require('./desktop-shortcut');

const RECENTS_MAX = 15;
const THEMES = [
  { id: 'github_dark', label: 'GitHub Dark' },
  { id: 'catppuccin_mocha', label: 'Catppuccin Mocha' },
  { id: 'one_dark', label: 'One Dark' },
  { id: 'dracula', label: 'Dracula' },
  { id: 'nord_dark', label: 'Nord Dark' },
  { id: 'monokai', label: 'Monokai' },
  { id: 'tomorrow_night', label: 'Tomorrow Night' },
  { id: 'twilight', label: 'Twilight' },
  { id: 'solarized_dark', label: 'Solarized Dark' },
  { id: 'cobalt', label: 'Cobalt' },
  { id: 'ambiance', label: 'Ambiance' },
  { id: 'clouds_midnight', label: 'Clouds Midnight' },
  { type: 'separator' },
  { id: 'github', label: 'GitHub Light' },
  { id: 'catppuccin_latte', label: 'Catppuccin Latte' },
  { id: 'chrome', label: 'Chrome' },
  { id: 'cloud_editor', label: 'Cloud Editor' },
  { id: 'solarized_light', label: 'Solarized Light' },
  { id: 'textmate', label: 'TextMate' },
  { id: 'xcode', label: 'Xcode' },
  { id: 'clouds', label: 'Clouds' }
];
const THEME_IDS = new Set(THEMES.filter((item) => item.id).map((item) => item.id));
const APP_ICON = path.join(__dirname, 'icon.png');

app.setName('Restinator');
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('class', 'Restinator');
  app.setDesktopName('restinator.desktop');
}

let mainWindow;
let wrapText = false;
let hideSecrets = true;
let editorTheme = 'github_dark';
let recents = [];

function configDir() {
  const xdg = process.env.XDG_CONFIG_HOME;
  return path.join(xdg && path.isAbsolute(xdg) ? xdg : path.join(os.homedir(), '.config'), 'restinator');
}

function configFile() {
  return path.join(configDir(), 'config.json');
}

function applyConfig(parsed) {
  if (!parsed || typeof parsed !== 'object') return;
  if (THEME_IDS.has(parsed.theme)) editorTheme = parsed.theme;
  if (Array.isArray(parsed.recents)) {
    recents = parsed.recents.filter((item) => typeof item === 'string').slice(0, RECENTS_MAX);
  }
  if (typeof parsed.wrapText === 'boolean') wrapText = parsed.wrapText;
  if (typeof parsed.hideSecrets === 'boolean') hideSecrets = parsed.hideSecrets;
}

async function loadLegacyConfig() {
  const legacy = {};
  try {
    const parsed = JSON.parse(await fs.readFile(path.join(app.getPath('userData'), 'theme.json'), 'utf8'));
    if (parsed && THEME_IDS.has(parsed.theme)) legacy.theme = parsed.theme;
  } catch {
    /* no legacy theme */
  }
  try {
    const parsed = JSON.parse(await fs.readFile(path.join(app.getPath('userData'), 'recent-files.json'), 'utf8'));
    if (Array.isArray(parsed)) legacy.recents = parsed;
  } catch {
    /* no legacy recents */
  }
  return legacy;
}

async function loadConfig() {
  try {
    applyConfig(JSON.parse(await fs.readFile(configFile(), 'utf8')));
    return;
  } catch {
    /* fall through to legacy files */
  }
  applyConfig(await loadLegacyConfig());
  await persistConfig();
}

async function persistConfig() {
  const payload = {
    theme: editorTheme,
    recents,
    wrapText,
    hideSecrets
  };
  await fs.mkdir(configDir(), { recursive: true });
  await fs.writeFile(configFile(), JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

async function rememberFile(filePath) {
  if (!filePath) return;
  const resolved = path.resolve(filePath);
  recents = [resolved, ...recents.filter((item) => item !== resolved)].slice(0, RECENTS_MAX);
  await persistConfig();
  buildMenu();
  sendChrome();
}

function menuChrome() {
  return {
    inWindow: process.platform === 'linux',
    recents: recents.map((filePath) => ({
      filePath,
      label: `${path.basename(filePath)} — ${path.dirname(filePath)}`
    })),
    themes: THEMES,
    theme: editorTheme,
    wrapText,
    hideSecrets
  };
}

function sendChrome() {
  sendMenu('menu:chrome', menuChrome());
}

function themeMenuItems() {
  return THEMES.map((item) => {
    if (item.type === 'separator') return { type: 'separator' };
    return {
      label: item.label,
      type: 'checkbox',
      checked: editorTheme === item.id,
      click: () => {
        editorTheme = item.id;
        persistConfig();
        sendMenu('menu:theme', editorTheme);
        buildMenu();
        sendChrome();
      }
    };
  });
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
    icon: APP_ICON,
    autoHideMenuBar: process.platform === 'linux',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.setTitle('Untitled — Restinator');
  mainWindow.webContents.on('did-finish-load', () => {
    sendMenu('menu:theme', editorTheme);
    sendChrome();
  });

  function registerF9() {
    globalShortcut.unregister('F9');
    globalShortcut.register('F9', () => sendMenu('menu:submit'));
  }

  mainWindow.on('focus', registerF9);
  mainWindow.on('blur', () => {
    globalShortcut.unregister('F9');
  });
  registerF9();

  buildMenu();
  if (process.platform === 'linux') {
    mainWindow.setMenuBarVisibility(false);
  }
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
          click: () => app.quit()
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
      label: 'Navigate',
      submenu: [
        {
          label: 'Statement Up',
          accelerator: 'Ctrl+Up',
          click: () => sendMenu('menu:statement', 'up')
        },
        {
          label: 'Statement Down',
          accelerator: 'Ctrl+Down',
          click: () => sendMenu('menu:statement', 'down')
        }
      ]
    },
    {
      label: 'Templates',
      submenu: [
        { label: 'GET', click: () => sendMenu('menu:template', 'get') },
        { label: 'GET with User-Agent', click: () => sendMenu('menu:template', 'userAgent') },
        { type: 'separator' },
        { label: 'POST with JSON', click: () => sendMenu('menu:template', 'postJson') },
        { label: 'POST with auth', click: () => sendMenu('menu:template', 'postAuth') },
        { label: 'POST with form fields', click: () => sendMenu('menu:template', 'postForm') }
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
            persistConfig();
            sendMenu('menu:wrap', wrapText);
            sendChrome();
          }
        },
        {
          label: 'Theme',
          submenu: themeMenuItems()
        }
      ]
    },
    {
      label: 'Export',
      submenu: [
        {
          label: 'Hide Secrets',
          type: 'checkbox',
          checked: hideSecrets,
          click: (item) => {
            hideSecrets = item.checked;
            persistConfig();
            sendMenu('menu:hide-secrets', hideSecrets);
            sendChrome();
          }
        },
        { type: 'separator' },
        {
          label: 'Copy Request as curl',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => sendMenu('menu:copy-curl')
        },
        {
          label: 'Copy Request and Response',
          click: () => sendMenu('menu:copy-exchange')
        },
        {
          label: 'Copy Response',
          click: () => sendMenu('menu:copy-response')
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

ipcMain.handle('http:send', async (_event, request) => {
  try {
    return await sendHttpRequest(request);
  } catch (err) {
    return {
      error: err && err.message ? err.message : String(err),
      time: 0
    };
  }
});

ipcMain.handle('clipboard:write', async (_event, text) => {
  clipboard.writeText(String(text || ''));
});

ipcMain.handle('prefs:theme', () => editorTheme);

ipcMain.handle('prefs:chrome', () => menuChrome());

ipcMain.handle('prefs:set-theme', async (_event, theme) => {
  if (!THEME_IDS.has(theme)) return editorTheme;
  editorTheme = theme;
  await persistConfig();
  buildMenu();
  sendChrome();
  return editorTheme;
});

ipcMain.handle('prefs:set-wrap', async (_event, wrap) => {
  wrapText = !!wrap;
  await persistConfig();
  buildMenu();
  sendChrome();
  return wrapText;
});

ipcMain.handle('prefs:set-hide-secrets', async (_event, hide) => {
  hideSecrets = !!hide;
  await persistConfig();
  buildMenu();
  sendChrome();
  return hideSecrets;
});

app.whenReady().then(async () => {
  await loadConfig();
  await registerDesktopShortcut();
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(APP_ICON);
  }
  if (app.setAboutPanelOptions) {
    app.setAboutPanelOptions({ iconPath: APP_ICON });
  }
  createWindow();
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
