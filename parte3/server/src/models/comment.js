const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  body: { type: String, required: true, trim: true, minlength: 1, maxlength: 5000 },
  internal: { type: Boolean, default: false, required: true }
}, { timestamps: true });

commentSchema.index({ ticket: 1, internal: 1, createdAt: 1 });

module.exports = mongoose.model('Comment', commentSchema);
