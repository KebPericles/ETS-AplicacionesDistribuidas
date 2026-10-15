/*
Implemente la función async obtenerUsuarios(ids, fetchUser, ms = 2000), donde fetchUser(id) devuelve una
Promise con el usuario. La función debe:
 Ejecutar todas las peticiones en paralelo.
 No fallar si alguna petición falla.
 Aplicar un tiempo límite de ms milisegundos a cada petición.
 Devolver un objeto { ok: [usuarios], errores: [{ id, mensaje }] }.
*/
async function obtenerUsuarios(ids, fetchUser, ms = 2000) {
  const promises = ids.map(id => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Tiempo límite excedido para el usuario ${id}`));
      }, ms);

      fetchUser(id)
        .then(user => {
          clearTimeout(timeout);
          resolve(user);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  });

  const results = await Promise.allSettled(promises);

  const ok = [];
  const errores = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      ok.push(result.value);
    } else {
      errores.push({ id: ids[index], mensaje: result.reason.message });
    }
  });

  return { ok, errores };
}