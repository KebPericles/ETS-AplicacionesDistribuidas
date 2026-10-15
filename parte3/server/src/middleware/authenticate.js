const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { tokenCookieName } = require('../services/authService');

async function authenticate(req, res, next) {
  const token = req.cookies[tokenCookieName];

  if (!token) {
    return res.status(401).json({
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Se requiere autenticacion'
      }
    });
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET no esta configurado');
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);

    if (!user || !user.active) {
      return res.status(401).json({
        error: {
          code: 'ACCOUNT_INACTIVE',
          message: 'La cuenta no esta activa'
        }
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'La sesion no es valida'
        }
      });
    }

    return next(error);
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'No tienes permisos para esta operacion'
        }
      });
    }

    return next();
  };
}

module.exports = { authenticate, requireRoles };
