const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 254
  },
  password: {
    type: String,
    required: true,
    select: false
  },
  role: {
    type: String,
    enum: ['cliente', 'agente', 'admin'],
    default: 'cliente',
    required: true
  },
  active: {
    type: Boolean,
    default: true,
    required: true
  }
}, { timestamps: true });

userSchema.index({ role: 1, active: 1 });

module.exports = mongoose.model('User', userSchema);
