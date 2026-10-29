import { error, json } from '@sveltejs/kit';
import { exigirSesion } from '$lib/server/auth/sesiones';
import { abrir, sellar } from '$lib/server/custodia';
import { db } from '$lib/server/db';
import { cuerpoJson } from '$lib/server/http';

/** El secreto de la bóveda, para abrir el historial en este celular. Solo con sesión. null: todavía no hay. */
export const GET = async ({ cookies }) => {
	const sesion = await exigirSesion(cookies);
	const [f] = await db()`select envuelta from boveda_llaves where cuenta_id = ${sesion.id} and metodo = 'servidor'`;
	if (!f) return json({ secreto: null });
	return json({ secreto: abrir(f.envuelta as Buffer, sesion.id).toString('base64url') });
};

/**
 * Guarda el secreto en custodia. `crear`: historial nuevo, falla con 409 si la
 * cuenta ya tiene cualquier llave (dos celulares no crean dos historiales).
 * Sin `crear`: historial viejo con código que pasa a custodia (solo si todavía
 * no hay custodia).
 */
export const PUT = async (event) => {
	const sesion = await exigirSesion(event.cookies);
	const { secreto, crear } = await cuerpoJson<{ secreto: string; crear?: boolean }>(event);
	if (typeof secreto !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(secreto)) error(400, 'Secreto inválido.');
	const bytes = Buffer.from(secreto, 'base64url');
	if (bytes.length !== 32) error(400, 'Secreto inválido.');
	const sql = db();
	const listo = await sql.begin(async (tx) => {
		await tx`select 1 from cuentas where id = ${sesion.id} for update`;
		const llaves = await tx`select metodo from boveda_llaves where cuenta_id = ${sesion.id}`;
		if (crear ? llaves.length > 0 : llaves.some((l) => l.metodo === 'servidor')) return false;
		await tx`insert into boveda_llaves (cuenta_id, metodo, envuelta, parametros)
			values (${sesion.id}, 'servidor', ${sellar(bytes, sesion.id)}, ${sql.json({ v: 1, custodia: 'aes-256-gcm/hkdf-pimienta' })})`;
		return true;
	});
	if (!listo) error(409, 'Esta cuenta ya tiene un historial.');
	return json({ ok: true });
};
