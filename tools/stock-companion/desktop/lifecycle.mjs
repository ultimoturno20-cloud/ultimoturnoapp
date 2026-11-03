import { readFile, unlink, access } from 'node:fs/promises';
import path from 'node:path';

// Recover only a dead owner's lock. Never stop another process or delete drafts.
export async function recoverLock(dataDir, alive = pid => {
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}) {
  const filename = path.join(dataDir, 'running.lock');
  let content;
  try { content = await readFile(filename, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  const pid = Number(content);
  if (!/^\d+$/.test(content) || !Number.isSafeInteger(pid) || pid < 1) throw new Error('El cierre anterior necesita revisión: running.lock no contiene un proceso válido. Tus lotes siguen guardados.');
  if (alive(pid)) throw new Error('El programa ya está abierto o sigue activa la versión de navegador. Cerrá su consola antes de abrir esta aplicación. Tus lotes se conservan.');
  if (await readFile(filename, 'utf8') !== content) throw new Error('Otra instancia está iniciando. Volvé a intentar.');
  await unlink(filename);
}

export async function validateAdb(filename) {
  if (!path.isAbsolute(filename) || path.basename(filename).toLowerCase() !== 'adb.exe') throw new Error('Seleccioná el archivo adb.exe de la carpeta de scrcpy o Android Platform Tools.');
  await access(filename);
  return filename;
}

export function allowedNavigation(target, origin) {
  try {
    const url = new URL(target);
    return url.origin === origin && ['/', '/scanner', '/batches'].includes(url.pathname);
  } catch { return false; }
}
