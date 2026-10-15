const { z } = require('zod');
const authService = require('../services/authService');

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128)
});

const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(2).max(100)
});

function validationError(result) {
  const error = new Error('Los datos enviados no son validos');
  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';
  error.details = result.error.issues;
  return error;
}

async function register(req, res, next) {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) return next(validationError(result));

  try {
    const user = await authService.register(result.data);
    return res.status(201).json({ data: { user } });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  const result = credentialsSchema.safeParse(req.body);
  if (!result.success) return next(validationError(result));

  try {
    const { token, user } = await authService.login(result.data);
    res.cookie(authService.tokenCookieName, token, authService.cookieOptions());
    return res.json({ data: { user } });
  } catch (error) {
    return next(error);
  }
}

function logout(req, res) {
  res.clearCookie(authService.tokenCookieName, authService.cookieOptions());
  return res.status(204).send();
}

function me(req, res) {
  return res.json({ data: { user: authService.publicUser(req.user) } });
}

module.exports = { login, logout, me, register };
