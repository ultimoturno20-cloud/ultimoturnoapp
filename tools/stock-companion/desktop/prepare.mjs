import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const destination = new URL('./runtime/', import.meta.url);
await mkdir(destination, { recursive: true });
for (const filename of ['server.mjs', 'core.mjs', 'batch.mjs', 'android.mjs', 'scanner.html', 'scanner.js', 'scanner.css', 'index.html', 'app.js', 'style.css']) {
  await copyFile(new URL('../' + filename, import.meta.url), new URL(filename, destination));
}
console.log('Interfaz y puente preparados en ' + fileURLToPath(destination));
