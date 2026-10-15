# Guion de demostración (5-8 minutos)

## 0:00-0:45. Arquitectura

Mostrar `docs/architecture.md`, explicar React -> Express -> servicios -> Mongoose/MongoDB y la cookie JWT HttpOnly. Mencionar que la autorización se repite en servidor y no depende de la interfaz.

## 0:45-2:15. Cliente

Entrar como `cliente1@demo.local` con contraseña `HelpDesk123!`. Crear un ticket con categoría y prioridad. Mostrar filtros, búsqueda, paginación y detalle con historial. Como cliente, intentar ver una nota interna no debe mostrarla. En estado `resuelto`, demostrar cerrar y reabrir.

## 2:15-4:15. Agente

Entrar como `agente1@demo.local`. Mostrar tickets no asignados, autoasignar uno y cambiarlo a `en_progreso` y después `resuelto`. Añadir un comentario público y una nota interna. Abrir métricas y explicar estados, prioridades, tiempo medio y carga.

## 4:15-5:45. Administrador

Entrar como `admin@demo.local`. Mostrar todos los tickets, cambiar la asignación a un agente y abrir usuarios. Cambiar el rol de un usuario y activar/desactivar una cuenta. Explicar que una sesión de cuenta desactivada falla porque el servidor vuelve a consultar el usuario.

## 5:45-7:00. Seguridad y pruebas

Mostrar la cookie `helpdesk_token` como HttpOnly, ejecutar `npm test` y `npm run test:client`. Explicar la carrera de autoasignación, el filtrado server-side de notas y la validación de Origin. Si MongoDB local está disponible, mostrar el seed y una consulta `explain()` real; si no, indicar honestamente que esa evidencia queda pendiente del entorno.
