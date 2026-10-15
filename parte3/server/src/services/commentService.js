const mongoose = require('mongoose');
const Comment = require('../models/comment');
const { Ticket } = require('../models/ticket');
const { visibilityFilter } = require('./ticketService');

function notFound() {
  const error = new Error('Ticket no encontrado');
  error.statusCode = 404;
  error.code = 'TICKET_NOT_FOUND';
  return error;
}

async function visibleTicket(user, ticketId) {
  if (!mongoose.Types.ObjectId.isValid(ticketId)) throw notFound();
  const ticket = await Ticket.findOne({ _id: ticketId, ...visibilityFilter(user) });
  if (!ticket) throw notFound();
  return ticket;
}

async function list(user, ticketId) {
  const ticket = await visibleTicket(user, ticketId);
  const filter = { ticket: ticket._id };
  if (user.role === 'cliente') filter.internal = false;

  return Comment.find(filter)
    .populate('author', 'name email role')
    .sort({ createdAt: 1 })
    .lean();
}

async function add(user, ticketId, body, internal) {
  const ticket = await visibleTicket(user, ticketId);
  const isInternal = user.role === 'agente' && internal === true;

  return Comment.create({
    ticket: ticket._id,
    author: user._id,
    body,
    internal: isInternal
  });
}

module.exports = { add, list, visibleTicket };
