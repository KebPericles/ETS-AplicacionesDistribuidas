const { Ticket } = require('../models/ticket');
const { visibilityFilter } = require('./ticketService');

function metricMatch(user) {
  if (user.role === 'admin') return {};
  return visibilityFilter(user);
}

async function getStats(user) {
  const match = metricMatch(user);
  const [result] = await Ticket.aggregate([
    { $match: match },
    {
      $facet: {
        byStatus: [
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $project: { _id: 0, status: '$_id', count: 1 } },
          { $sort: { status: 1 } }
        ],
        byPriority: [
          { $group: { _id: '$priority', count: { $sum: 1 } } },
          { $project: { _id: 0, priority: '$_id', count: 1 } },
          { $sort: { priority: 1 } }
        ],
        resolution: [
          { $match: { resolvedAt: { $ne: null } } },
          { $project: { durationMs: { $subtract: ['$resolvedAt', '$createdAt'] } } },
          { $group: { _id: null, averageMs: { $avg: '$durationMs' }, resolvedCount: { $sum: 1 } } },
          { $project: { _id: 0, averageMs: 1, resolvedCount: 1 } }
        ],
        workload: [
          { $match: { assignedAgent: { $ne: null }, status: { $ne: 'cerrado' } } },
          { $group: { _id: '$assignedAgent', activeTickets: { $sum: 1 } } },
          { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'agent' } },
          { $unwind: '$agent' },
          { $project: { _id: 0, agentId: '$_id', name: '$agent.name', activeTickets: 1 } },
          { $sort: { activeTickets: -1, name: 1 } }
        ]
      }
    }
  ]);

  return {
    byStatus: result?.byStatus || [],
    byPriority: result?.byPriority || [],
    resolution: result?.resolution[0] || { averageMs: null, resolvedCount: 0 },
    workload: result?.workload || []
  };
}

module.exports = { getStats };
