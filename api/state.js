const { DIRS, STATUSES, redis, getUser, body, send } = require('./_lib');

// GET  /api/state  -> { user, holatlar: { boshqaruv: { '1.1': 'bajarildi', ... }, ... } }  (hamma uchun ochiq)
// POST /api/state  -> { dir, holatlar: { id: status } }  (faqat login qilgan foydalanuvchi)
module.exports = async (req, res) => {
  try {
    const user = getUser(req);

    if (req.method === 'GET') {
      const flat = (await redis('HGETALL', 'holatlar')) || [];
      const holatlar = {};
      for (let i = 0; i < flat.length; i += 2) {
        try { holatlar[flat[i]] = JSON.parse(flat[i + 1]); } catch {}
      }
      return send(res, 200, { user, holatlar });
    }

    if (req.method === 'POST') {
      if (!user) return send(res, 401, { error: 'Avval tizimga kiring' });
      const { dir, holatlar } = body(req);
      if (!DIRS.includes(dir)) return send(res, 400, { error: 'Noma\'lum yo\'nalish' });
      if (!holatlar || typeof holatlar !== 'object') return send(res, 400, { error: 'holatlar yo\'q' });
      const clean = {};
      for (const [id, st] of Object.entries(holatlar)) {
        if (!/^\d{1,2}\.\d{1,2}$/.test(id) || !STATUSES.includes(st))
          return send(res, 400, { error: `Noto'g'ri qiymat: ${id} = ${st}` });
        clean[id] = st;
      }

      // O'zgarishlar tarixi: kim, qachon, nimani o'zgartirdi (oxirgi 500 ta yozuv saqlanadi)
      let prev = {};
      try { prev = JSON.parse((await redis('HGET', 'holatlar', dir)) || '{}'); } catch {}
      const changes = Object.entries(clean)
        .filter(([id, st]) => prev[id] !== st)
        .map(([id, st]) => ({ id, eski: prev[id] || null, yangi: st }));

      await redis('HSET', 'holatlar', dir, JSON.stringify(clean));
      if (changes.length) {
        await redis('LPUSH', 'tarix', JSON.stringify({ vaqt: new Date().toISOString(), user, dir, changes }));
        await redis('LTRIM', 'tarix', 0, 499);
      }
      return send(res, 200, { ok: true, ozgardi: changes.length });
    }

    return send(res, 405, { error: 'GET yoki POST' });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
};
