const mongoose = require('mongoose');

const statusHistorySchema = new mongoose.Schema({
  ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  fromStatus: { type: String, default: null },
  toStatus: { type: String, required: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

statusHistorySchema.index({ ticket: 1, createdAt: 1 });

module.exports = mongoose.model('StatusHistory', statusHistorySchema);
