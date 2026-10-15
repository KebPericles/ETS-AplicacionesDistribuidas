/*
Escriba el script contar.js que reciba por línea de comandos la ruta de un archivo CSV (puede pesar más de 2GB) con el encabezado id,categoria,monto. Debe mostrar, por categoría, el número de registros y la suma de los montos, sin cargar el archivo completo en memoria, ignorando líneas vacías o con montos inválidos. Uso: node contar.js ventas.csv
*/

const fs = require('node:fs');
const readline = require('node:readline');

function convertirMonto(texto) {
	const valor = texto.trim();

	if (valor === '') {
		return null;
	}

	const monto = Number(valor); // Los valores no numéricos se convierten a NaN, que no es finito
	return Number.isFinite(monto) ? monto : null;
}

async function contarArchivo(ruta) {
	const archivo = fs.createReadStream(ruta, { encoding: 'utf8' });
	const lineas = readline.createInterface({
		input: archivo,
		crlfDelay: Infinity
	});
	const totales = new Map();
	let numeroLinea = 0;

	try {
		for await (const linea of lineas) {
			numeroLinea += 1;

			if (numeroLinea === 1) {
				if (linea.trim() !== 'id,categoria,monto') {
					throw new Error('El encabezado debe ser: id,categoria,monto');
				}
				continue;
			}

			if (linea.trim() === '') {
				continue;
			}

			const campos = linea.split(',');
			if (campos.length !== 3) {
				continue;
			}

			const categoria = campos[1].trim();
			const monto = convertirMonto(campos[2]);

			if (monto === null) {
				continue;
			}

			const acumulado = totales.get(categoria) || { conteo: 0, suma: 0 };
			acumulado.conteo += 1;
			acumulado.suma += monto;
			totales.set(categoria, acumulado);
		}
	} finally {
		lineas.close();
	}

	if (numeroLinea === 0) {
		throw new Error('El archivo está vacío; debe incluir el encabezado id,categoria,monto');
	}

	for (const [categoria, acumulado] of totales) {
		console.log(`${categoria}: ${acumulado.conteo} registros, suma: ${acumulado.suma.toFixed(2)}`);
	}
}

async function main() {
	if (process.argv.length !== 3) {
		console.error('Uso: node contar.js ventas.csv');
		process.exitCode = 1;
		return;
	}

	try {
		await contarArchivo(process.argv[2]);
	} catch (error) {
		console.error(`Error: ${error.message}`);
		process.exitCode = 1;
	}
}

main();

