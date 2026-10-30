import { error, json } from '@sveltejs/kit';
import { DIAS_INVITACION } from '$lib/server/amigos';
import { hashToken, tokenAleatorio } from '$lib/server/auth/cripto';
import { permitir } from '$lib/server/auth/limites';
import { exigirSesion } from '$lib/server/auth/sesiones';
import { db } from '$lib/server/db';
import { sinContenido } from '$lib/server/http';

/**
 * Link de invitación nuevo (reemplaza al anterior): vale una semana y para
 * varias personas. Se devuelve una sola vez; la base guarda solo su hash.
 */
export const POST = async ({ cookies }) => {
	const sesion = await exigirSesion(cookies);
	if (!permitir(`invitacion:${sesion.id}`, 20, 24 * 3600_000)) error(429, 'Generaste muchos links hoy. Probá mañana.');
	const token = tokenAleatorio();
	await db()`insert into invitaciones_amistad (cuenta_id, token_hash, vence_en)
		values (${sesion.id}, ${hashToken(token)}, now() + make_interval(days => ${DIAS_INVITACION}))
		on conflict (cuenta_id) do update set token_hash = excluded.token_hash, vence_en = excluded.vence_en`;
	return json({ token, dias: DIAS_INVITACION });
};

/** Anular el link vigente. */
export const DELETE = async ({ cookies }) => {
	const sesion = await exigirSesion(cookies);
	await db()`delete from invitaciones_amistad where cuenta_id = ${sesion.id}`;
	return sinContenido();
};
