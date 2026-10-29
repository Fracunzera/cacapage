import { error, json } from '@sveltejs/kit';
import type { DatosAlta } from '$lib/cuentas/validacion';
import { crearCuenta, SeudonimoTomado } from '$lib/server/auth/cuentas';
import { hashToken } from '$lib/server/auth/cripto';
import { iniciarSesion } from '$lib/server/auth/sesiones';
import { db } from '$lib/server/db';
import { cuerpoJson, limitarPorIp } from '$lib/server/http';

// Se canjea con POST desde la página, no con el GET del link: los escáneres de
// links de los proveedores de mail abren los links y quemarían el token.
export const POST = async (event) => {
	limitarPorIp(event, 'canje', 30, 600_000);
	const { token } = await cuerpoJson<{ token: string }>(event);
	if (typeof token !== 'string' || token.length < 20) error(400, 'Link inválido.');
	const sql = db();
	const [t] = await sql`update tokens_mail set usado = true
		where token_hash = ${hashToken(token)} and not usado and vence_en > now()
		returning mail_hmac, alta, vincular_cuenta`;
	if (!t) error(400, 'El link venció o ya se usó. Pedí otro.');

	let cuentaId: string;
	let seudonimo: string;
	let vinculado = false;
	if (t.vincular_cuenta) {
		// Asociar el mail a una cuenta existente (/api/v1/cuenta/mail).
		const [c] = await sql`select id, seudonimo from cuentas where id = ${t.vincular_cuenta} and estado = 'activa'`;
		if (!c) error(400, 'La cuenta ya no existe.');
		try {
			await sql`insert into logins_mail (cuenta_id, mail_hmac) values (${c.id}, ${t.mail_hmac})
				on conflict (cuenta_id) do update set mail_hmac = excluded.mail_hmac, creado_en = current_date`;
		} catch (e) {
			if ((e as { code?: string }).code === '23505') error(409, 'Ese mail ya es de otra cuenta.');
			throw e;
		}
		cuentaId = c.id;
		seudonimo = c.seudonimo;
		vinculado = true;
	} else if (t.alta) {
		const alta = t.alta as DatosAlta;
		try {
			cuentaId = await sql.begin(async (tx) => {
				const id = await crearCuenta(tx, alta);
				await tx`insert into logins_mail (cuenta_id, mail_hmac) values (${id}, ${t.mail_hmac})`;
				return id;
			});
		} catch (e) {
			if (e instanceof SeudonimoTomado) error(409, 'Ese seudónimo lo tomaron mientras tanto. Volvé a empezar con otro.');
			if ((e as { code?: string }).code === '23505') error(409, 'Ese mail ya tiene una cuenta. Entrá con él.');
			throw e;
		}
		seudonimo = alta.seudonimo;
	} else {
		const [c] = await sql`select c.id, c.seudonimo from logins_mail l join cuentas c on c.id = l.cuenta_id
			where l.mail_hmac = ${t.mail_hmac} and c.estado = 'activa'`;
		if (!c) error(400, 'La cuenta ya no existe.');
		cuentaId = c.id;
		seudonimo = c.seudonimo;
	}
	await iniciarSesion(event.cookies, cuentaId);
	return json({ seudonimo, vinculado });
};
