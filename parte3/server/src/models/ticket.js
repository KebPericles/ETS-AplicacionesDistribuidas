const mongoose = require('mongoose');

const categories = ['hardware', 'software', 'red', 'cuenta', 'otro'];
const priorities = ['baja', 'media', 'alta', 'critica'];
const statuses = ['abierto', 'en_progreso', 'resuelto', 'cerrado'];

const ticketSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 160 },
  description: { type: String, required: true, trim: true, minlength: 10, maxlength: 5000 },
  category: { type: String, enum: categories, required: true },
  priority: { type: String, enum: priorities, required: true, default: 'media' },
  status: { type: String, enum: statuses, required: true, default: 'abierto' },
  resolvedAt: { type: Date, default: null },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

ticketSchema.index({ creator: 1, createdAt: -1 });
ticketSchema.index({ assignedAgent: 1, status: 1, createdAt: -1 });
ticketSchema.index({ status: 1, priority: 1, category: 1, createdAt: -1 });
ticketSchema.index({ title: 'text', description: 'text' });

module.exports = { Ticket: mongoose.model('Ticket', ticketSchema), categories, priorities, statuses };
