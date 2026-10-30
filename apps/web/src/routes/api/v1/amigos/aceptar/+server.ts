import { error, json } from '@sveltejs/kit';
import { amigosDe, MAXIMO_AMIGOS, par } from '$lib/server/amigos';
import { hashToken } from '$lib/server/auth/cripto';
import { exigirSesion } from '$lib/server/auth/sesiones';
import { db } from '$lib/server/db';
import { cuerpoJson, limitarPorIp } from '$lib/server/http';

/** Aceptar una invitación: quedan como amigos de los dos lados. */
export const POST = async (event) => {
	limitarPorIp(event, 'aceptar-amigo', 30, 600_000);
	const sesion = await exigirSesion(event.cookies);
	const { token } = await cuerpoJson<{ token: string }>(event);
	if (typeof token !== 'string' || token.length < 20 || token.length > 100) error(400, 'Link inválido.');
	const sql = db();
	const [inv] = await sql`select i.cuenta_id, c.seudonimo from invitaciones_amistad i
		join cuentas c on c.id = i.cuenta_id and c.estado = 'activa'
		where i.token_hash = ${hashToken(token)} and i.vence_en > now()`;
	if (!inv) error(400, 'El link venció o ya no sirve. Pedile uno nuevo a quien te invitó.');
	if (inv.cuenta_id === sesion.id) error(400, 'Ese es tu propio link: mandáselo a tus amigos.');
	const [mios, suyos] = await Promise.all([amigosDe(sql, sesion.id), amigosDe(sql, inv.cuenta_id)]);
	if (mios.length >= MAXIMO_AMIGOS || suyos.length >= MAXIMO_AMIGOS) error(409, 'Llegaron al máximo de amigos.');
	const [a, b] = par(sesion.id, inv.cuenta_id);
	const filas = await sql`insert into amistades (cuenta_a, cuenta_b) values (${a}, ${b}) on conflict do nothing returning 1`;
	return json({ seudonimo: inv.seudonimo, ya_eran: filas.length === 0 });
};
