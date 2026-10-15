const { z } = require('zod');
const ticketService = require('../services/ticketService');
const { categories, priorities, statuses } = require('../models/ticket');

const createSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(5000),
  category: z.enum(categories),
  priority: z.enum(priorities)
});

const statusSchema = z.object({ status: z.enum(statuses) });

function validationError(result) {
  const error = new Error('Los datos enviados no son validos');
  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';
  error.details = result.error.issues;
  return error;
}

async function list(req, res, next) {
  try {
    return res.json({ data: await ticketService.list(req.user, req.query) });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  const result = createSchema.safeParse(req.body);
  if (!result.success) return next(validationError(result));

  try {
    return res.status(201).json({ data: { ticket: await ticketService.create(req.user, result.data) } });
  } catch (error) {
    return next(error);
  }
}

async function getOne(req, res, next) {
  try {
    return res.json({ data: { ticket: await ticketService.getVisible(req.user, req.params.id) } });
  } catch (error) {
    return next(error);
  }
}

async function changeStatus(req, res, next) {
  const result = statusSchema.safeParse(req.body);
  if (!result.success) return next(validationError(result));

  try {
    return res.json({ data: { ticket: await ticketService.changeStatus(req.user, req.params.id, result.data.status) } });
  } catch (error) {
    return next(error);
  }
}

module.exports = { changeStatus, create, getOne, list };
