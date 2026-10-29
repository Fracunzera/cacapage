import { error, json } from '@sveltejs/kit';
import { problemaAlta, problemaClave, type DatosAlta } from '$lib/cuentas/validacion';
import { huellaDe } from '$lib/server/auth/claves';
import { crearCuenta, SeudonimoTomado } from '$lib/server/auth/cuentas';
import { iniciarSesion } from '$lib/server/auth/sesiones';
import { db } from '$lib/server/db';
import { cuerpoJson, limitarPorIp } from '$lib/server/http';

export const POST = async (event) => {
	limitarPorIp(event, 'clave-alta', 10, 3600_000);
	const c = await cuerpoJson<DatosAlta & { clave: string }>(event);
	const problema = problemaAlta(c) ?? (typeof c.clave === 'string' ? problemaClave(c.clave, c.seudonimo) : 'Falta la contraseña.');
	if (problema) error(400, problema);
	const huella = await huellaDe(c.clave);
	let cuentaId: string;
	try {
		cuentaId = await db().begin(async (tx) => {
			const id = await crearCuenta(tx, c);
			await tx`insert into claves (cuenta_id, huella) values (${id}, ${huella})`;
			return id;
		});
	} catch (e) {
		if (e instanceof SeudonimoTomado) error(409, 'Ese seudónimo ya está tomado.');
		throw e;
	}
	await iniciarSesion(event.cookies, cuentaId);
	return json({ seudonimo: c.seudonimo.trim().toLowerCase() });
};
