const statsService = require('../services/statsService');

async function getStats(req, res, next) {
  try {
    return res.json({ data: await statsService.getStats(req.user) });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getStats };
