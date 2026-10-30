import { json } from '@sveltejs/kit';
import { exigirSesion } from '$lib/server/auth/sesiones';
import { db } from '$lib/server/db';

/** Mis amigos (seudónimo y desde cuándo). */
export const GET = async ({ cookies }) => {
	const sesion = await exigirSesion(cookies);
	const filas = await db()`
		select c.seudonimo, a.desde from amistades a
		join cuentas c on c.id = case when a.cuenta_a = ${sesion.id} then a.cuenta_b else a.cuenta_a end
		where (a.cuenta_a = ${sesion.id} or a.cuenta_b = ${sesion.id}) and c.estado = 'activa'
		order by c.seudonimo`;
	return json({ amigos: filas.map((f) => ({ seudonimo: f.seudonimo, desde: (f.desde as Date).toISOString().slice(0, 10) })) });
};
