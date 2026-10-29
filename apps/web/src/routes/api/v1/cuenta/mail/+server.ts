import { error } from '@sveltejs/kit';
import { mailValido } from '$lib/cuentas/validacion';
import { hashToken, hmacMail, tokenAleatorio } from '$lib/server/auth/cripto';
import { permitir } from '$lib/server/auth/limites';
import { enviarMail, mailDisponible } from '$lib/server/auth/mail';
import { exigirReautenticacion } from '$lib/server/auth/sesiones';
import { cfg } from '$lib/server/config';
import { db } from '$lib/server/db';
import { aceptado, cuerpoJson, limitarPorIp, sinContenido } from '$lib/server/http';

/**
 * Asociar un mail a la cuenta para poder entrar con un link (PRIVACY.md P-12):
 * se manda un link a ese mail y se asocia recién cuando lo abren. Responde
 * siempre igual: no revela si el mail ya es de otra cuenta (eso le llega solo
 * al dueño del mail). Si la cuenta ya tenía un mail, lo reemplaza.
 */
export const POST = async (event) => {
	const sesion = await exigirReautenticacion(event.cookies);
	if (!mailDisponible()) error(503, 'Entrar con mail todavía no está disponible.');
	limitarPorIp(event, 'mail', 10, 3600_000);
	if (!permitir(`vincular:${sesion.id}`, 5, 3600_000)) error(429, 'Ya mandaste varios links. Probá en un rato.');
	const { mail } = await cuerpoJson<{ mail: string }>(event);
	if (typeof mail !== 'string' || !mailValido(mail)) error(400, 'Ese mail no parece válido.');
	const hmac = hmacMail(mail);
	if (!permitir(`mail:${hmac.toString('hex')}`, 5, 3600_000)) error(429, 'Ya mandamos varios links a ese mail. Probá en un rato.');

	const sql = db();
	await sql`delete from tokens_mail where vence_en < now()`;
	const [otra] = await sql`select cuenta_id from logins_mail where mail_hmac = ${hmac}`;
	const origen = cfg().origen;
	if (otra && otra.cuenta_id !== sesion.id) {
		await enviarMail(mail, 'ya_asociado', `${origen}/app/entrar?modo=entrar`);
		return aceptado();
	}
	const token = tokenAleatorio();
	await sql`insert into tokens_mail (token_hash, mail_hmac, vincular_cuenta, vence_en)
		values (${hashToken(token)}, ${hmac}, ${sesion.id}, now() + interval '15 minutes')`;
	await enviarMail(mail, 'vincular', `${origen}/app/entrar/mail#${token}`);
	return aceptado();
};

/** Quitar el mail. Solo si queda otra forma de entrar (passkey o contraseña). */
export const DELETE = async ({ cookies }) => {
	const sesion = await exigirReautenticacion(cookies);
	const sql = db();
	const [m] = await sql`
		select exists (select 1 from credenciales_passkey where cuenta_id = ${sesion.id})
		    or exists (select 1 from claves where cuenta_id = ${sesion.id})
		    or exists (select 1 from logins_google where cuenta_id = ${sesion.id}) as otro`;
	if (!m.otro) error(409, 'Es tu única forma de entrar: no se puede quitar.');
	await sql`delete from logins_mail where cuenta_id = ${sesion.id}`;
	return sinContenido();
};
