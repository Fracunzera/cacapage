import { error } from '@sveltejs/kit';
import { exigirReautenticacion } from '$lib/server/auth/sesiones';
import { db } from '$lib/server/db';
import { sinContenido } from '$lib/server/http';

/** Quitar Google. Solo si queda otra forma de entrar. */
export const DELETE = async ({ cookies }) => {
	const sesion = await exigirReautenticacion(cookies);
	const sql = db();
	const [m] = await sql`
		select exists (select 1 from credenciales_passkey where cuenta_id = ${sesion.id})
		    or exists (select 1 from claves where cuenta_id = ${sesion.id})
		    or exists (select 1 from logins_mail where cuenta_id = ${sesion.id}) as otro`;
	if (!m.otro) error(409, 'Es tu única forma de entrar: no se puede quitar.');
	await sql`delete from logins_google where cuenta_id = ${sesion.id}`;
	return sinContenido();
};
