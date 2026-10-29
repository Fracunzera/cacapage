import { error, json } from '@sveltejs/kit';
import { exigirSesion } from '$lib/server/auth/sesiones';
import { db } from '$lib/server/db';
import { sinContenido } from '$lib/server/http';

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

/**
 * Empezar de cero cuando se perdió el código de recuperación: se borran las
 * páginas y la llave envuelta. Lo cifrado ya no se puede leer, así que es
 * irreversible. Exige haber entrado hace menos de 5 minutos.
 */
export const DELETE = async ({ cookies }) => {
	const sesion = await exigirSesion(cookies);
	if (!sesion.reautenticada) error(403, 'Por seguridad, volvé a entrar (hace menos de 5 minutos) para empezar de cero.');
	await db().begin(async (tx) => {
		await tx`delete from boveda_paginas where cuenta_id = ${sesion.id}`;
		await tx`delete from boveda_llaves where cuenta_id = ${sesion.id}`;
	});
	return sinContenido();
};
