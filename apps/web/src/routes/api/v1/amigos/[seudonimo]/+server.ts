import { exigirSesion } from '$lib/server/auth/sesiones';
import { db } from '$lib/server/db';
import { sinContenido } from '$lib/server/http';

/** Dejar de ser amigos (de los dos lados). El otro no recibe aviso. */
export const DELETE = async ({ cookies, params }) => {
	const sesion = await exigirSesion(cookies);
	await db()`delete from amistades a using cuentas c
		where lower(c.seudonimo) = lower(${params.seudonimo})
		  and ((a.cuenta_a = ${sesion.id} and a.cuenta_b = c.id) or (a.cuenta_b = ${sesion.id} and a.cuenta_a = c.id))`;
	return sinContenido();
};
