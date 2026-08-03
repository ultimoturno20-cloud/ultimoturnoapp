import AsyncStorage from "@react-native-async-storage/async-storage";

const CONFIG_KEY = "ultimo_turno_config";
const CART_KEY = "ultimo_turno_cart";
const USER_KEY = "ultimo_turno_user";
const PENDING_SALES_KEY = "ultimo_turno_pending_sales";
const PENDING_ACTIONS_KEY = "ultimo_turno_pending_actions_v2";
const RECENT_SEARCHES_KEY = "ultimo_turno_recent_searches";
const FAVORITES_KEY = "ultimo_turno_favorites";
const AUTH_PREFIX = "ultimo_turno_auth_";
const BIO_PREFIX = "ultimo_turno_bio_";
const SESSION_PREFIX = "ultimo_turno_session_";
const DEVICE_KEY = "ultimo_turno_device_id";
const STOCK_CATALOG_KEY = "ultimo_turno_stock_catalog_v2";

export async function loadConfig() {
  const raw = await AsyncStorage.getItem(CONFIG_KEY);
  if (!raw) return { apiUrl: "", apiToken: "" };
  try {
    return { apiUrl: "", apiToken: "", ...JSON.parse(raw) };
  } catch (err) {
    return { apiUrl: "", apiToken: "" };
  }
}

export async function saveConfig(config) {
  await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config || {}));
}

export async function loadStockCatalog() {
  const raw = await AsyncStorage.getItem(STOCK_CATALOG_KEY);
  if (!raw) return { updatedAt: "", items: [] };
  try { return { updatedAt: "", items: [], ...JSON.parse(raw) }; } catch (err) { return { updatedAt: "", items: [] }; }
}

export async function saveStockCatalog(catalog) {
  await AsyncStorage.setItem(STOCK_CATALOG_KEY, JSON.stringify(catalog || { updatedAt: "", items: [] }));
}

export async function loadCart() {
  const raw = await AsyncStorage.getItem(CART_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) || [];
  } catch (err) {
    return [];
  }
}

export async function saveCart(cart) {
  await AsyncStorage.setItem(CART_KEY, JSON.stringify(cart || []));
}

export async function loadPendingSales() {
  const raw = await AsyncStorage.getItem(PENDING_SALES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) || [];
  } catch (err) {
    return [];
  }
}

export async function savePendingSales(sales) {
  await AsyncStorage.setItem(PENDING_SALES_KEY, JSON.stringify(sales || []));
}

export async function loadPendingActions() {
  const raw = await AsyncStorage.getItem(PENDING_ACTIONS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) || []; } catch (err) { return []; }
}

export async function savePendingActions(actions) {
  await AsyncStorage.setItem(PENDING_ACTIONS_KEY, JSON.stringify(actions || []));
}

export async function loadRecentSearches() {
  const raw = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) || []; } catch (err) { return []; }
}

export async function saveRecentSearches(searches) {
  await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify((searches || []).slice(0, 10)));
}

export async function loadFavorites() {
  const raw = await AsyncStorage.getItem(FAVORITES_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) || []; } catch (err) { return []; }
}

export async function saveFavorites(favorites) {
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites || []));
}

export async function saveUser(user) {
  if (!user) {
    await AsyncStorage.removeItem(USER_KEY);
    return;
  }
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function loadOrCreateDeviceId() {
  const saved = await AsyncStorage.getItem(DEVICE_KEY);
  if (saved) return saved;
  const created = `device-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  await AsyncStorage.setItem(DEVICE_KEY, created);
  return created;
}

export async function loadUserSession(userId) {
  return (await AsyncStorage.getItem(SESSION_PREFIX + userId)) || "";
}

export async function saveUserSession(userId, sessionToken) {
  if (sessionToken) await AsyncStorage.setItem(SESSION_PREFIX + userId, sessionToken);
  else await AsyncStorage.removeItem(SESSION_PREFIX + userId);
}

export async function loadUser() {
  const raw = await AsyncStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) || null;
  } catch (err) {
    return null;
  }
}

export async function loadUserAuthStatus(userIds) {
  const out = {};
  for (const id of userIds || []) {
    out[id] = !!(await AsyncStorage.getItem(AUTH_PREFIX + id));
  }
  return out;
}

export async function loadBiometricStatus(userIds) {
  const out = {};
  for (const id of userIds || []) {
    out[id] = (await AsyncStorage.getItem(BIO_PREFIX + id)) === "true";
  }
  return out;
}

export async function setUserBiometricEnabled(userId, enabled) {
  if (enabled) await AsyncStorage.setItem(BIO_PREFIX + userId, "true");
  else await AsyncStorage.removeItem(BIO_PREFIX + userId);
}

export async function createUserPassword(userId, password) {
  const salt = `${Date.now()}-${Math.random()}-${userId}`;
  const hash = await hashPassword(password, salt);
  await AsyncStorage.setItem(AUTH_PREFIX + userId, JSON.stringify({ salt, hash, createdAt: new Date().toISOString() }));
}

export async function verifyUserPassword(userId, password) {
  const raw = await AsyncStorage.getItem(AUTH_PREFIX + userId);
  if (!raw) return false;
  try {
    const auth = JSON.parse(raw);
    const hash = await hashPassword(password, auth.salt);
    return hash === auth.hash;
  } catch (err) {
    return false;
  }
}

export async function resetUserPassword(userId) {
  await AsyncStorage.removeItem(AUTH_PREFIX + userId);
  await AsyncStorage.removeItem(BIO_PREFIX + userId);
}

async function hashPassword(password, salt) {
  return sha256(`${salt}:${String(password || "")}`);
}

function sha256(input) {
  const bytes = utf8Bytes(input);
  const words = [];
  for (let i = 0; i < bytes.length; i++) words[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
  words[bytes.length >> 2] |= 0x80 << (24 - (bytes.length % 4) * 8);
  words[(((bytes.length + 8) >> 6) << 4) + 15] = bytes.length * 8;

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  const w = new Array(64);

  for (let i = 0; i < words.length; i += 16) {
    let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
    for (let j = 0; j < 64; j++) {
      if (j < 16) {
        w[j] = words[i + j] | 0;
      } else {
        const s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = add32(w[j - 16], s0, w[j - 7], s1);
      }
      const ch = (e & f) ^ (~e & g);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const sA = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const sE = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const t1 = add32(hh, sE, ch, k[j], w[j]);
      const t2 = add32(sA, maj);
      hh = g;
      g = f;
      f = e;
      e = add32(d, t1);
      d = c;
      c = b;
      b = a;
      a = add32(t1, t2);
    }
    h[0] = add32(h[0], a);
    h[1] = add32(h[1], b);
    h[2] = add32(h[2], c);
    h[3] = add32(h[3], d);
    h[4] = add32(h[4], e);
    h[5] = add32(h[5], f);
    h[6] = add32(h[6], g);
    h[7] = add32(h[7], hh);
  }

  return h.map((value) => (value >>> 0).toString(16).padStart(8, "0")).join("");
}

function utf8Bytes(input) {
  const text = String(input || "");
  const out = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code < 0x80) out.push(code);
    else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code >= 0xd800 && code < 0xe000) {
      i++;
      code = 0x10000 + (((code & 0x3ff) << 10) | (text.charCodeAt(i) & 0x3ff));
      out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return out;
}

function rotr(value, shift) {
  return (value >>> shift) | (value << (32 - shift));
}

function add32() {
  let out = 0;
  for (let i = 0; i < arguments.length; i++) out = (out + arguments[i]) | 0;
  return out;
}
