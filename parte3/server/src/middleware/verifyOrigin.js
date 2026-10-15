function verifyOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || !req.headers.origin) return next();

  const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (allowedOrigins.includes(req.headers.origin)) return next();

  return res.status(403).json({
    error: {
      code: 'ORIGIN_NOT_ALLOWED',
      message: 'El origen de la solicitud no esta permitido'
    }
  });
}

module.exports = { verifyOrigin };
