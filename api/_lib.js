const crypto = require('crypto');

const DIRS = ['boshqaruv', 'moliya', 'hr', 'qurilish', 'taminot', 'savdo', 'xavfsizlik', 'xotira'];
const STATUSES = ['bajarildi', 'jarayonda', 'kechikmoqda', 'rejada', 'tasdiqlanmagan'];
const COOKIE = 'mm_s';
const SESSION_TTL = 7 * 24 * 3600; // 7 kun

// ---------- Upstash Redis (REST) ----------
async function redis(...cmd) {
  const url = process.env.KV_REST_API_URL, token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('Redis sozlanmagan (KV_REST_API_URL / KV_REST_API_TOKEN)');
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

// ---------- sessiya ----------
function secret() {
  // Parol yoki Redis tokeni o'zgarsa, eski sessiyalar avtomatik bekor bo'ladi
  return crypto.createHash('sha256')
    .update(`${process.env.KV_REST_API_TOKEN || ''}|${process.env.ADMIN_PASSWORD || ''}|mindmap`)
    .digest();
}
const b64 = s => Buffer.from(s).toString('base64url');
const sign = data => crypto.createHmac('sha256', secret()).update(data).digest('base64url');

function makeToken(user) {
  const data = b64(JSON.stringify({ u: user, exp: Math.floor(Date.now() / 1000) + SESSION_TTL }));
  return `${data}.${sign(data)}`;
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function getUser(req) {
  const raw = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='));
  if (!raw) return null;
  const [data, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!data || !sig || !safeEqual(sig, sign(data))) return null;
  try {
    const p = JSON.parse(Buffer.from(data, 'base64url').toString());
    return p.exp > Date.now() / 1000 ? p.u : null;
  } catch { return null; }
}

const setCookie = (res, value, maxAge) =>
  res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`);

function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

function send(res, code, obj) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(code).json(obj);
}

module.exports = { DIRS, STATUSES, redis, makeToken, getUser, setCookie, safeEqual, body, send, SESSION_TTL };
