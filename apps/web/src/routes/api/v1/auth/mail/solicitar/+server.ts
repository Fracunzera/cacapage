import { error } from '@sveltejs/kit';
import { mailValido, normalizarSeudonimo, problemaAlta, type DatosAlta } from '$lib/cuentas/validacion';
import { seudonimoLibre } from '$lib/server/auth/cuentas';
import { hashToken, hmacMail, tokenAleatorio } from '$lib/server/auth/cripto';
import { permitir } from '$lib/server/auth/limites';
import { enviarMail, mailDisponible } from '$lib/server/auth/mail';
import { cfg } from '$lib/server/config';
import { db } from '$lib/server/db';
import { aceptado, cuerpoJson, limitarPorIp } from '$lib/server/http';

/**
 * Pide un link por mail para entrar o para crear la cuenta. Responde siempre
 * igual (202) exista o no la cuenta: la API no revela qué mails están
 * registrados. El aviso de "no hay cuenta" llega solo al dueño del mail.
 */
export const POST = async (event) => {
	if (!mailDisponible()) error(503, 'Entrar con mail todavía no está disponible. Usá una passkey.');
	limitarPorIp(event, 'mail', 10, 3600_000);
	const { mail, alta } = await cuerpoJson<{ mail: string; alta?: DatosAlta }>(event);
	if (typeof mail !== 'string' || !mailValido(mail)) error(400, 'Ese mail no parece válido.');
	const hmac = hmacMail(mail);
	if (!permitir(`mail:${hmac.toString('hex')}`, 5, 3600_000)) error(429, 'Ya mandamos varios links a ese mail. Probá en un rato.');

	const sql = db();
	await sql`delete from tokens_mail where vence_en < now()`;
	const [existente] = await sql`select cuenta_id from logins_mail where mail_hmac = ${hmac}`;
	const origen = cfg().origen;

	if (existente) {
		const token = tokenAleatorio();
		await sql`insert into tokens_mail (token_hash, mail_hmac, vence_en) values (${hashToken(token)}, ${hmac}, now() + interval '15 minutes')`;
		await enviarMail(mail, 'entrada', `${origen}/app/entrar/mail#${token}`);
		return aceptado();
	}

	if (alta) {
		const problema = problemaAlta(alta);
		if (problema) error(400, problema);
		if (!(await seudonimoLibre(alta.seudonimo))) error(409, 'Ese seudónimo ya está tomado.');
		const datos: DatosAlta = { seudonimo: normalizarSeudonimo(alta.seudonimo), mayor_de_edad: true, acepta_terminos: true };
		const token = tokenAleatorio();
		await sql`insert into tokens_mail (token_hash, mail_hmac, alta, vence_en)
			values (${hashToken(token)}, ${hmac}, ${sql.json(datos as never)}, now() + interval '15 minutes')`;
		await enviarMail(mail, 'alta', `${origen}/app/entrar/mail#${token}`);
		return aceptado();
	}

	await enviarMail(mail, 'sin_cuenta', `${origen}/app/entrar`);
	return aceptado();
};
