import { redirect } from '@sveltejs/kit';
import { crearCuenta, SeudonimoTomado } from '$lib/server/auth/cuentas';
import { hmacGoogle } from '$lib/server/auth/cripto';
import { canjear, leerPendiente } from '$lib/server/auth/google';
import { iniciarSesion, leerSesion } from '$lib/server/auth/sesiones';
import { db } from '$lib/server/db';

/**
 * Google vuelve acá con `code` y `state`. Los errores se muestran en la página
 * de entrar (o en "Mi cuenta", al vincular) con ?google=…
 */
export const GET = async ({ url, cookies }) => {
	const p = leerPendiente(cookies);
	const destinoError = p?.modo === 'vincular' ? '/app/cuenta' : '/app/entrar';
	const codigo = url.searchParams.get('code');
	if (!p || !codigo || url.searchParams.get('state') !== p.state) redirect(303, `${destinoError}?google=error`);

	let sub: string;
	try {
		sub = await canjear(codigo, p);
	} catch (e) {
		console.error(`Google: ${e instanceof Error ? e.message : e}`);
		redirect(303, `${destinoError}?google=error`);
	}
	const huella = hmacGoogle(sub);
	const sql = db();
	const [existente] = await sql`select l.cuenta_id from logins_google l join cuentas c on c.id = l.cuenta_id
		where l.sub_hmac = ${huella} and c.estado = 'activa'`;

	if (p.modo === 'vincular') {
		const sesion = await leerSesion(cookies);
		if (!sesion || sesion.id !== p.cuenta) redirect(303, '/app/cuenta?google=error');
		if (existente && existente.cuenta_id !== sesion.id) redirect(303, '/app/cuenta?google=ya_usado');
		await sql`insert into logins_google (cuenta_id, sub_hmac) values (${sesion.id}, ${huella})
			on conflict (cuenta_id) do update set sub_hmac = excluded.sub_hmac, creado_en = current_date`;
		redirect(303, '/app/cuenta?google=asociado');
	}

	// Entrar, o "crear" con una cuenta de Google que ya tiene cuenta acá: entra.
	if (existente) {
		await iniciarSesion(cookies, existente.cuenta_id);
		redirect(303, '/app');
	}
	if (p.modo === 'entrar' || !p.alta) redirect(303, '/app/entrar?google=sin_cuenta');
	let id: string;
	try {
		id = await sql.begin(async (tx) => {
			const nueva = await crearCuenta(tx, p.alta!);
			await tx`insert into logins_google (cuenta_id, sub_hmac) values (${nueva}, ${huella})`;
			return nueva;
		});
	} catch (e) {
		if (e instanceof SeudonimoTomado) redirect(303, '/app/entrar?google=seudonimo_tomado');
		throw e;
	}
	await iniciarSesion(cookies, id);
	redirect(303, '/app');
};
