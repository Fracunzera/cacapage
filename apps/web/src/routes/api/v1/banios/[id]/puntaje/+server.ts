import { error, json } from '@sveltejs/kit';
import { exigirSesion } from '$lib/server/auth/sesiones';
import { permitir } from '$lib/server/auth/limites';
import { db } from '$lib/server/db';
import { cuerpoJson, sinContenido } from '$lib/server/http';
import { exigirBanio } from '$lib/server/opiniones';

/** Puntaje de 1 a 5 rollos; uno por cuenta y baño, se puede cambiar. */
export const PUT = async (event) => {
	const sesion = await exigirSesion(event.cookies);
	await exigirBanio(event.params.id);
	if (!permitir(`puntaje:${sesion.id}`, 100, 24 * 3600_000)) error(429, 'Puntuaste muchos baños hoy. Probá mañana.');
	const { puntaje } = await cuerpoJson<{ puntaje: number }>(event);
	if (!Number.isInteger(puntaje) || puntaje < 1 || puntaje > 5) error(400, 'El puntaje va de 1 a 5.');
	await db()`insert into banio_puntajes (banio_id, cuenta_id, puntaje) values (${event.params.id}, ${sesion.id}, ${puntaje})
		on conflict (banio_id, cuenta_id) do update set puntaje = excluded.puntaje`;
	return json({ ok: true });
};

export const DELETE = async ({ params, cookies }) => {
	const sesion = await exigirSesion(cookies);
	await db()`delete from banio_puntajes where banio_id = ${params.id} and cuenta_id = ${sesion.id}`;
	return sinContenido();
};
