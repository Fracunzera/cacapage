import { error, json } from '@sveltejs/kit';
import { COOKIE_SESION, leerSesion } from '$lib/server/auth/sesiones';
import { db } from '$lib/server/db';
import { sinContenido } from '$lib/server/http';

export const GET = async ({ cookies }) => {
	const sesion = await leerSesion(cookies);
	if (!sesion) error(401, 'No hay sesión.');
	const [c] = await db()`
		select c.creada_en,
		       (select count(*) from credenciales_passkey p where p.cuenta_id = c.id)::int as passkeys,
		       exists (select 1 from logins_mail l where l.cuenta_id = c.id) as mail,
		       exists (select 1 from claves k where k.cuenta_id = c.id) as clave
		from cuentas c where c.id = ${sesion.id}`;
	return json({
		seudonimo: sesion.seudonimo,
		creada_en: c.creada_en,
		metodos: { passkeys: c.passkeys, mail: c.mail, clave: c.clave },
		reautenticada: sesion.reautenticada
	});
};

/**
 * Borrado real y en el acto (PRIVACY.md P-18): todo lo de la cuenta se borra en
 * cascada. Exige haber entrado hace menos de 5 minutos.
 */
export const DELETE = async ({ cookies }) => {
	const sesion = await leerSesion(cookies);
	if (!sesion) error(401, 'No hay sesión.');
	if (!sesion.reautenticada) error(403, 'Para borrar la cuenta, volvé a entrar (por seguridad, hace menos de 5 minutos).');
	await db()`delete from cuentas where id = ${sesion.id}`;
	cookies.delete(COOKIE_SESION, { path: '/', secure: true });
	return sinContenido();
};
