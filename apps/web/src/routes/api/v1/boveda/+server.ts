import { json } from '@sveltejs/kit';
import { exigirSesion } from '$lib/server/auth/sesiones';
import { db } from '$lib/server/db';

const b64 = (b: Buffer) => b.toString('base64url');

/** Páginas de la bóveda cambiadas desde `desde` (número de secuencia). */
export const GET = async ({ cookies, url }) => {
	const sesion = await exigirSesion(cookies);
	const desde = Number(url.searchParams.get('desde') ?? '0');
	const filas = await db()`
		select pagina_id, seq, version, nonce, cifrado from boveda_paginas
		where cuenta_id = ${sesion.id} and seq > ${Number.isFinite(desde) ? desde : 0}
		order by seq`;
	return json({
		paginas: filas.map((f) => ({
			pagina_id: f.pagina_id,
			seq: Number(f.seq),
			version: f.version,
			nonce: b64(f.nonce),
			cifrado: b64(f.cifrado)
		}))
	});
};
