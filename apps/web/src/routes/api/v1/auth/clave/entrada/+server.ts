import { error, json } from '@sveltejs/kit';
import { normalizarSeudonimo } from '$lib/cuentas/validacion';
import { gastarTiempoIgual, verificarClave } from '$lib/server/auth/claves';
import { permitir } from '$lib/server/auth/limites';
import { iniciarSesion } from '$lib/server/auth/sesiones';
import { db } from '$lib/server/db';
import { cuerpoJson, limitarPorIp } from '$lib/server/http';

const MAL = 'Seudónimo o contraseña incorrectos.';

export const POST = async (event) => {
	limitarPorIp(event, 'clave-entrada', 20, 600_000);
	const { seudonimo, clave } = await cuerpoJson<{ seudonimo: string; clave: string }>(event);
	if (typeof seudonimo !== 'string' || typeof clave !== 'string' || clave.length > 200) error(400, MAL);
	const s = normalizarSeudonimo(seudonimo);
	// Límite por cuenta, además del de IP: frena a quien prueba desde muchas IPs.
	if (!permitir(`clave-cuenta:${s}`, 10, 3600_000)) error(429, 'Demasiados intentos para esta cuenta. Probá en una hora.');

	const [fila] = await db()`select c.id, c.seudonimo, k.huella from cuentas c join claves k on k.cuenta_id = c.id
		where lower(c.seudonimo) = ${s} and c.estado = 'activa'`;
	if (!fila) {
		await gastarTiempoIgual(clave);
		error(400, MAL);
	}
	if (!(await verificarClave(clave, fila.huella))) error(400, MAL);
	await iniciarSesion(event.cookies, fila.id);
	return json({ seudonimo: fila.seudonimo });
};
