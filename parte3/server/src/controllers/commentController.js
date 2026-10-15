const { z } = require('zod');
const commentService = require('../services/commentService');

const commentSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  internal: z.boolean().optional().default(false)
});

function validationError(result) {
  const error = new Error('Los datos enviados no son validos');
  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';
  error.details = result.error.issues;
  return error;
}

async function list(req, res, next) {
  try {
    return res.json({ data: { comments: await commentService.list(req.user, req.params.id) } });
  } catch (error) {
    return next(error);
  }
}

async function add(req, res, next) {
  const result = commentSchema.safeParse(req.body);
  if (!result.success) return next(validationError(result));

  try {
    const comment = await commentService.add(req.user, req.params.id, result.data.body, result.data.internal);
    return res.status(201).json({ data: { comment } });
  } catch (error) {
    return next(error);
  }
}

module.exports = { add, list };
