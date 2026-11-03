import { app, BrowserWindow, Menu, dialog, session } from 'electron';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { recoverLock, validateAdb, allowedNavigation } from './lifecycle.mjs';

app.setName('UltimoTurno Stock');
const dataDir = process.env.COMPANION_DESKTOP_TEST_DATA_DIR || path.join(process.env.LOCALAPPDATA || app.getPath('userData'), 'UltimoTurno', 'StockCompanion');
// Keep Electron's instance lock/profile stable even for a portable executable.
app.setPath('userData', path.join(dataDir, 'desktop-profile'));
const ownsInstance = app.requestSingleInstanceLock();
let window, service, starting, quitting = false, stopped = false;
const settingsFile = path.join(dataDir, 'desktop-settings.json');
const saveAdb = async filename => {
  await validateAdb(filename);
  await writeFile(settingsFile + '.tmp', JSON.stringify({ adbPath: filename }, null, 2));
  await rename(settingsFile + '.tmp', settingsFile);
};

async function configureAndroid() {
  const result = await dialog.showOpenDialog(window, {
    title: 'Elegí adb.exe en la carpeta de scrcpy', properties: ['openFile'],
    filters: [{ name: 'Android Debug Bridge', extensions: ['exe'] }]
  });
  if (result.canceled) return;
  try {
    await saveAdb(result.filePaths[0]);
    const choice = await dialog.showMessageBox(window, {
      type: 'info', message: 'Conexión Android configurada',
      detail: 'La ruta quedó guardada. Reiniciá la aplicación para usarla; después no hace falta abrir scrcpy. Los lotes ya guardados se conservan.',
      buttons: ['Reiniciar ahora', 'Más tarde'], cancelId: 1
    });
    if (choice.response === 0) {
      if (process.env.PORTABLE_EXECUTABLE_FILE) app.relaunch({ execPath: process.env.PORTABLE_EXECUTABLE_FILE, args: [] });
      else app.relaunch();
      app.quit();
    }
  } catch (error) { dialog.showErrorBox('Conexión Android', error.message); }
}

async function start() {
  await mkdir(dataDir, { recursive: true });
  await recoverLock(dataDir);
  let adbPath;
  try { adbPath = JSON.parse(await readFile(settingsFile, 'utf8')).adbPath; }
  catch (error) { if (error.code !== 'ENOENT') throw new Error('No se pudo leer desktop-settings.json. Tus lotes no fueron modificados.'); }
  if (!adbPath && process.platform === 'win32') {
    try {
      const command = 'Get-Process -Name scrcpy -ErrorAction SilentlyContinue | ForEach-Object { if ($_.Path) { Join-Path (Split-Path -Parent $_.Path) "adb.exe" } }';
      const result = await promisify(execFile)('powershell.exe', ['-NoProfile', '-Command', command], { windowsHide: true, timeout: 5000 });
      const found = result.stdout.trim().split(/\r?\n/).filter(Boolean)[0];
      if (found) { await saveAdb(found); adbPath = found; }
    } catch { /* Manual selection and the bridge's PATH fallback remain available. */ }
  }
  const { startCompanion } = await import(app.isPackaged ? './runtime/server.mjs' : '../server.mjs');
  service = await startCompanion({ dataDir, port: 0, androidOptions: { adbPath } });
  if (quitting) return;
  const isolated = session.fromPartition('stock-desktop');
  isolated.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  isolated.setPermissionCheckHandler(() => false);
  window = new BrowserWindow({
    width: 1440, height: 940, minWidth: 800, minHeight: 600,
    title: 'UltimoTurno Stock', show: false, backgroundColor: '#101114',
    webPreferences: { session: isolated, nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  const navigation = (event, target) => { if (!allowedNavigation(target, service.url)) event.preventDefault(); };
  window.webContents.on('will-navigate', navigation);
  window.webContents.on('will-redirect', navigation);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.on('page-title-updated', event => event.preventDefault());
  isolated.on('will-download', event => event.preventDefault());
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Archivo', submenu: [
      { label: 'Mesa de escaneo', click: () => window.loadURL(service.url) },
      { label: 'Lotes e importación CSV', click: () => window.loadURL(service.url + '/batches') },
      { type: 'separator' }, { label: 'Salir', role: 'quit' }
    ] },
    { label: 'Android', submenu: [{ label: 'Configurar conexión Android…', click: configureAndroid }] },
    { label: 'Editar', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'Vista', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] }
  ]));
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => { window = null; });
  await window.loadURL(service.url);
}

if (!ownsInstance) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', event => {
    if (stopped) return;
    event.preventDefault();
    if (quitting) return;
    quitting = true;
    void (async () => {
      try { await starting?.catch(() => {}); await service?.close(); }
      catch (error) { dialog.showErrorBox('Cierre de UltimoTurno Stock', error.message); }
      finally { stopped = true; app.quit(); }
    })();
  });
  void app.whenReady().then(() => {
    starting = start();
    starting.catch(error => { dialog.showErrorBox('No se pudo abrir UltimoTurno Stock', error.message); app.quit(); });
  });
}
