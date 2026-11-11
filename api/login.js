const { redis, makeToken, setCookie, safeEqual, body, send, SESSION_TTL } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST kerak' });
  if (!process.env.ADMIN_LOGIN || !process.env.ADMIN_PASSWORD)
    return send(res, 500, { error: 'Login sozlanmagan (ADMIN_LOGIN / ADMIN_PASSWORD)' });

  // Oddiy himoya: bitta IP'dan 15 daqiqada 10 tadan ortiq xato urinish bo'lsa bloklanadi
  const ip = String(req.headers['x-forwarded-for'] || 'x').split(',')[0].trim();
  const key = `login_fail:${ip}`;
  try {
    const fails = Number(await redis('GET', key)) || 0;
    if (fails >= 10) return send(res, 429, { error: 'Juda ko\'p urinish. 15 daqiqadan keyin qayta urining.' });

    const { login, password } = body(req);
    if (safeEqual(login || '', process.env.ADMIN_LOGIN) && safeEqual(password || '', process.env.ADMIN_PASSWORD)) {
      await redis('DEL', key);
      setCookie(res, makeToken(process.env.ADMIN_LOGIN), SESSION_TTL);
      return send(res, 200, { user: process.env.ADMIN_LOGIN });
    }
    await redis('INCR', key);
    await redis('EXPIRE', key, 900);
    return send(res, 401, { error: 'Login yoki parol noto\'g\'ri' });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
};
