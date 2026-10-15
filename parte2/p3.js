/*
El siguiente servidor tiene varios errores. Identifique al menos seis, explique cada uno y entregue la versión corregida.

Errores identificados:
1. Orden de las rutas: La ruta para obtener un producto por ID debe estar después de la ruta para obtener productos destacados, ya que la ruta con el parámetro :id puede coincidir con "destacados" y causar un conflicto.
2. Falta middleware para parsear el cuerpo de las solicitudes POST: Se debe agregar `app.use(express.json())` para poder procesar los datos enviados en formato JSON.
3. En el middleware de manejo de errores no se incluía next, por lo cual no se tomaba en cuenta.
4. La creación de productos no devuelve un código de estado adecuado. Se debería devolver un 201 Created en lugar de 200 OK.
*/

const express = require('express');
const app = express();

app.use(express.json());

app.get('/api/productos/destacados', async (req, res) => {
  console.log('Obteniendo productos destacados');
  res.json(await Producto.find({ destacado: true }));
});

app.get('/api/productos/:id', async (req, res) => {
  console.log('Buscando producto con ID:', req.params.id);
  const p = await Producto.findById(req.params.id);
  if (!p) res.status(404).json({ error: 'No encontrado' });
  res.json(p);
});

app.post('/api/productos', async (req, res) => {
  const p = await Producto.create(req.body);
  res.status(201).json(p);
});

app.use((err, req, res, next) => {
  res.status(500).send(err.message);
});

app.listen(3000, () => {
  console.log('Servidor escuchando en http://localhost:3000');
});