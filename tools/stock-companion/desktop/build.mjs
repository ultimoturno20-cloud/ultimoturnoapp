import { mkdtemp, readFile, writeFile, cp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

// Isolate packaging from the platform's workspace/dependency tree and data.
const directory = path.dirname(fileURLToPath(import.meta.url));
const staging = await mkdtemp(path.join(os.tmpdir(), 'ut-stock-package-'));
try {
  const manifest = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
  manifest.build.electronVersion = manifest.devDependencies.electron;
  delete manifest.devDependencies;
  delete manifest.scripts;
  manifest.build.directories.output = path.resolve(directory, '../../../.work/stock-desktop-release');
  await writeFile(path.join(staging, 'package.json'), JSON.stringify(manifest, null, 2));
  for (const file of ['main.mjs', 'lifecycle.mjs', 'runtime']) await cp(path.join(directory, file), path.join(staging, file), { recursive: true });
  await mkdir(path.join(staging, 'node_modules'), { recursive: true });
  await cp(path.join(directory, 'node_modules/csv-parse'), path.join(staging, 'node_modules/csv-parse'), { recursive: true });
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(directory, 'node_modules/electron-builder/cli.js'), '--projectDir', staging, '--win', 'portable', '--x64'], { stdio: 'inherit', windowsHide: true });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error('No se pudo empaquetar: ' + code)));
  });
} finally { await rm(staging, { recursive: true, force: true }); }
