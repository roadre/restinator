const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const execFileAsync = promisify(execFile);
const APP_DIR = __dirname;
const APP_ICON = path.join(APP_DIR, 'icon.png');

function electronBinary() {
  if (process.versions.electron) return process.execPath;
  return require('electron');
}

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

async function registerLinuxDesktop() {
  const home = os.homedir();
  const appsDir = path.join(home, '.local/share/applications');
  const iconDirs = [
    path.join(home, '.local/share/icons/hicolor/256x256/apps'),
    path.join(home, '.local/share/icons/hicolor/512x512/apps'),
    path.join(home, '.local/share/pixmaps')
  ];
  await fs.mkdir(appsDir, { recursive: true });
  await Promise.all(iconDirs.map((dir) => fs.mkdir(dir, { recursive: true })));
  await Promise.all(
    iconDirs.map((dir) => fs.copyFile(APP_ICON, path.join(dir, 'restinator.png')))
  );

  const execLine = `${shQuote(electronBinary())} ${shQuote(APP_DIR)}`;
  const desktop = [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Restinator',
    'Comment=A simple REST client for .rest documents',
    `Exec=${execLine}`,
    'Icon=restinator',
    'Terminal=false',
    'Categories=Development;Network;',
    'StartupWMClass=Restinator',
    'StartupNotify=true'
  ].join('\n') + '\n';
  const desktopPath = path.join(appsDir, 'restinator.desktop');
  await fs.writeFile(desktopPath, desktop, 'utf8');
  return desktopPath;
}

async function writeMacIcon(icnsPath) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'restinator-icon-'));
  try {
    const iconset = path.join(tmp, 'Restinator.iconset');
    await fs.mkdir(iconset);
    const specs = [
      [16, 'icon_16x16.png'],
      [32, 'icon_16x16@2x.png'],
      [32, 'icon_32x32.png'],
      [64, 'icon_32x32@2x.png'],
      [128, 'icon_128x128.png'],
      [256, 'icon_128x128@2x.png'],
      [256, 'icon_256x256.png'],
      [512, 'icon_256x256@2x.png'],
      [512, 'icon_512x512.png'],
      [1024, 'icon_512x512@2x.png']
    ];
    for (const [size, name] of specs) {
      await execFileAsync('sips', [
        '-z',
        String(size),
        String(size),
        APP_ICON,
        '--out',
        path.join(iconset, name)
      ]);
    }
    await execFileAsync('iconutil', ['-c', 'icns', iconset, '-o', icnsPath]);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

async function registerMacOSLauncher() {
  const appBundle = path.join(os.homedir(), 'Applications', 'Restinator.app');
  const contents = path.join(appBundle, 'Contents');
  const macos = path.join(contents, 'MacOS');
  const resources = path.join(contents, 'Resources');
  await fs.mkdir(macos, { recursive: true });
  await fs.mkdir(resources, { recursive: true });

  const script = `#!/bin/sh
exec ${shQuote(electronBinary())} ${shQuote(APP_DIR)} "$@"
`;
  const executable = path.join(macos, 'Restinator');
  await fs.writeFile(executable, script, { encoding: 'utf8', mode: 0o755 });
  await fs.chmod(executable, 0o755);

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>Restinator</string>
  <key>CFBundleExecutable</key>
  <string>Restinator</string>
  <key>CFBundleIconFile</key>
  <string>Restinator</string>
  <key>CFBundleIdentifier</key>
  <string>local.restinator</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>Restinator</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleVersion</key>
  <string>1.0.0</string>
  <key>LSMinimumSystemVersion</key>
  <string>11.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSSupportsAutomaticGraphicsSwitching</key>
  <true/>
</dict>
</plist>
`;
  await fs.writeFile(path.join(contents, 'Info.plist'), plist, 'utf8');
  await fs.writeFile(path.join(contents, 'PkgInfo'), 'APPL????', 'utf8');

  try {
    await writeMacIcon(path.join(resources, 'Restinator.icns'));
  } catch {
    /* launcher still works without an icon */
  }

  try {
    await execFileAsync(
      '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister',
      ['-f', appBundle]
    );
  } catch {
    /* Launch Services will pick it up on its own */
  }
  try {
    await execFileAsync('mdimport', [appBundle]);
  } catch {
    /* Spotlight will pick it up on its own */
  }

  return appBundle;
}

async function registerDesktopShortcut() {
  if (process.platform === 'linux') return registerLinuxDesktop();
  if (process.platform === 'darwin') return registerMacOSLauncher();
  return null;
}

module.exports = { registerDesktopShortcut };

if (require.main === module) {
  registerDesktopShortcut()
    .then((created) => {
      if (!created) {
        console.error(`No desktop shortcut for platform: ${process.platform}`);
        process.exit(1);
      }
      console.log(`Launcher: ${created}`);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
