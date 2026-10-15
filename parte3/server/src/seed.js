require('./config/env');

const bcrypt = require('bcryptjs');
const { connectDatabase } = require('./config/database');
const User = require('./models/user');
const { Ticket, categories, priorities, statuses } = require('./models/ticket');
const Comment = require('./models/comment');
const StatusHistory = require('./models/statusHistory');

function assertChronology(tickets, historyRows) {
  const historyByTicket = new Map();
  historyRows.forEach((row) => {
    const key = row.ticket.toString();
    const history = historyByTicket.get(key) || [];
    history.push(row);
    historyByTicket.set(key, history);
  });

  tickets.forEach((ticket) => {
    if (ticket.updatedAt < ticket.createdAt) throw new Error(`Fechas invalidas en ${ticket.title}`);
    if (ticket.resolvedAt && ticket.resolvedAt <= ticket.createdAt) throw new Error(`Resolucion anterior a creacion en ${ticket.title}`);

    const history = historyByTicket.get(ticket._id.toString()) || [];
    if (history.length === 0 || history[0].fromStatus !== null || history[0].toStatus !== 'abierto') {
      throw new Error(`Historial inicial invalido en ${ticket.title}`);
    }
    for (let index = 1; index < history.length; index += 1) {
      if (history[index].createdAt <= history[index - 1].createdAt || history[index].fromStatus !== history[index - 1].toStatus) {
        throw new Error(`Secuencia de historial invalida en ${ticket.title}`);
      }
    }
    const closingTransition = history.find((entry) => entry.toStatus === 'cerrado');
    if (closingTransition && closingTransition.changedBy.toString() !== ticket.creator.toString()) {
      throw new Error(`Cierre realizado por un usuario distinto al creador en ${ticket.title}`);
    }
    if (history[history.length - 1].toStatus !== ticket.status) throw new Error(`Estado final sin historial en ${ticket.title}`);
  });
}

function assertGeneratedData(users, clients, agents, tickets) {
  if (users.length !== 6 || clients.length !== 3 || agents.length !== 2) {
    throw new Error('El seed debe generar 3 clientes, 2 agentes y 1 administrador');
  }

  const clientIds = new Set(clients.map((user) => user._id.toString()));
  const agentIds = new Set(agents.map((user) => user._id.toString()));
  if (tickets.length !== 30) throw new Error('El seed debe generar exactamente 30 tickets');

  tickets.forEach((ticket) => {
    if (!statuses.includes(ticket.status) || !categories.includes(ticket.category) || !priorities.includes(ticket.priority)) {
      throw new Error(`Valores enumerados invalidos en ${ticket.title}`);
    }
    if (!clientIds.has(ticket.creator.toString())) throw new Error(`Creador invalido en ${ticket.title}`);
    if (ticket.assignedAgent && !agentIds.has(ticket.assignedAgent.toString())) {
      throw new Error(`Agente asignado invalido en ${ticket.title}`);
    }
    if (ticket.status === 'abierto' || ticket.status === 'en_progreso') {
      if (ticket.resolvedAt !== null) throw new Error(`Ticket no resuelto con resolvedAt en ${ticket.title}`);
    } else if (!ticket.resolvedAt || ticket.resolvedAt <= ticket.createdAt) {
      throw new Error(`Ticket resuelto sin fecha posterior en ${ticket.title}`);
    }
  });
}

async function seed() {
  await connectDatabase();
  await Promise.all([
    User.deleteMany({}),
    Ticket.deleteMany({}),
    Comment.deleteMany({}),
    StatusHistory.deleteMany({})
  ]);

  const password = await bcrypt.hash('HelpDesk123!', 12);
  const users = await User.create([
    ...[1, 2, 3].map((number) => ({ name: `Cliente ${number}`, email: `cliente${number}@demo.local`, password, role: 'cliente' })),
    ...[1, 2].map((number) => ({ name: `Agente ${number}`, email: `agente${number}@demo.local`, password, role: 'agente' })),
    { name: 'Administrador', email: 'admin@demo.local', password, role: 'admin' }
  ]);

  const clients = users.filter((user) => user.role === 'cliente');
  const agents = users.filter((user) => user.role === 'agente');
  const statusValues = statuses;
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const tickets = [];

  for (let index = 0; index < 30; index += 1) {
    const status = statusValues[index % statusValues.length];
    const createdAt = new Date(now.getTime() - (45 - index) * dayMs);
    const progressAt = new Date(createdAt.getTime() + 8 * hourMs);
    const resolvedAt = new Date(createdAt.getTime() + 24 * hourMs);
    const closedAt = new Date(createdAt.getTime() + 32 * hourMs);
    const assignedAgent = status === 'abierto' && index % 3 === 0
      ? null
      : agents[index % agents.length]._id;
    const updatedAt = status === 'cerrado'
      ? closedAt
      : status === 'resuelto'
        ? resolvedAt
        : status === 'en_progreso'
          ? progressAt
          : createdAt;

    tickets.push({
      title: `Incidencia de demostracion ${index + 1}`,
      description: `Descripcion de la incidencia de prueba numero ${index + 1}.`,
      category: categories[index % categories.length],
      priority: priorities[index % priorities.length],
      status,
      resolvedAt: ['resuelto', 'cerrado'].includes(status) ? resolvedAt : null,
      creator: clients[index % clients.length]._id,
      assignedAgent,
      createdAt,
      updatedAt
    });
  }

  assertGeneratedData(users, clients, agents, tickets);
  const createdTickets = await Ticket.create(tickets);
  const historyRows = [];
  const commentRows = [];

  createdTickets.forEach((ticket, index) => {
    const createdAt = ticket.createdAt;
    const progressAt = new Date(createdAt.getTime() + 8 * hourMs);
    const resolvedAt = new Date(createdAt.getTime() + 24 * hourMs);
    const closedAt = new Date(createdAt.getTime() + 32 * hourMs);
    const transitions = [{ fromStatus: null, toStatus: 'abierto', at: createdAt }];
    const agent = agents[index % agents.length];

    if (['en_progreso', 'resuelto', 'cerrado'].includes(ticket.status)) {
      transitions.push({ fromStatus: 'abierto', toStatus: 'en_progreso', at: progressAt });
    }
    if (['resuelto', 'cerrado'].includes(ticket.status)) {
      transitions.push({ fromStatus: 'en_progreso', toStatus: 'resuelto', at: resolvedAt });
    }
    if (ticket.status === 'cerrado') {
      transitions.push({ fromStatus: 'resuelto', toStatus: 'cerrado', at: closedAt });
    }

    transitions.forEach((transition, transitionIndex) => {
      historyRows.push({
        ticket: ticket._id,
        fromStatus: transition.fromStatus,
        toStatus: transition.toStatus,
        changedBy: transition.toStatus === 'cerrado'
          ? ticket.creator
          : transitionIndex === 0
            ? ticket.creator
            : agent._id,
        createdAt: transition.at,
        updatedAt: transition.at
      });
    });

    if (index < 6) {
      commentRows.push({
        ticket: ticket._id,
        author: clients[index % clients.length]._id,
        body: 'Comentario publico de demostracion.',
        internal: false,
        createdAt: new Date(createdAt.getTime() + 4 * hourMs),
        updatedAt: new Date(createdAt.getTime() + 4 * hourMs)
      });
    }
    if (index < 3 && ticket.assignedAgent) {
      commentRows.push({
        ticket: ticket._id,
        author: agent._id,
        body: 'Nota interna de seguimiento para el agente.',
        internal: true,
        createdAt: new Date(createdAt.getTime() + 12 * hourMs),
        updatedAt: new Date(createdAt.getTime() + 12 * hourMs)
      });
    }
  });

  assertChronology(createdTickets, historyRows);
  await StatusHistory.insertMany(historyRows);
  await Comment.insertMany(commentRows);

  console.log(`Seed completado: ${users.length} usuarios, ${createdTickets.length} tickets.`);
  console.log('Credenciales de desarrollo: contraseña HelpDesk123! para todos los usuarios.');
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('No se pudo ejecutar el seed', error);
    process.exit(1);
  });
