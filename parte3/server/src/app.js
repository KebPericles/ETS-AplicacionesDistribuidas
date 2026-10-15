require('./config/env');

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const authRoutes = require('./routes/auth');
const ticketRoutes = require('./routes/tickets');
const { authenticate } = require('./middleware/authenticate');
const { verifyOrigin } = require('./middleware/verifyOrigin');
const userRoutes = require('./routes/users');

const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use('/api', verifyOrigin);

app.use('/api/auth', authRoutes);
app.use('/api/tickets', authenticate, ticketRoutes);
app.use('/api/users', authenticate, require('./middleware/authenticate').requireRoles('admin'), userRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'helpdesk-server'
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Recurso no encontrado'
    }
  });
});

app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  const message = status >= 500 ? 'Error interno del servidor' : err.message;

  if (status >= 500) {
    console.error(err);
  }

  const response = {
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message
    }
  };

  if (err.details && status < 500) response.error.details = err.details;
  res.status(status).json(response);
});

module.exports = app;
