import { error, json } from '@sveltejs/kit';
import { exigirSesion } from '$lib/server/auth/sesiones';
import { db } from '$lib/server/db';
import { cuerpoJson } from '$lib/server/http';

/** Formas de desenvolver la llave de la bóveda (la llave misma nunca llega acá). */
export const GET = async ({ cookies }) => {
	const sesion = await exigirSesion(cookies);
	const filas = await db()`select metodo, credencial_id, envuelta, parametros from boveda_llaves where cuenta_id = ${sesion.id}`;
	return json({
		llaves: filas.map((f) => ({
			metodo: f.metodo,
			credencial_id: f.credencial_id || null,
			envuelta: (f.envuelta as Buffer).toString('base64url'),
			parametros: f.parametros
		}))
	});
};

/**
 * Crea o reemplaza una llave envuelta. `crear: true` falla con 409 si la cuenta
 * ya tiene llave de recuperación: evita que dos dispositivos creen dos bóvedas
 * distintas para la misma cuenta.
 */
export const PUT = async (event) => {
	const sesion = await exigirSesion(event.cookies);
	const c = await cuerpoJson<{ metodo: string; credencial_id?: string; envuelta: string; parametros: object; crear?: boolean }>(event);
	if (c.metodo !== 'recuperacion') error(400, 'Método no soportado todavía.');
	if (typeof c.envuelta !== 'string' || !/^[A-Za-z0-9_-]{40,200}$/.test(c.envuelta)) error(400, 'Llave inválida.');
	if (!c.parametros || typeof c.parametros !== 'object' || JSON.stringify(c.parametros).length > 500) error(400, 'Parámetros inválidos.');
	const sql = db();
	const envuelta = Buffer.from(c.envuelta, 'base64url');
	if (c.crear) {
		const filas = await sql`insert into boveda_llaves (cuenta_id, metodo, envuelta, parametros)
			values (${sesion.id}, 'recuperacion', ${envuelta}, ${sql.json(c.parametros as never)})
			on conflict do nothing returning 1`;
		if (!filas.length) error(409, 'Esta cuenta ya tiene un historial. Ingresá tu código de recuperación.');
	} else {
		const filas = await sql`update boveda_llaves set envuelta = ${envuelta}, parametros = ${sql.json(c.parametros as never)}
			where cuenta_id = ${sesion.id} and metodo = 'recuperacion' returning 1`;
		if (!filas.length) error(404, 'No hay llave para reemplazar.');
	}
	return json({ ok: true });
};
