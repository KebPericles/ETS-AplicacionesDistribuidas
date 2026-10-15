# HelpDesk MERN

Aplicacion de gestion de incidencias con Node.js, Express, MongoDB, Mongoose y React.

## Estado actual

Implementado y verificado:

- Autenticacion de clientes con bcrypt y JWT en cookie `HttpOnly`.
- Sesion mediante `GET /api/auth/me` y bloqueo de cuentas inactivas.
- Tickets con categorias, prioridades, estados, historial y visibilidad por rol.
- Paginacion, filtros, busqueda de texto y ordenamiento controlado.
- Comentarios publicos y notas internas filtradas en el servidor.
- Autoasignacion condicional de agentes y asignacion administrativa.
- Metricas mediante agregaciones MongoDB.
- Gestion administrativa de usuarios.
- Primera interfaz React para login, registro, listado y creacion de tickets.
- Once pruebas de integracion con MongoDB en memoria mediante replica set.

Pendiente: selector visual para cambiar roles desde administracion, ejecucion de `explain()` contra la instancia MongoDB de entrega y guion final de demostracion.

## Estructura

- `server/`: API Express, modelos Mongoose, servicios, pruebas y seed.
- `client/`: aplicacion React/Vite.
- `.env.example`: variables de entorno de referencia.
- `docs/architecture.md`: arquitectura, referencias, métricas y matriz de permisos.
- `docs/demo-script.md`: guion de demostración de 5 a 8 minutos.
- `docs/acceptance.md`: checklist de requisitos con evidencias y pendientes.

## Requisitos

- Node.js 22 LTS o superior.
- MongoDB 7 o superior para ejecucion local.
- npm 11 o compatible.

## Configuracion y ejecucion

```bash
cp .env.example .env
npm install
npm run start
```

La API escucha en `http://localhost:3000`. Para el frontend:

```bash
npm run dev --workspace client
```

El frontend espera la API en `http://localhost:3000/api`; puede cambiarse con `VITE_API_URL`.

## Pruebas

```bash
npm test
npm run build --workspace client
```

Las pruebas usan `mongodb-memory-server` y no necesitan una base de datos externa. En este entorno el script fija `MONGOMS_DISTRO=ubuntu-22.04` porque la deteccion automatica de la distribucion no esta disponible.

## Seed

Con MongoDB ejecutandose y `.env` configurado:

```bash
npm run seed
```

El seed reemplaza los datos de la base configurada y crea 3 clientes, 2 agentes, 1 administrador, 30 tickets, historial y comentarios. Cada ticket se crea entre 16 y 45 días antes de la ejecución; las transiciones se generan en orden y `resolvedAt` siempre es posterior a `createdAt`. El seed valida fechas, continuidad del historial y estado final antes de insertar la auditoría. Las credenciales son solo para desarrollo: todos usan la contraseña `HelpDesk123!`.

## Seguridad

La autorizacion se comprueba en el servidor consultando el usuario activo en MongoDB. El rol del navegador o de un JWT antiguo no es suficiente para conceder permisos. Las cookies son `HttpOnly`, `SameSite=Lax` en desarrollo y `Secure`/`SameSite=Strict` en produccion. CORS acepta unicamente los origenes configurados en `CLIENT_ORIGIN` y las solicitudes mutables con `Origin` externo se rechazan explícitamente; el login tiene rate limiting y las entradas se validan con Zod.

Las notas internas se filtran en las consultas de detalle y comentarios cuando el usuario es cliente. Los hashes de contraseña no se devuelven en las consultas publicas de usuarios.

## API implementada

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/tickets`
- `POST /api/tickets`
- `GET /api/tickets/stats`
- `GET /api/tickets/:id`
- `PATCH /api/tickets/:id/estado`
- `PATCH /api/tickets/:id/asignar`
- `GET/POST /api/tickets/:id/comentarios`
- `GET /api/users`
- `PATCH /api/users/:id`

La especificacion esta en `openapi.yaml`.

## Indices y explain

Los indices de `User` cubren la seleccion de agentes activos por rol. En `Ticket`:

- `{ creator: 1, createdAt: -1 }` optimiza el listado de tickets de un cliente ordenado por fecha.
- `{ assignedAgent: 1, status: 1, createdAt: -1 }` optimiza tickets asignados/no asignados para agentes.
- `{ status: 1, priority: 1, category: 1, createdAt: -1 }` acompaña los filtros combinados del listado.
- `{ title: 'text', description: 'text' }` permite la busqueda controlada por texto.
- `Comment` usa `{ ticket: 1, internal: 1, createdAt: 1 }` para detalle y filtrado server-side.

Con MongoDB ejecutandose, las consultas principales pueden comprobarse sin afirmar resultados no observados:

```javascript
db.tickets.find({ creator: ObjectId('CLIENTE_ID') }).sort({ createdAt: -1 }).explain('executionStats')
db.tickets.find({ assignedAgent: null, status: 'abierto' }).sort({ createdAt: -1 }).explain('executionStats')
db.comments.find({ ticket: ObjectId('TICKET_ID'), internal: false }).sort({ createdAt: 1 }).explain('executionStats')
```

La conclusion debe registrarse despues de ejecutar esas consultas: revisar `winningPlan`, `IXSCAN` y `totalDocsExamined` frente a `nReturned`. No se incluye una metrica inventada.

La evidencia de seed y `explain()` depende de una instancia MongoDB local; este entorno no tiene `mongod` ni `mongosh` instalados. Las pruebas aisladas sí usan un replica set de `mongodb-memory-server`.
