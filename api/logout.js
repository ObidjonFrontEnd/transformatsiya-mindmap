const { setCookie, send } = require('./_lib');

module.exports = async (req, res) => {
  setCookie(res, '', 0);
  send(res, 200, { ok: true });
};
