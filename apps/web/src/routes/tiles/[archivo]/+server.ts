import { open, type FileHandle } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cfg } from '$lib/server/config';

/**
 * Mapa base en PMTiles, con pedidos por rango (DESIGN.md §12.3). En el VPS
 * conviene que lo sirva nginx directo (docs/despliegue.md); esto es para que
 * funcione igual sin esa configuración.
 */
export const GET: RequestHandler = async ({ params, request }) => {
	if (!/^[a-z0-9-]+\.pmtiles$/.test(params.archivo)) error(404, 'No encontrado');
	const ruta = join(cfg().teselasDir, params.archivo);
	// Se abre antes de responder: si no se puede leer (permisos), es un 500 y
	// no una conexión cortada a mitad de camino.
	let archivo: FileHandle;
	try {
		archivo = await open(ruta, 'r');
	} catch (e) {
		const codigo = (e as NodeJS.ErrnoException).code;
		if (codigo === 'ENOENT' || codigo === 'ENOTDIR') error(404, 'No hay mapa base cargado');
		console.error(`Teselas: no se puede abrir ${params.archivo} (${codigo})`);
		error(500, 'No se pudo leer el mapa base');
	}
	const info = await archivo.stat();
	if (!info.isFile()) {
		await archivo.close();
		error(404, 'No hay mapa base cargado');
	}
	/** El stream cierra el archivo al terminar o si el cliente corta. */
	const leer = (opciones: { start?: number; end?: number } = {}) =>
		Readable.toWeb(archivo.createReadStream({ ...opciones, autoClose: true })) as ReadableStream;

	const cabeceras: Record<string, string> = {
		'Content-Type': 'application/vnd.pmtiles',
		'Accept-Ranges': 'bytes',
		'Cache-Control': 'public, max-age=86400',
		ETag: `"${info.size.toString(36)}-${info.mtimeMs.toString(36)}"`,
		'Last-Modified': info.mtime.toUTCString()
	};
	const rango = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
	if (!rango) return new Response(leer(), { headers: { ...cabeceras, 'Content-Length': String(info.size) } });
	let desde: number;
	let hasta: number;
	if (rango[1] === '') {
		desde = Math.max(0, info.size - Number(rango[2]));
		hasta = info.size - 1;
	} else {
		desde = Number(rango[1]);
		hasta = rango[2] === '' ? info.size - 1 : Math.min(Number(rango[2]), info.size - 1);
	}
	if (desde > hasta || desde >= info.size) {
		await archivo.close();
		return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${info.size}` } });
	}
	return new Response(leer({ start: desde, end: hasta }), {
		status: 206,
		headers: { ...cabeceras, 'Content-Range': `bytes ${desde}-${hasta}/${info.size}`, 'Content-Length': String(hasta - desde + 1) }
	});
};
