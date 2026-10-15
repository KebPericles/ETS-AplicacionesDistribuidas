const { Ticket, categories, priorities, statuses } = require('../models/ticket');
const StatusHistory = require('../models/statusHistory');
const Comment = require('../models/comment');
const mongoose = require('mongoose');

const sortFields = new Set(['createdAt', 'updatedAt', 'priority', 'status', 'title']);
const transitions = {
  cliente: {
    resuelto: ['cerrado', 'abierto']
  },
  agente: {
    abierto: ['en_progreso'],
    en_progreso: ['resuelto'],
    resuelto: ['abierto']
  },
  admin: {
    abierto: ['en_progreso'],
    en_progreso: ['resuelto'],
    resuelto: ['abierto']
  }
};

function visibilityFilter(user) {
  if (user.role === 'admin') return {};
  if (user.role === 'cliente') return { creator: user._id };

  return {
    $or: [{ assignedAgent: user._id }, { assignedAgent: null }]
  };
}

function invalidRequest(message, details) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';
  error.details = details;
  return error;
}

function notFound() {
  const error = new Error('Ticket no encontrado');
  error.statusCode = 404;
  error.code = 'TICKET_NOT_FOUND';
  return error;
}

async function list(user, query) {
  const page = Number(query.page || 1);
  const pageSize = Number(query.pageSize || 10);
  const sortBy = query.sortBy || 'createdAt';
  const sortDirection = query.sortDirection === 'asc' ? 1 : -1;

  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    throw invalidRequest('La paginacion no es valida');
  }
  if (!sortFields.has(sortBy)) throw invalidRequest('El campo de ordenamiento no es valido');
  if (query.status && !statuses.includes(query.status)) throw invalidRequest('El estado no es valido');
  if (query.priority && !priorities.includes(query.priority)) throw invalidRequest('La prioridad no es valida');
  if (query.category && !categories.includes(query.category)) throw invalidRequest('La categoria no es valida');

  const filter = { ...visibilityFilter(user) };
  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.category) filter.category = query.category;
  if (query.q) filter.$text = { $search: String(query.q).slice(0, 100) };

  const [items, total] = await Promise.all([
    Ticket.find(filter)
      .populate('creator', 'name email role')
      .populate('assignedAgent', 'name email role')
      .sort({ [sortBy]: sortDirection })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Ticket.countDocuments(filter)
  ]);

  return { items, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } };
}

async function create(user, data) {
  const session = await mongoose.startSession();
  let ticket;
  try {
    await session.withTransaction(async () => {
      [ticket] = await Ticket.create([{ ...data, creator: user._id, status: 'abierto' }], { session });
      await StatusHistory.create([{ ticket: ticket._id, fromStatus: null, toStatus: 'abierto', changedBy: user._id }], { session });
    });
    return ticket;
  } finally {
    await session.endSession();
  }
}

async function getVisible(user, id) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw notFound();
  const ticket = await Ticket.findOne({ _id: id, ...visibilityFilter(user) })
    .populate('creator', 'name email role')
    .populate('assignedAgent', 'name email role')
    .lean();
  if (!ticket) throw notFound();

  const history = await StatusHistory.find({ ticket: ticket._id })
    .populate('changedBy', 'name email role')
    .sort({ createdAt: 1 })
    .lean();

  const commentFilter = { ticket: ticket._id };
  if (user.role === 'cliente') commentFilter.internal = false;
  const comments = await Comment.find(commentFilter)
    .populate('author', 'name email role')
    .sort({ createdAt: 1 })
    .lean();

  return { ...ticket, history, comments };
}

async function changeStatus(user, id, nextStatus) {
  const session = await mongoose.startSession();
  let updatedTicket;
  try {
    await session.withTransaction(async () => {
      const ticket = await Ticket.findOne({ _id: id, ...visibilityFilter(user) }).session(session);
      if (!ticket) throw notFound();

      const allowed = transitions[user.role][ticket.status] || [];
      if (!allowed.includes(nextStatus)) {
        const error = new Error('La transicion de estado no esta permitida');
        error.statusCode = 409;
        error.code = 'INVALID_STATUS_TRANSITION';
        throw error;
      }

      const previousStatus = ticket.status;
      ticket.status = nextStatus;
      if (nextStatus === 'resuelto' && !ticket.resolvedAt) ticket.resolvedAt = new Date();
      await ticket.save({ session });
      await StatusHistory.create([{ ticket: ticket._id, fromStatus: previousStatus, toStatus: nextStatus, changedBy: user._id }], { session });
      updatedTicket = ticket;
    });
    return updatedTicket;
  } finally {
    await session.endSession();
  }
}

module.exports = { changeStatus, create, getVisible, list, visibilityFilter };
