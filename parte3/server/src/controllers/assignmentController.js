const { z } = require('zod');
const User = require('../models/user');
const { Ticket } = require('../models/ticket');
const { visibilityFilter } = require('../services/ticketService');

const assignmentSchema = z.object({ agentId: z.string().nullable().optional() });

function validationError(result) {
  const error = new Error('Los datos enviados no son validos');
  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';
  error.details = result.error.issues;
  return error;
}

function notFound(message = 'Ticket no encontrado') {
  const error = new Error(message);
  error.statusCode = 404;
  error.code = 'RESOURCE_NOT_FOUND';
  return error;
}

async function assign(req, res, next) {
  const result = assignmentSchema.safeParse(req.body || {});
  if (!result.success) return next(validationError(result));

  try {
    const requestedAgentId = req.user.role === 'agente' ? req.user._id.toString() : result.data.agentId;
    if (!requestedAgentId) {
      const error = new Error('El administrador debe indicar un agente');
      error.statusCode = 400;
      error.code = 'AGENT_REQUIRED';
      throw error;
    }

    const agent = await User.findOne({ _id: requestedAgentId, role: 'agente', active: true }).select('_id name email role');
    if (!agent) throw notFound('El agente no existe o no esta activo');

    const filter = { _id: req.params.id };
    if (req.user.role === 'agente') filter.assignedAgent = null;
    else Object.assign(filter, visibilityFilter(req.user));

    const ticket = await Ticket.findOneAndUpdate(
      filter,
      { $set: { assignedAgent: agent._id } },
      { returnDocument: 'after' }
    ).populate('assignedAgent', 'name email role');

    if (!ticket) {
      const error = new Error(req.user.role === 'agente' ? 'El ticket ya esta asignado' : 'Ticket no encontrado');
      error.statusCode = req.user.role === 'agente' ? 409 : 404;
      error.code = req.user.role === 'agente' ? 'TICKET_ALREADY_ASSIGNED' : 'TICKET_NOT_FOUND';
      throw error;
    }

    return res.json({ data: { ticket } });
  } catch (error) {
    return next(error);
  }
}

module.exports = { assign };
