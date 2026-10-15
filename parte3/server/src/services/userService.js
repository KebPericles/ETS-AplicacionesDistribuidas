const mongoose = require('mongoose');
const User = require('../models/user');

async function list() {
  return User.find({}).select('name email role active createdAt updatedAt').sort({ createdAt: -1 }).lean();
}

async function update(admin, id, data) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error('Usuario no encontrado');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }
  if (admin._id.toString() === id && (data.role || data.active === false)) {
    const error = new Error('No puedes desactivar o cambiar tu propio rol');
    error.statusCode = 409;
    error.code = 'SELF_ADMIN_UPDATE_FORBIDDEN';
    throw error;
  }

  const user = await User.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true })
    .select('name email role active createdAt updatedAt')
    .lean();
  if (!user) {
    const error = new Error('Usuario no encontrado');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }
  return user;
}

module.exports = { list, update };
