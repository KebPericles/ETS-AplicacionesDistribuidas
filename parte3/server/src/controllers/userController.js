const { z } = require('zod');
const userService = require('../services/userService');

const updateSchema = z.object({
  role: z.enum(['cliente', 'agente', 'admin']).optional(),
  active: z.boolean().optional()
}).refine((value) => value.role !== undefined || value.active !== undefined, { message: 'Indica un cambio de rol o estado' });

function validationError(result) {
  const error = new Error('Los datos enviados no son validos');
  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';
  error.details = result.error.issues;
  return error;
}

async function list(req, res, next) {
  try {
    return res.json({ data: { users: await userService.list() } });
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  const result = updateSchema.safeParse(req.body);
  if (!result.success) return next(validationError(result));

  try {
    return res.json({ data: { user: await userService.update(req.user, req.params.id, result.data) } });
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, update };
