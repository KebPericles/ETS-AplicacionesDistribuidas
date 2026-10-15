const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

const tokenCookieName = 'helpdesk_token';
const tokenDurationMs = 8 * 60 * 60 * 1000;

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active
  };
}

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET no esta configurado');
  }

  return process.env.JWT_SECRET;
}

async function register({ name, email, password }) {
  const normalizedEmail = email.toLowerCase();
  const existingUser = await User.exists({ email: normalizedEmail });

  if (existingUser) {
    const error = new Error('El correo ya esta registrado');
    error.statusCode = 409;
    error.code = 'EMAIL_IN_USE';
    throw error;
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await User.create({
    name,
    email: normalizedEmail,
    password: hashedPassword,
    role: 'cliente'
  });

  return publicUser(user);
}

async function login({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  const validPassword = user && await bcrypt.compare(password, user.password);

  if (!user || !validPassword || !user.active) {
    const error = new Error('Credenciales invalidas');
    error.statusCode = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  const token = jwt.sign({ sub: user._id.toString() }, getJwtSecret(), { expiresIn: '8h' });
  return { token, user: publicUser(user) };
}

function cookieOptions() {
  const production = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? 'strict' : 'lax',
    maxAge: tokenDurationMs,
    path: '/'
  };
}

module.exports = {
  cookieOptions,
  login,
  publicUser,
  register,
  tokenCookieName
};
