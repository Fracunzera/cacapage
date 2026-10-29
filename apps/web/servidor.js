// Punto de entrada en producción: `node servidor.js` (Dockerfile). Arranca el
// servidor de adapter-node tal cual (build/index.js), con una protección antes:
//
// Los archivos estáticos (build/client) los sirve sirv dentro de adapter-node,
// que abre el archivo sin atajar el error. Si uno no se puede leer (por
// ejemplo, por permisos), el error sin atajar tira el proceso entero. Acá:
// 1. antes de cada GET/HEAD se verifica que el archivo que corresponde (y sus
//    versiones .br y .gz) se pueda leer; si no, 500 y el servidor sigue;
// 2. red de seguridad: si igual se escapa un error de apertura de archivo
//    (cambió entre la verificación y la lectura), se registra y no se cae.
import { accessSync, constants, statSync } from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, normalize, sep } from 'node:path';

const CLIENTE = fileURLToPath(new URL('./build/client', import.meta.url));

function legible(url) {
	let ruta;
	try {
		ruta = decodeURIComponent(new URL(url, 'http://x').pathname);
	} catch {
		return true;
	}
	const base = join(CLIENTE, normalize(ruta));
	if (!base.startsWith(CLIENTE + sep)) return true;
	for (const archivo of [base, base + '.br', base + '.gz']) {
		try {
			if (statSync(archivo).isFile()) accessSync(archivo, constants.R_OK);
		} catch (e) {
			if (e.code === 'EACCES' || e.code === 'EPERM') return false;
		}
	}
	return true;
}

const emitir = http.Server.prototype.emit;
http.Server.prototype.emit = function (evento, req, res) {
	if (evento === 'request' && (req.method === 'GET' || req.method === 'HEAD') && !legible(req.url)) {
		console.error('Estáticos: hay un archivo que no se puede leer (revisá los permisos de build/client)');
		res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end('Error interno: no se pudo leer un archivo del sitio.');
		return true;
	}
	return emitir.apply(this, arguments);
};

const ERRORES_DE_ARCHIVO = new Set(['EACCES', 'EPERM', 'ENOENT', 'EISDIR', 'EMFILE']);
process.on('uncaughtException', (e) => {
	if (e && e.syscall === 'open' && ERRORES_DE_ARCHIVO.has(e.code)) {
		console.error(`Estáticos: error al abrir un archivo (${e.code}); el servidor sigue.`);
		return;
	}
	// Cualquier otro error: igual que sin este manejador, el proceso termina.
	console.error(e);
	process.exit(1);
});

await import('./build/index.js');
