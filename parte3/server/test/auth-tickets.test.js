const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-for-integration';

const app = require('../src/app');
const User = require('../src/models/user');
const { Ticket } = require('../src/models/ticket');

let mongo;

function authCookie(user) {
  const token = jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '8h' });
  return `helpdesk_token=${token}`;
}

test.before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

test.beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Ticket.deleteMany({})]);
});

test('registra un cliente, inicia sesion con cookie HttpOnly y recupera /me', async () => {
  const agent = request.agent(app);
  const registration = await agent
    .post('/api/auth/register')
    .send({ name: 'Ana Cliente', email: 'ana@example.com', password: 'password-segura' });
  assert.equal(registration.status, 201);
  assert.equal(registration.body.data.user.role, 'cliente');

  const login = await agent
    .post('/api/auth/login')
    .send({ email: 'ana@example.com', password: 'password-segura' });
  assert.equal(login.status, 200);
  assert.match(login.headers['set-cookie'][0], /HttpOnly/);
  assert.match(login.headers['set-cookie'][0], /helpdesk_token=/);

  const session = await agent.get('/api/auth/me');
  assert.equal(session.status, 200);
  assert.equal(session.body.data.user.email, 'ana@example.com');
});

test('rechaza credenciales incorrectas y tickets de otro cliente', async () => {
  const first = request.agent(app);
  const second = request.agent(app);
  await first.post('/api/auth/register').send({ name: 'Primer Cliente', email: 'first@example.com', password: 'password-segura' });
  await first.post('/api/auth/login').send({ email: 'first@example.com', password: 'password-segura' });
  await second.post('/api/auth/register').send({ name: 'Segundo Cliente', email: 'second@example.com', password: 'password-segura' });
  await second.post('/api/auth/login').send({ email: 'second@example.com', password: 'password-segura' });

  const wrongLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'first@example.com', password: 'incorrecta' });
  assert.equal(wrongLogin.status, 401);

  const created = await first.post('/api/tickets').send({
    title: 'Portatil no inicia',
    description: 'El equipo muestra una pantalla negra al encenderlo.',
    category: 'hardware',
    priority: 'alta'
  });
  assert.equal(created.status, 201);

  const forbiddenDetail = await second.get(`/api/tickets/${created.body.data.ticket._id}`);
  assert.equal(forbiddenDetail.status, 404);
  const secondList = await second.get('/api/tickets');
  assert.equal(secondList.status, 200);
  assert.equal(secondList.body.data.pagination.total, 0);
});

test('devuelve errores de validacion uniformes', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ name: 'A', email: 'not-an-email', password: 'short' });
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  assert.ok(Array.isArray(response.body.error.details));
});

test('oculta notas internas a clientes en detalle y comentarios', async () => {
  const client = request.agent(app);
  await client.post('/api/auth/register').send({ name: 'Cliente Visible', email: 'visible@example.com', password: 'password-segura' });
  await client.post('/api/auth/login').send({ email: 'visible@example.com', password: 'password-segura' });

  const agentUser = await User.create({
    name: 'Agente Soporte',
    email: 'agent@example.com',
    password: await bcrypt.hash('password-segura', 12),
    role: 'agente'
  });
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: agentUser.email, password: 'password-segura' });

  const created = await client.post('/api/tickets').send({
    title: 'Error en la aplicacion',
    description: 'La aplicacion falla al abrir el modulo de informes.',
    category: 'software',
    priority: 'alta'
  });
  const ticketId = created.body.data.ticket._id;
  assert.equal((await agent.patch(`/api/tickets/${ticketId}/asignar`).send({})).status, 200);
  assert.equal((await agent.post(`/api/tickets/${ticketId}/comentarios`).send({ body: 'Revisar logs antes de responder.', internal: true })).status, 201);

  const clientDetail = await client.get(`/api/tickets/${ticketId}`);
  const clientComments = await client.get(`/api/tickets/${ticketId}/comentarios`);
  const agentDetail = await agent.get(`/api/tickets/${ticketId}`);
  assert.equal(clientDetail.status, 200);
  assert.equal(clientDetail.body.data.ticket.comments.length, 0);
  assert.equal(clientComments.body.data.comments.length, 0);
  assert.equal(agentDetail.body.data.ticket.comments.length, 1);
});

test('la autoasignacion concurrente tiene un unico ganador', async () => {
  const client = request.agent(app);
  await client.post('/api/auth/register').send({ name: 'Cliente Asignacion', email: 'owner@example.com', password: 'password-segura' });
  await client.post('/api/auth/login').send({ email: 'owner@example.com', password: 'password-segura' });
  const created = await client.post('/api/tickets').send({
    title: 'Necesito asignacion',
    description: 'La incidencia necesita que un agente la revise.',
    category: 'red',
    priority: 'media'
  });

  const agentUsers = await User.create([
    { name: 'Agente Uno', email: 'one@example.com', password: await bcrypt.hash('password-segura', 12), role: 'agente' },
    { name: 'Agente Dos', email: 'two@example.com', password: await bcrypt.hash('password-segura', 12), role: 'agente' }
  ]);
  const agents = [request.agent(app), request.agent(app)];
  await Promise.all(agents.map((agent, index) => agent.post('/api/auth/login').send({ email: agentUsers[index].email, password: 'password-segura' })));
  const results = await Promise.all(agents.map((agent) => agent.patch(`/api/tickets/${created.body.data.ticket._id}/asignar`).send({})));
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
});

test('protege metricas y usuarios por rol', async () => {
  const password = await bcrypt.hash('password-segura', 12);
  const [adminUser, agentUser, clientUser] = await User.create([
    { name: 'Admin Principal', email: 'admin@example.com', password, role: 'admin' },
    { name: 'Agente Metricas', email: 'metrics@example.com', password, role: 'agente' },
    { name: 'Cliente Metricas', email: 'metrics-client@example.com', password, role: 'cliente' }
  ]);
  const admin = request.agent(app);
  const agentToken = jwt.sign({ sub: agentUser._id.toString() }, process.env.JWT_SECRET, { expiresIn: '8h' });
  const clientToken = jwt.sign({ sub: clientUser._id.toString() }, process.env.JWT_SECRET, { expiresIn: '8h' });
  const agent = request(app);
  const client = request(app);
  await admin.post('/api/auth/login').send({ email: adminUser.email, password: 'password-segura' });
  const agentCookie = `helpdesk_token=${agentToken}`;
  const clientCookie = `helpdesk_token=${clientToken}`;

  const created = await admin.post('/api/tickets').send({
    title: 'Ticket para metricas',
    description: 'Este ticket alimenta las agregaciones del panel.',
    category: 'cuenta',
    priority: 'critica'
  });
  assert.equal((await agent.patch(`/api/tickets/${created.body.data.ticket._id}/asignar`).set('Cookie', agentCookie).send({})).status, 200);
  const stats = await agent.get('/api/tickets/stats').set('Cookie', agentCookie);
  assert.equal(stats.status, 200);
  assert.equal(stats.body.data.byPriority[0].priority, 'critica');
  assert.equal(stats.body.data.workload[0].activeTickets, 1);

  const forbiddenStats = await client.get('/api/tickets/stats').set('Cookie', clientCookie);
  assert.equal(forbiddenStats.status, 403);
  const users = await admin.get('/api/users');
  assert.equal(users.status, 200);
  assert.equal(users.body.data.users.some((user) => user.password), false);
  assert.equal((await client.get('/api/users').set('Cookie', clientCookie)).status, 403);
});

test('aplica transiciones permitidas y rechaza las prohibidas', async () => {
  const password = await bcrypt.hash('password-segura', 12);
  const [clientUser, agentUser] = await User.create([
    { name: 'Cliente Estados', email: 'states-client@example.com', password, role: 'cliente' },
    { name: 'Agente Estados', email: 'states-agent@example.com', password, role: 'agente' }
  ]);
  const ticket = await request(app).post('/api/tickets').set('Cookie', authCookie(clientUser)).send({
    title: 'Flujo de estados', description: 'Ticket para comprobar las transiciones permitidas.', category: 'software', priority: 'media'
  });
  const ticketId = ticket.body.data.ticket._id;
  const forbidden = await request(app).patch(`/api/tickets/${ticketId}/estado`).set('Cookie', authCookie(clientUser)).send({ status: 'cerrado' });
  assert.equal(forbidden.status, 409);
  const assigned = await request(app).patch(`/api/tickets/${ticketId}/asignar`).set('Cookie', authCookie(agentUser)).send({});
  assert.equal(assigned.status, 200);
  const progressing = await request(app).patch(`/api/tickets/${ticketId}/estado`).set('Cookie', authCookie(agentUser)).send({ status: 'en_progreso' });
  assert.equal(progressing.status, 200);
  const resolved = await request(app).patch(`/api/tickets/${ticketId}/estado`).set('Cookie', authCookie(agentUser)).send({ status: 'resuelto' });
  assert.equal(resolved.status, 200);
  const agentClose = await request(app).patch(`/api/tickets/${ticketId}/estado`).set('Cookie', authCookie(agentUser)).send({ status: 'cerrado' });
  assert.equal(agentClose.status, 409);
  const clientClose = await request(app).patch(`/api/tickets/${ticketId}/estado`).set('Cookie', authCookie(clientUser)).send({ status: 'cerrado' });
  assert.equal(clientClose.status, 200);
  const detail = await request(app).get(`/api/tickets/${ticketId}`).set('Cookie', authCookie(agentUser));
  assert.equal(detail.body.data.ticket.history.length, 4);
});

test('revoca una sesion cuando la cuenta queda desactivada', async () => {
  const user = await User.create({ name: 'Cuenta Desactivada', email: 'inactive@example.com', password: await bcrypt.hash('password-segura', 12), role: 'cliente' });
  const cookie = authCookie(user);
  await User.updateOne({ _id: user._id }, { active: false });
  const response = await request(app).get('/api/auth/me').set('Cookie', cookie);
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'ACCOUNT_INACTIVE');
});

test('aplica filtros y paginacion en el servidor', async () => {
  const user = await User.create({ name: 'Cliente Filtros', email: 'filters@example.com', password: await bcrypt.hash('password-segura', 12), role: 'cliente' });
  const cookie = authCookie(user);
  for (const [index, category] of ['red', 'software', 'red'].entries()) {
    const response = await request(app).post('/api/tickets').set('Cookie', cookie).send({
      title: `Ticket filtrable ${index}`, description: 'Descripcion suficientemente larga para validar el ticket.', category, priority: 'media'
    });
    assert.equal(response.status, 201);
  }
  const response = await request(app).get('/api/tickets').set('Cookie', cookie).query({ category: 'red', page: 1, pageSize: 1, sortBy: 'title', sortDirection: 'asc' });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.items.length, 1);
  assert.equal(response.body.data.pagination.total, 2);
  assert.equal(response.body.data.pagination.pages, 2);
});

test('permite al administrador cambiar roles sin exponer contrasenas', async () => {
  const password = await bcrypt.hash('password-segura', 12);
  const [admin, target] = await User.create([
    { name: 'Admin Roles', email: 'roles-admin@example.com', password, role: 'admin' },
    { name: 'Usuario Objetivo', email: 'role-target@example.com', password, role: 'cliente' }
  ]);
  const response = await request(app).patch(`/api/users/${target._id}`).set('Cookie', authCookie(admin)).send({ role: 'agente' });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.user.role, 'agente');
  assert.equal(response.body.data.user.password, undefined);
  const selfUpdate = await request(app).patch(`/api/users/${admin._id}`).set('Cookie', authCookie(admin)).send({ role: 'cliente' });
  assert.equal(selfUpdate.status, 409);
});

test('rechaza solicitudes mutables desde un origen no permitido', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .set('Origin', 'https://sitio-no-autorizado.example')
    .send({ name: 'Origen Externo', email: 'origin@example.com', password: 'password-segura' });
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'ORIGIN_NOT_ALLOWED');
});
