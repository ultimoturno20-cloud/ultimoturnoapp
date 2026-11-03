import http from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseExport, transfer, reconcile, assertAccount, exactStockCandidate, rowErrors } from './core.mjs';
import { fillMissingDefaults, languages, conditions } from './batch.mjs';
import { AndroidBridge, mergeSnapshot } from './android.mjs';

export async function startCompanion({ dataDir, port = 4318, apiBase = 'https://ultimoturno.app/api', fetchImpl = fetch, androidOptions = {} } = {}) {
  const base = new URL(apiBase);
  if (base.href !== 'https://ultimoturno.app/api' && !(['127.0.0.1', 'localhost'].includes(base.hostname) && base.protocol === 'http:')) throw new Error('Destino API no permitido.');
  dataDir ||= path.join(process.env.LOCALAPPDATA || process.env.HOME || '.', 'UltimoTurno', 'StockCompanion');
  await mkdir(dataDir, { recursive: true });
  // A second process must not race the same outbox. After an abnormal exit the
  // lock is deliberately retained; recovery requires checking the old process.
  const lockPath = path.join(dataDir, 'running.lock');
  const lock = await open(lockPath, 'wx').catch(() => { throw new Error('Ya hay una instancia o un cierre pendiente. Revisá running.lock según la guía.'); });
  await lock.writeFile(String(process.pid));
  const stateFile = path.join(dataDir, 'sessions.json');
  let state;
  try { state = JSON.parse(await readFile(stateFile, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') { await lock.close(); await unlink(lockPath); throw error; } state = { sessions: [] }; }
  let connection = null, busy = false;
  const secret = randomBytes(32).toString('hex');
  const save = async () => {
    const pending = await open(stateFile + '.tmp', 'w', 0o600);
    try { await pending.writeFile(JSON.stringify(state, null, 2)); await pending.sync(); }
    finally { await pending.close(); }
    await rename(stateFile + '.tmp', stateFile);
  };
  const api = async (route, method = 'GET', body) => {
    const response = await fetchImpl(apiBase + route, {
      method, headers: { 'Content-Type': 'application/json', ...(connection ? { Authorization: `Bearer ${connection.token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(45000), redirect: 'error'
    });
    const result = await response.json();
    if (!response.ok) throw new Error(`API ${response.status}: ${String(result.error || 'No se pudo completar la operación.').slice(0, 240)}`);
    return result;
  };
  const android = new AndroidBridge({ ...androidOptions, onSnapshot: async rows => {
    const session = state.sessions.find(s => s.id === state.androidSessionId);
    if (!session || session.androidFinalized || session.appliedAt) return;
    mergeSnapshot(session, rows); await save();
  } });
  const applySession = async session => {
    const rows = session.rows.filter(r => !r.ignored);
    if (!rows.length || rows.some(r => r.transfer !== 'sent' || !r.entryId)) throw new Error('Primero enviá todas las capturas.');
    if (!session.appliedAt) {
      session.applyPending = true; await save();
      const result = await api('/mobile-intake/apply', 'POST', { ids: rows.map(r => r.entryId) });
      if (!result.result || result.result.errors?.length || result.result.appliedEntries + result.result.skippedEntries !== rows.length) throw new Error('La aplicación requiere revisión en Carga móvil.');
      session.receipt = result.result; session.appliedAt = new Date().toISOString(); session.applyPending = false; await save();
    }
  };
  const publicState = () => ({ ...state, user: connection?.user || null, apiBase, android: android.status });
  const reply = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const origin = `http://127.0.0.1:${server.address().port}`;
    if (req.headers.host !== `127.0.0.1:${server.address().port}` || (req.headers.origin && req.headers.origin !== origin)) return reply(res, 403, { error: 'Origen no permitido.' });
    const url = new URL(req.url, origin);
    try {
      if (req.method === 'GET' && ['/', '/scanner', '/batches', '/scanner.js', '/scanner.css', '/app.js', '/batch.mjs', '/style.css'].includes(url.pathname)) {
        const filename = { '/': 'scanner.html', '/scanner': 'scanner.html', '/batches': 'index.html', '/scanner.js': 'scanner.js', '/scanner.css': 'scanner.css', '/app.js': 'app.js', '/batch.mjs': 'batch.mjs', '/style.css': 'style.css' }[url.pathname];
        let content = await readFile(path.join(dir, filename), 'utf8');
        if (filename.endsWith('.html')) content = content.replace('COMPANION_TOKEN', secret);
        res.writeHead(200, { 'Content-Type': filename.endsWith('.html') ? 'text/html; charset=utf-8' : filename.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(content);
      }
      if (req.headers['x-companion-token'] !== secret) return reply(res, 403, { error: 'Abrí el programa desde su dirección local.' });
      if (req.method === 'GET' && url.pathname === '/state') return reply(res, 200, publicState());
      if (req.method === 'GET' && url.pathname === '/android/frame') {
        if (!android.frame) return reply(res, 503, { error: android.status.message });
        res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' }); return res.end(android.frame);
      }
      if (req.method !== 'POST') return reply(res, 404, { error: 'Ruta no disponible.' });
      if (busy) return reply(res, 409, { error: 'Hay una operación en curso.' });
      busy = true;
      try {
        await android.pause();
        let text = '';
        for await (const chunk of req) { text += chunk; if (Buffer.byteLength(text) > 12_000_000) throw new Error('El archivo supera los 12 MB.'); }
        const body = JSON.parse(text || '{}');
        const session = state.sessions.find(s => s.id === body.sessionId);
        if (url.pathname === '/android/start') {
          let session = state.sessions.find(s => s.id === state.androidSessionId && !s.appliedAt);
          if (!session) {
            if (!languages.includes(body.language) || !conditions.includes(body.condition) || body.condition === 'GRADED') throw new Error('Elegí idioma y condición del lote.');
            session = { id: randomUUID(), name: String(body.name || 'Escaneo de Monprice').slice(0, 120), location: String(body.location || '').slice(0, 120), createdAt: new Date().toISOString(), rows: [], source: 'android', androidLanguage: body.language, androidCondition: body.condition, androidRequireEmpty: state.sessions.some(s => s.source === 'android' && s.appliedAt) };
            state.sessions.unshift(session); state.androidSessionId = session.id; await save();
          }
          await android.start(session.androidLanguage, { allowExisting: !session.androidRequireEmpty, reviewOnly: !!session.androidFinalized });
          session.androidRequireEmpty = false; await save();
        } else if (url.pathname === '/android/stop') {
          await android.stop();
        } else if (url.pathname === '/android/input') {
          if (!android.status.connected) throw new Error('Conectá el Pixel antes de controlarlo.');
          await android.input(body);
        } else if (url.pathname === '/android/finalize') {
          const session = state.sessions.find(s => s.id === state.androidSessionId);
          if (!session || session.appliedAt) throw new Error('No hay un lote de captura pendiente.');
          if (!session.androidFinalized) {
            if (!android.status.connected) throw new Error('Conectá Monprice para comprobar su lista completa.');
            await android.finalize(); session.androidFinalized = true; await save();
          }
        } else if (url.pathname === '/login') {
          if (connection) throw new Error('Desconectá la cuenta actual antes de cambiar de usuario.');
          const result = await api('/auth/login', 'POST', { email: body.email, password: body.password });
          if (!result.token || !result.user) throw new Error('Respuesta de acceso inválida.');
          connection = { token: result.token, user: result.user };
        } else if (url.pathname === '/logout') {
          if (connection) { try { await api('/auth/logout', 'POST', {}); } finally { connection = null; } }
        } else if (url.pathname === '/import') {
          if (!String(body.name || '').trim()) throw new Error('Poné un nombre al lote.');
          const parsed = parseExport(String(body.text || ''), String(body.filename || ''));
          if (!body.newPhysicalBatch && state.sessions.some(s => s.fingerprint === parsed.fingerprint)) throw new Error('Esta exportación ya está guardada. Retomá el lote existente; si son otros ejemplares físicos marcá Nuevo lote físico.');
          const session = { id: randomUUID(), name: String(body.name).slice(0, 120), location: String(body.location || '').slice(0, 120), createdAt: new Date().toISOString(), fingerprint: parsed.fingerprint, rows: parsed.rows };
          state.sessions.unshift(session); await save();
        } else {
          if (!session) throw new Error('Lote no encontrado.');
          if (url.pathname === '/edit') {
            const row = session.rows.find(r => r.id === body.rowId);
            if (!row || row.transfer !== 'local') throw new Error('La fila ya fue enviada o está pendiente de comprobación.');
            for (const field of ['name', 'expansion', 'number', 'quantity', 'language', 'condition', 'finish', 'priceArs', 'gradingCompany', 'grade']) {
              if (body.patch?.[field] !== undefined) {
                row[field] = String(body.patch[field]).slice(0, 180); row.reviewed = false;
                if (field === 'quantity' && row.androidKey) row.quantityEdited = true;
                if (['condition', 'gradingCompany', 'grade'].includes(field)) row.gradingPending = false;
                if (['name', 'expansion', 'number', 'language', 'condition', 'finish', 'gradingCompany', 'grade'].includes(field)) row.candidate = null;
              }
            }
            if (typeof body.patch?.ignored === 'boolean') row.ignored = body.patch.ignored;
            if (typeof body.patch?.reviewed === 'boolean') row.reviewed = body.patch.reviewed;
            await save();
          } else if (url.pathname === '/defaults') {
            session.lastDefaults = fillMissingDefaults(session, body.defaults);
            await save();
          } else if (url.pathname === '/match') {
            assertAccount(session, connection?.user);
            session.account ||= { userId: connection.user.id, businessId: connection.user.businessId, displayName: connection.user.displayName };
            // Save incrementally so a failed search does not discard the earlier matches.
            for (const row of session.rows.filter(r => !r.ignored && r.transfer === 'local' && !r.candidate)) {
              if (rowErrors({ ...row, reviewed: true }).length) continue;
              const { candidates } = await api('/mobile-intake/search?' + new URLSearchParams({ q: `${row.name} ${row.number.split('/')[0]}`.slice(0, 160), limit: '30' }));
              const candidate = exactStockCandidate(row, candidates);
              if (candidate) { row.candidate = candidate; row.condition = candidate.condition; row.priceArs = String(candidate.priceArs); row.reviewed = false; await save(); }
            }
            await save();
          } else if (url.pathname === '/review-matched') {
            for (const row of session.rows.filter(r => !r.ignored && r.transfer === 'local' && r.candidate)) {
              if (!rowErrors({ ...row, reviewed: true }, true).length) row.reviewed = true;
            }
            await save();
          } else if (url.pathname === '/search') {
            assertAccount(session, connection?.user);
            if (String(body.query || '').trim().length < 2) throw new Error('Escribí al menos dos caracteres.');
            return reply(res, 200, await api('/mobile-intake/search?' + new URLSearchParams({ q: String(body.query).slice(0, 160), limit: '30' })));
          } else if (url.pathname === '/choose') {
            assertAccount(session, connection?.user);
            const row = session.rows.find(r => r.id === body.rowId);
            if (!row || row.transfer !== 'local') throw new Error('Fila bloqueada.');
            // Obtain candidates server-side; never trust a client-supplied stock ID.
            const { candidates } = await api('/mobile-intake/search?' + new URLSearchParams({ q: String(body.query).slice(0, 160), limit: '30' }));
            const candidate = candidates.find(c => c.id === body.candidateId);
            if (!candidate) throw new Error('La coincidencia cambió. Volvé a buscar.');
            session.account ||= { userId: connection.user.id, businessId: connection.user.businessId, displayName: connection.user.displayName };
            row.candidate = candidate;
            row.gradingPending = false;
            row.name = candidate.name; row.expansion = candidate.expansion; row.number = candidate.number;
            if (candidate.inventoryItemId) {
              row.language = candidate.language; row.condition = candidate.condition; row.finish = candidate.finish;
              row.gradingCompany = candidate.gradingCompany || ''; row.grade = candidate.grade || '';
              row.priceArs = String(candidate.priceArs);
            }
            row.reviewed = false; await save();
          } else if (['/transfer', '/reconcile', '/apply', '/send'].includes(url.pathname)) {
            assertAccount(session, connection?.user);
            if (session.source === 'android' && !session.androidFinalized) throw new Error('Terminá la captura para comprobar toda la lista de Monprice antes de enviar.');
            if (session.rows.some(r => !r.ignored && r.gradingPending)) throw new Error('Hay cartas con graduación pendiente de confirmar.');
            session.account ||= { userId: connection.user.id, businessId: connection.user.businessId, displayName: connection.user.displayName };
            await save();
            if (url.pathname === '/transfer') await transfer(session, api, save);
            if (url.pathname === '/reconcile') await reconcile(session, api, save);
            if (url.pathname === '/send') { await transfer(session, api, save); await applySession(session); }
            if (url.pathname === '/apply') await applySession(session);
          } else return reply(res, 404, { error: 'Ruta no disponible.' });
        }
        reply(res, 200, publicState());
      } finally { busy = false; android.resume(); }
    } catch (error) { reply(res, 400, { error: error.message }); }
  });
  try { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); }); }
  catch (error) { await lock.close(); await unlink(lockPath); throw error; }
  const close = async () => {
    await android.stop();
    await new Promise(resolve => server.close(resolve)); await lock.close();
    await unlink(lockPath);
  };
  return { server, close, url: `http://127.0.0.1:${server.address().port}`, dataDir };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = await startCompanion({ port: Number(process.env.COMPANION_PORT || 4318), dataDir: process.env.COMPANION_DATA_DIR, apiBase: process.env.COMPANION_API_BASE || undefined });
  console.log(`UltimoTurno · Carga de cartas\n${app.url}\nSesiones locales: ${app.dataDir}\nCtrl+C para cerrar.`);
  let closing = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { if (!closing) { closing = true; await app.close(); process.exit(0); } });
}
